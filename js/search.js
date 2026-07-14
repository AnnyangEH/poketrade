/* ════════════════════════════════════════
   보관함 필터 (텍스트 검색 / 배경 다중선택 / 폼 타입 칩 / 정렬)
   — 전부 클라이언트 메모리에서 Array.filter로 처리, Firestore 재쿼리 없음
════════════════════════════════════════ */
import { backgrounds } from './app.js';

const STORAGE_KEY = 'inventory_filters';

const CHIP_DEFS = [
  { key: 'shiny',        label: '✨ Shiny' },
  { key: 'costume',      label: '🎭 코스튬' },
  { key: 'gmax',         label: '💪 GMAX' },
  { key: 'hasBackground',label: '🖼 배경있음' },
  { key: 'hasMemo',      label: '📝 메모있음' }
];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      return {
        text: saved.text || '',
        backgroundIds: Array.isArray(saved.backgroundIds) ? saved.backgroundIds : [],
        chips: Array.isArray(saved.chips) ? saved.chips : [],
        sort: saved.sort || 'latest'
      };
    }
  } catch (e) { /* 손상된 값은 무시하고 기본값 사용 */ }
  return { text: '', backgroundIds: [], chips: [], sort: 'latest' };
}

let state = loadState();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getFilterState() {
  return state;
}

export function initFilterBar(container, onChange) {
  if (!container) return;
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';

  /* 1. 텍스트 검색 */
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '검색 (이름 / 번호 / 폼)';
  searchInput.value = state.text;
  searchInput.className = 'border rounded-lg px-2 py-1.5 text-sm w-full bg-white';
  searchInput.addEventListener('input', () => {
    state.text = searchInput.value;
    persist();
    onChange();
  });
  wrap.appendChild(searchInput);

  /* 2. 배경/이벤트 다중선택 */
  const bgToggleRow = document.createElement('div');
  bgToggleRow.className = 'flex items-center gap-2';
  const bgToggleBtn = document.createElement('button');
  bgToggleBtn.type = 'button';
  bgToggleBtn.className = 'chip rounded-full px-3 py-1 text-xs font-semibold';
  const bgPanel = document.createElement('div');
  bgPanel.className = 'hidden flex-wrap gap-1.5 border rounded-lg p-2 bg-white';

  function refreshBgToggleLabel() {
    bgToggleBtn.textContent = state.backgroundIds.length
      ? `🖼 배경/이벤트 (${state.backgroundIds.length})`
      : '🖼 배경/이벤트';
  }
  refreshBgToggleLabel();
  bgToggleBtn.addEventListener('click', () => {
    bgPanel.classList.toggle('hidden');
    bgPanel.classList.toggle('flex');
  });

  if (backgrounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-xs text-gray-400 py-1';
    empty.textContent = '등록된 배경이 없습니다.';
    bgPanel.appendChild(empty);
  } else {
    backgrounds.forEach(bg => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-1 text-xs bg-gray-50 rounded-full px-2 py-1 cursor-pointer';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'accent-blue-600';
      cb.checked = state.backgroundIds.includes(String(bg.id));
      cb.addEventListener('change', () => {
        const id = String(bg.id);
        if (cb.checked) {
          if (!state.backgroundIds.includes(id)) state.backgroundIds.push(id);
        } else {
          state.backgroundIds = state.backgroundIds.filter(x => x !== id);
        }
        persist();
        refreshBgToggleLabel();
        onChange();
      });
      const span = document.createElement('span');
      span.textContent = bg.name;
      label.append(cb, span);
      bgPanel.appendChild(label);
    });
  }
  bgToggleRow.appendChild(bgToggleBtn);
  wrap.append(bgToggleRow, bgPanel);

  /* 3. 폼 타입 칩 */
  const chipRow = document.createElement('div');
  chipRow.className = 'flex flex-wrap gap-1.5';
  CHIP_DEFS.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = `chip rounded-full px-2.5 py-1 text-[11px] font-semibold ${state.chips.includes(key) ? 'active' : ''}`;
    btn.addEventListener('click', () => {
      if (state.chips.includes(key)) {
        state.chips = state.chips.filter(c => c !== key);
        btn.classList.remove('active');
      } else {
        state.chips.push(key);
        btn.classList.add('active');
      }
      persist();
      onChange();
    });
    chipRow.appendChild(btn);
  });
  wrap.appendChild(chipRow);

  /* 4. 정렬 */
  const sortRow = document.createElement('div');
  sortRow.className = 'flex items-center gap-2';
  const sortLabel = document.createElement('span');
  sortLabel.className = 'text-xs text-gray-400';
  sortLabel.textContent = '정렬';
  const sortSelect = document.createElement('select');
  sortSelect.className = 'border rounded-lg px-2 py-1 text-xs bg-white';
  [
    ['latest', '최신'],
    ['name',   '이름'],
    ['qty',    '수량'],
    ['event',  '이벤트']
  ].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === state.sort) opt.selected = true;
    sortSelect.appendChild(opt);
  });
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    persist();
    onChange();
  });
  sortRow.append(sortLabel, sortSelect);
  wrap.appendChild(sortRow);

  container.appendChild(wrap);
}

export function applyFilters(entries) {
  const q = state.text.trim().toLowerCase();
  let list = entries.filter(e => {
    if (q) {
      const matches =
        e.pokemon.name_ko.toLowerCase().includes(q) ||
        e.pokemon.name_en.toLowerCase().includes(q) ||
        String(e.pokemon.dexId).includes(q) ||
        e.form.name.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (state.backgroundIds.length && !state.backgroundIds.includes(e.backgroundId)) return false;
    if (state.chips.includes('shiny')         && !e.form.isShiny)   return false;
    if (state.chips.includes('costume')       && !e.form.isCostume) return false;
    if (state.chips.includes('gmax')          && !e.form.isGmax)    return false;
    if (state.chips.includes('hasBackground') && !e.backgroundId)   return false;
    if (state.chips.includes('hasMemo')       && !e.memo)           return false;
    return true;
  });

  switch (state.sort) {
    case 'name':
      list.sort((a, b) => a.pokemon.name_ko.localeCompare(b.pokemon.name_ko));
      break;
    case 'qty':
      list.sort((a, b) => b.qty - a.qty);
      break;
    case 'event':
      list.sort((a, b) => (a.background?.event || '').localeCompare(b.background?.event || ''));
      break;
    default:
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  return list;
}

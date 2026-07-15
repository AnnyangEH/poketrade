/* ════════════════════════════════════════
   재고 탭 필터 — 검색 + 7개 칩(일반/이로치/코스튬/GMAX/전설·UB/배경/선택됨)
   전부 클라이언트 메모리 Array.filter, 저장소 재쿼리 없음
════════════════════════════════════════ */

export const CHIP_DEFS = [
  { key: 'normal',    label: 'Normal' },
  { key: 'shiny',     label: 'Shiny' },
  { key: 'costume',   label: 'Costume' },
  { key: 'gmax',      label: 'GMAX' },
  { key: 'legendary', label: 'Legend/UB' },
  { key: 'background',label: 'Background' },
  { key: 'selected',  label: 'Selected' }
];

let state = { text: '', chips: [] };

export function getFilterState() {
  return state;
}

export function initFilterBar(container, onChange) {
  if (!container) return;
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Looking For';
  searchInput.value = state.text;
  searchInput.className = 'border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 rounded-lg px-3 py-2 text-sm w-full';
  searchInput.addEventListener('input', () => {
    state.text = searchInput.value;
    onChange();
  });
  wrap.appendChild(searchInput);

  const chipRow = document.createElement('div');
  chipRow.className = 'flex flex-wrap gap-1.5';
  CHIP_DEFS.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = `chip rounded-full px-3 py-1 text-xs font-semibold ${state.chips.includes(key) ? 'active' : ''}`;
    btn.addEventListener('click', () => {
      if (state.chips.includes(key)) {
        state.chips = state.chips.filter(c => c !== key);
        btn.classList.remove('active');
      } else {
        state.chips.push(key);
        btn.classList.add('active');
      }
      onChange();
    });
    chipRow.appendChild(btn);
  });
  wrap.appendChild(chipRow);

  container.appendChild(wrap);
}

export function applyFilters(entries) {
  const q = state.text.trim().toLowerCase();
  return entries.filter(e => {
    if (q && !e.name.toLowerCase().includes(q)) return false;
    if (state.chips.includes('normal')    && !e.isNormal)    return false;
    if (state.chips.includes('shiny')     && !e.isShiny)     return false;
    if (state.chips.includes('costume')   && !e.isCostume)   return false;
    if (state.chips.includes('gmax')      && !e.isGmax)      return false;
    if (state.chips.includes('legendary') && !e.isLegendary) return false;
    if (state.chips.includes('background') && !e.hasBackground) return false;
    if (state.chips.includes('selected')  && !e.selected)    return false;
    return true;
  });
}

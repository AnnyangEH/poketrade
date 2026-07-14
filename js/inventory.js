/* ════════════════════════════════════════
   보관함 — 클릭 선택식 카드 그리드
════════════════════════════════════════ */
import { inventory, pokemonIndex, backgrounds, saveInventory } from './app.js';
import { initFilterBar, applyFilters, getFilterState } from './search.js';

let filterBarReady = false;

export function renderInventory() {
  if (!filterBarReady) {
    initFilterBar(document.getElementById('inventory-filters'), renderInventory);
    filterBarReady = true;
  }
  renderAddPanel();
  const entries = buildEntries();
  renderGrid(applyFilters(entries));
}

/* ════════════════════════════════════════
   보유 항목 목록 구성
════════════════════════════════════════ */
function buildEntries() {
  return Object.keys(inventory).map(key => {
    const [dexId, formId, backgroundId] = key.split('_');
    const pokemon = pokemonIndex.find(p => String(p.dexId) === dexId);
    const form = pokemon && pokemon.forms.find(f => f.formId === formId);
    if (!pokemon || !form) return null;
    const background = backgrounds.find(b => String(b.id) === backgroundId) || null;
    const data = inventory[key];
    return {
      key, dexId, formId, backgroundId,
      pokemon, form, background,
      qty: data.qty || 0,
      memo: data.memo || '',
      updatedAt: data.updatedAt || 0
    };
  }).filter(Boolean);
}

/* ════════════════════════════════════════
   검색 → 클릭 추가 패널
   (search.js의 텍스트 검색어를 재사용해 아직 보관함에 없는
    포켓몬/폼을 찾아 배경을 골라 추가할 수 있게 한다)
════════════════════════════════════════ */
function renderAddPanel() {
  const panel = document.getElementById('inventory-add-results');
  if (!panel) return;
  panel.innerHTML = '';

  const q = getFilterState().text.trim().toLowerCase();
  if (!q) { panel.classList.add('hidden'); return; }

  const matches = [];
  pokemonIndex.forEach(p => {
    p.forms.forEach(f => {
      const hit =
        p.name_ko.toLowerCase().includes(q) ||
        p.name_en.toLowerCase().includes(q) ||
        String(p.dexId).includes(q) ||
        f.name.toLowerCase().includes(q);
      if (hit) matches.push({ pokemon: p, form: f });
    });
  });

  if (matches.length === 0) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  const title = document.createElement('p');
  title.className = 'text-xs font-bold text-gray-500 mb-1.5';
  title.textContent = '검색 결과에서 추가';
  panel.appendChild(title);

  matches.slice(0, 20).forEach(({ pokemon, form }) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-1.5 bg-white rounded-lg shadow-sm p-1.5 mb-1.5';

    const label = document.createElement('span');
    label.className = 'text-xs font-medium flex-1 truncate';
    label.textContent = `${pokemon.name_ko} ${form.name}`;

    const bgSelect = document.createElement('select');
    bgSelect.className = 'border rounded px-1.5 py-1 text-[11px] bg-white';
    const optNone = document.createElement('option');
    optNone.value = ''; optNone.textContent = '배경 없음';
    bgSelect.appendChild(optNone);
    backgrounds.forEach(bg => {
      const opt = document.createElement('option');
      opt.value = String(bg.id); opt.textContent = bg.name;
      bgSelect.appendChild(opt);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = '추가';
    addBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg px-2.5 py-1 flex-shrink-0';
    addBtn.onclick = () => addToInventory(pokemon.dexId, form.formId, bgSelect.value);

    row.append(label, bgSelect, addBtn);
    panel.appendChild(row);
  });
}

export function addToInventory(dexId, formId, backgroundId) {
  const key = `${dexId}_${formId}_${backgroundId}`;
  if (!inventory[key]) inventory[key] = { qty: 0, memo: '', updatedAt: 0 };
  inventory[key].qty = (inventory[key].qty || 0) + 1;
  inventory[key].updatedAt = Date.now();
  saveInventory();
  renderInventory();
}

/* ════════════════════════════════════════
   카드 그리드 렌더링
════════════════════════════════════════ */
function renderGrid(entries) {
  const grid = document.getElementById('inventory-grid');
  const empty = document.getElementById('inventory-empty');
  if (!grid) return;
  grid.innerHTML = '';

  if (entries.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  entries.forEach(e => grid.appendChild(buildCard(e)));
}

function buildCard(e) {
  const card = document.createElement('div');
  card.className = 'relative bg-white rounded-xl shadow p-2 flex flex-col gap-1.5';

  const delBtn = document.createElement('button');
  delBtn.textContent = '✕';
  delBtn.className = 'absolute top-1 right-1 text-gray-300 hover:text-red-500 text-xs font-bold leading-none z-10';
  delBtn.onclick = () => removeFromInventory(e.key);
  card.appendChild(delBtn);

  const imgWrap = document.createElement('div');
  imgWrap.className = 'w-full aspect-square rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center';
  if (e.form.iconUrl) {
    const img = document.createElement('img');
    img.src = e.form.iconUrl;
    img.className = 'w-full h-full object-contain';
    img.onerror = () => { imgWrap.innerHTML = '<span class="text-gray-300 text-2xl">❓</span>'; };
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = '<span class="text-gray-300 text-2xl">❓</span>';
  }
  card.appendChild(imgWrap);

  const name = document.createElement('p');
  name.className = 'text-xs font-bold text-center truncate';
  name.textContent = `${e.pokemon.name_ko} ${e.form.name}`;
  card.appendChild(name);

  const badge = document.createElement('span');
  badge.className = e.background
    ? 'self-center bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full px-2 py-0.5'
    : 'self-center bg-gray-100 text-gray-400 text-[10px] font-semibold rounded-full px-2 py-0.5';
  badge.textContent = e.background ? e.background.name : '배경 없음';
  card.appendChild(badge);

  const qtyRow = document.createElement('div');
  qtyRow.className = 'flex items-center justify-center gap-2';
  const btnM = document.createElement('button');
  btnM.textContent = '−';
  btnM.className = 'w-6 h-6 rounded-full bg-gray-200 text-gray-600 font-bold text-sm leading-none';
  btnM.onclick = () => changeQty(e.key, -1);
  const qtyVal = document.createElement('span');
  qtyVal.className = 'w-6 text-center text-sm font-bold';
  qtyVal.textContent = e.qty;
  const btnP = document.createElement('button');
  btnP.textContent = '+';
  btnP.className = 'w-6 h-6 rounded-full bg-blue-500 text-white font-bold text-sm leading-none';
  btnP.onclick = () => changeQty(e.key, 1);
  qtyRow.append(btnM, qtyVal, btnP);
  card.appendChild(qtyRow);

  const memoInput = document.createElement('input');
  memoInput.type = 'text';
  memoInput.placeholder = '메모';
  memoInput.value = e.memo;
  memoInput.className = 'w-full text-[11px] text-gray-500 bg-transparent border border-transparent focus:border-gray-200 focus:bg-gray-50 rounded px-1 py-0.5 truncate';
  memoInput.addEventListener('change', () => updateMemo(e.key, memoInput.value));
  card.appendChild(memoInput);

  return card;
}

function changeQty(key, delta) {
  if (!inventory[key]) return;
  inventory[key].qty = Math.max(0, (inventory[key].qty || 0) + delta);
  inventory[key].updatedAt = Date.now();
  saveInventory();
  renderInventory();
}

function updateMemo(key, memo) {
  if (!inventory[key]) return;
  inventory[key].memo = memo.trim();
  inventory[key].updatedAt = Date.now();
  saveInventory();
}

function removeFromInventory(key) {
  if (!confirm('이 항목을 보관함에서 삭제하시겠습니까?')) return;
  delete inventory[key];
  saveInventory();
  renderInventory();
}

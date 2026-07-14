/* ════════════════════════════════════════
   시세 검색 — 1단계 로컬 선택 + 2단계 시세 조회
   Fuse.js 등 외부 검색 라이브러리 사용 금지, 순수 JS includes 검색만 사용
════════════════════════════════════════ */
import { db, doc, getDoc, setDoc, fsErr } from './firebase.js';
import { pokemonIndex, backgrounds } from './app.js';
import { addToInventory } from './inventory.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let selectedForm = null; // { pokemon, form }

/* ════════════════════════════════════════
   1단계: 로컬 검색 인덱스 (한/영/번호/폼명/이벤트명)
════════════════════════════════════════ */
function buildSearchIndex() {
  const list = [];
  pokemonIndex.forEach(pokemon => {
    pokemon.forms.forEach(form => {
      const text = [
        pokemon.name_ko,
        pokemon.name_en,
        String(pokemon.dexId),
        form.name,
        form.event || ''
      ].join(' ').toLowerCase();
      list.push({ pokemon, form, text });
    });
  });
  return list;
}

function searchIndex(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const index = buildSearchIndex();
  return index.filter(item => item.text.includes(q)).slice(0, 30);
}

/* ════════════════════════════════════════
   2단계: 키워드 빌더 / 해시 / 캐시 조회
════════════════════════════════════════ */
function buildKeyword(form, background) {
  const parts = [form.pokemon.name_en, form.form.name];
  if (background) parts.push(background.name);
  parts.push('pokemon go -plush -card -sticker');
  return parts.filter(Boolean).join(' ');
}

function hashKeyword(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function lookupPrice(keyword) {
  const hash = hashKeyword(keyword);
  const ref = doc(db, 'prices', hash);
  const snap = await getDoc(ref);
  if (snap.exists() && Date.now() - (snap.data().fetchedAt || 0) < ONE_DAY_MS) {
    return snap.data();
  }

  const res = await fetch(`/api/price?q=${encodeURIComponent(keyword)}`);
  const json = await res.json();
  const prices = Array.isArray(json.prices) ? json.prices : [];
  const average = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const data = { keyword, prices, average, fetchedAt: Date.now() };
  await setDoc(ref, data).catch(fsErr('시세 캐시'));
  return data;
}

/* ════════════════════════════════════════
   모달 UI
════════════════════════════════════════ */
const modal        = document.getElementById('price-modal');
const openBtn       = document.getElementById('price-search-open-btn');
const closeBtn      = document.getElementById('price-modal-close');
const stepSelect    = document.getElementById('price-step-select');
const stepLookup    = document.getElementById('price-step-lookup');
const searchInput   = document.getElementById('price-search-input');
const resultsBox    = document.getElementById('price-search-results');
const backBtn       = document.getElementById('price-back-btn');
const selectedLabel = document.getElementById('price-selected-label');
const bgSelect      = document.getElementById('price-background-select');
const lookupBtn     = document.getElementById('price-lookup-btn');
const resultBox     = document.getElementById('price-result');
const resultAvg     = document.getElementById('price-result-avg');
const resultCount   = document.getElementById('price-result-count');
const addBtn        = document.getElementById('price-add-btn');

function openModal() {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  showSelectStep();
}

function closeModal() {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function showSelectStep() {
  selectedForm = null;
  searchInput.value = '';
  resultsBox.innerHTML = '';
  stepSelect.classList.remove('hidden');
  stepLookup.classList.add('hidden');
}

function showLookupStep() {
  stepSelect.classList.add('hidden');
  stepLookup.classList.remove('hidden');
  resultBox.classList.add('hidden');

  selectedLabel.textContent = `${selectedForm.pokemon.name_ko} ${selectedForm.form.name}`;

  bgSelect.innerHTML = '';
  const optNone = document.createElement('option');
  optNone.value = ''; optNone.textContent = '배경 없음';
  bgSelect.appendChild(optNone);
  backgrounds.forEach(bg => {
    const opt = document.createElement('option');
    opt.value = String(bg.id); opt.textContent = bg.name;
    bgSelect.appendChild(opt);
  });
}

function renderSearchResults(query) {
  resultsBox.innerHTML = '';
  const matches = searchIndex(query);
  matches.forEach(({ pokemon, form }) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-2 py-1.5 cursor-pointer';
    const label = document.createElement('span');
    label.className = 'text-xs font-medium truncate';
    label.textContent = `${pokemon.name_ko} ${form.name}${form.event ? ` · ${form.event}` : ''}`;
    row.appendChild(label);
    row.onclick = () => {
      selectedForm = { pokemon, form };
      showLookupStep();
    };
    resultsBox.appendChild(row);
  });
  if (query.trim() && matches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-xs text-gray-400 text-center py-2';
    empty.textContent = '검색 결과가 없습니다.';
    resultsBox.appendChild(empty);
  }
}

if (openBtn)  openBtn.addEventListener('click', openModal);
if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
if (backBtn) backBtn.addEventListener('click', showSelectStep);
if (searchInput) searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));

if (lookupBtn) lookupBtn.addEventListener('click', async () => {
  if (!selectedForm) return;
  const backgroundId = bgSelect.value;
  const background = backgrounds.find(b => String(b.id) === backgroundId) || null;
  const keyword = buildKeyword(selectedForm, background);

  lookupBtn.disabled = true;
  lookupBtn.textContent = '조회 중...';
  try {
    const data = await lookupPrice(keyword);
    resultAvg.textContent = `${data.average.toFixed(1)}만`;
    resultCount.textContent = `표본 ${data.prices.length}건 · "${data.keyword}"`;
    resultBox.classList.remove('hidden');
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = '시세 조회';
  }
});

if (addBtn) addBtn.addEventListener('click', () => {
  if (!selectedForm) return;
  addToInventory(selectedForm.pokemon.dexId, selectedForm.form.formId, bgSelect.value);
  closeModal();
  window.switchTab('inventory');
});

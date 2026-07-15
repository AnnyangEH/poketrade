/* ════════════════════════════════════════
   재고 탭 — "Select Pokemon" 스타일 촘촘한 그리드
   실제 스프라이트 에셋이 없어 색깔 삼각형으로 대체:
     일반=노랑, 이로치=흰색, 코스튬=하늘색, GMAX=빨강
   전체 898종 카탈로그는 시간 절약을 위해 임시로 미뤄두고, 2024~2026년
   배경(GO Fest/City Safari 등)에 등장한 전설/UB 62종으로 범위를 좁혀서
   먼저 만듦 (PokeAPI is_legendary/is_mythical + UB 고정 목록 11종 기준).
   배경(backgrounds.json)은 아직 폼별로 연결되어 있지 않아 이번 단계에선
   그리드에 반영하지 않음 — "Background" 칩도 소스 데이터가 없어 당분간
   항상 false(비활성 상태)
════════════════════════════════════════ */
import { initFilterBar, applyFilters } from './search.js';
import { inventory, saveInventory, pokemonIndex } from './app.js';

const TYPE_COLOR = { normal: '#facc15', shiny: '#ffffff', costume: '#38bdf8', gmax: '#ef4444' };
function typeColor(e) {
  if (e.isGmax)    return TYPE_COLOR.gmax;
  if (e.isCostume) return TYPE_COLOR.costume;
  if (e.isShiny)   return TYPE_COLOR.shiny;
  return TYPE_COLOR.normal;
}

// 2024~2026년 배경에 등장한 전설/신화/UB 62종 (도감번호)
const LEGENDARY_UB_DEX_IDS = new Set([
  144,145,146,150,243,244,245,249,250,377,378,379,380,381,382,383,384,386,
  480,481,482,483,484,485,486,487,488,491,638,639,640,641,642,643,644,645,
  646,649,716,717,785,786,787,788,791,792,793,794,795,796,797,798,799,800,
  805,806,807,888,889,894,895,905
]);

function speciesSearchText(p) {
  // 검색은 종(이름/영문명/도감번호) 단위로만 매칭 — 폼/코스튬 이름까지 매칭하면
  // "피카츄 바이저"처럼 다른 종의 코스튬 이름에 다른 종 검색어가 우연히 걸리는 문제가 생김
  return `${p.name_ko} ${p.name_en} ${p.dexId}`.toLowerCase();
}

function formToEntry(p, f) {
  return {
    key: `${p.dexId}_${f.formId}`,
    name: `${p.name_ko} ${f.name}`,
    searchText: speciesSearchText(p),
    isNormal: f.formId === 'normal',
    isShiny: !!f.isShiny,
    isCostume: !!f.isCostume,
    isGmax: !!p.isGmaxAvailable,
    isLegendary: false,   // 이 칩은 별도 소스 데이터 없이 항상 false로 남겨둠(전체 카탈로그 기준 필터)
    hasBackground: false  // 폼별 배경 연결 없음 — 항상 false
  };
}

// 전체 898종 카탈로그 — 전설/UB로 범위를 좁히는 동안 임시로 사용하지 않음.
// eslint-disable-next-line no-unused-vars
function buildCatalog() {
  const entries = [];
  pokemonIndex.forEach(p => p.forms.forEach(f => entries.push(formToEntry(p, f))));
  return entries;
}

function buildCuratedCatalog() {
  const entries = [];
  pokemonIndex
    .filter(p => LEGENDARY_UB_DEX_IDS.has(p.dexId))
    .forEach(p => p.forms.forEach(f => entries.push(formToEntry(p, f))));
  return entries;
}

let filterBarReady = false;
let modalWired = false;

export function renderInventory() {
  renderMonbox();
  wireModal();
}

/* ════════════════════════════════════════
   몬박스 요약 (재고 탭 메인 화면)
════════════════════════════════════════ */
function renderMonbox() {
  const grid  = document.getElementById('monbox-grid');
  const empty = document.getElementById('monbox-empty');
  if (!grid) return;
  grid.innerHTML = '';

  const owned = buildCuratedCatalog().filter(e => inventory[e.key]);
  if (owned.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  owned.forEach(e => grid.appendChild(buildThumb({ ...e, selected: true })));
}

/* ════════════════════════════════════════
   포켓몬 선택 모달
════════════════════════════════════════ */
function wireModal() {
  if (modalWired) return;
  modalWired = true;

  const modal   = document.getElementById('select-modal');
  const addBtn  = document.getElementById('monbox-add-btn');
  const closeBtn = document.getElementById('select-modal-close');

  addBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (!filterBarReady) {
      initFilterBar(document.getElementById('inventory-filters'), renderPickerGrid);
      filterBarReady = true;
    }
    renderPickerGrid();
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
}

function renderPickerGrid() {
  const grid  = document.getElementById('inventory-grid');
  const empty = document.getElementById('inventory-empty');
  if (!grid) return;

  // 전설/UB 62종(폼 기준 넉넉히 100개 미만)이라 전체 898종과 달리
  // 검색/칩 없이도 바로 다 보여줌
  if (empty) empty.textContent = '조건에 맞는 항목이 없습니다.';

  const entries = buildCuratedCatalog().map(e => ({ ...e, selected: !!inventory[e.key] }));
  renderGrid(applyFilters(entries));
}

function renderGrid(entries) {
  const grid  = document.getElementById('inventory-grid');
  const empty = document.getElementById('inventory-empty');
  if (!grid) return;
  grid.innerHTML = '';

  if (entries.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  entries.forEach(e => grid.appendChild(buildThumb(e)));
}

function buildThumb(e) {
  const cell = document.createElement('div');
  cell.className = 'relative aspect-square cursor-pointer flex items-center justify-center' +
    (e.selected ? ' ring-2 ring-blue-400 ring-inset' : '');
  cell.style.background = '#374151';
  cell.title = e.name;

  const tri = document.createElement('div');
  tri.style.width = '0';
  tri.style.height = '0';
  tri.style.borderLeft = '16px solid transparent';
  tri.style.borderRight = '16px solid transparent';
  tri.style.borderBottom = `28px solid ${typeColor(e)}`;
  cell.appendChild(tri);

  cell.onclick = () => {
    if (inventory[e.key]) delete inventory[e.key];
    else inventory[e.key] = { selectedAt: Date.now() };
    saveInventory();
    renderMonbox();
    renderPickerGrid();
  };

  return cell;
}

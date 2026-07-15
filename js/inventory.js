/* ════════════════════════════════════════
   재고 탭 — "Select Pokemon" 스타일 촘촘한 그리드
   실제 스프라이트 에셋이 없어 색깔 삼각형으로 대체:
     일반=노랑, 이로치=흰색, 코스튬=하늘색, GMAX=빨강
   pokemon-index.json 실제 데이터(898종·폼 2195개) 사용.
   배경(backgrounds.json)은 아직 폼별로 연결되어 있지 않아 이번 단계에선
   그리드에 반영하지 않음 — "Legend/UB"/"Background" 칩도 소스 데이터가
   없어 당분간 항상 false(비활성 상태)
════════════════════════════════════════ */
import { initFilterBar, applyFilters, getFilterState } from './search.js';
import { inventory, saveInventory, pokemonIndex } from './app.js';

const TYPE_COLOR = { normal: '#facc15', shiny: '#ffffff', costume: '#38bdf8', gmax: '#ef4444' };
function typeColor(e) {
  if (e.isGmax)    return TYPE_COLOR.gmax;
  if (e.isCostume) return TYPE_COLOR.costume;
  if (e.isShiny)   return TYPE_COLOR.shiny;
  return TYPE_COLOR.normal;
}

function buildCatalog() {
  const entries = [];
  pokemonIndex.forEach(p => {
    p.forms.forEach(f => {
      const key = `${p.dexId}_${f.formId}`;
      entries.push({
        key,
        name: `${p.name_ko} ${f.name}`,
        isNormal: f.formId === 'normal',
        isShiny: !!f.isShiny,
        isCostume: !!f.isCostume,
        isGmax: !!p.isGmaxAvailable,
        isLegendary: false,   // 소스 데이터 없음 — 항상 false
        hasBackground: false // 폼별 배경 연결 없음 — 항상 false
      });
    });
  });
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

  const owned = buildCatalog().filter(e => inventory[e.key]);
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

  // 필터가 하나도 없으면 898종 전체(폼 2195개)를 그냥 다 그리지 않고 검색/칩을 유도
  const state = getFilterState();
  if (!state.text.trim() && state.chips.length === 0) {
    grid.innerHTML = '';
    if (empty) {
      empty.classList.remove('hidden');
      empty.textContent = '검색하거나 칩을 선택해주세요.';
    }
    return;
  }
  if (empty) empty.textContent = '조건에 맞는 항목이 없습니다.';

  const entries = buildCatalog().map(e => ({ ...e, selected: !!inventory[e.key] }));
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

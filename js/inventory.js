/* ════════════════════════════════════════
   재고 탭 — "Select Pokemon" 스타일 촘촘한 그리드 프로토타입
   실제 스프라이트/배경 에셋이 없어 색깔 삼각형으로 대체:
     일반=노랑, 이로치=흰색, 코스튬=하늘색, GMAX=빨강, 전설/UB=보라
     배경 있음=검정 바탕, 배경 없음=회색 바탕
   pokemon-index.json/backgrounds.json이 채워지면 이 목업 카탈로그를
   실제 데이터로 교체하면 됨
════════════════════════════════════════ */
import { initFilterBar, applyFilters } from './search.js';

const MOCK_NAMES = ['Charizard', 'Mewtwo', 'Pikachu', 'Rayquaza', 'Groudon', 'Kyogre'];
const MOCK_TYPES = ['normal', 'shiny', 'costume', 'gmax', 'legendary'];

let idCounter = 0;
const MOCK_CATALOG = [];
MOCK_NAMES.forEach(name => {
  MOCK_TYPES.forEach(type => {
    [false, true].forEach(hasBackground => {
      MOCK_CATALOG.push({
        id: `mock-${idCounter++}`,
        name,
        isNormal:    type === 'normal',
        isShiny:     type === 'shiny',
        isCostume:   type === 'costume',
        isGmax:      type === 'gmax',
        isLegendary: type === 'legendary',
        hasBackground
      });
    });
  });
});

const TYPE_COLOR = { normal: '#facc15', shiny: '#ffffff', costume: '#38bdf8', gmax: '#ef4444', legendary: '#a78bfa' };
function typeColor(e) {
  if (e.isLegendary) return TYPE_COLOR.legendary;
  if (e.isGmax)      return TYPE_COLOR.gmax;
  if (e.isCostume)   return TYPE_COLOR.costume;
  if (e.isShiny)     return TYPE_COLOR.shiny;
  return TYPE_COLOR.normal;
}

const selectedIds = new Set();
let filterBarReady = false;

export function renderInventory() {
  if (!filterBarReady) {
    initFilterBar(document.getElementById('inventory-filters'), renderInventory);
    filterBarReady = true;
  }
  const entries = MOCK_CATALOG.map(e => ({ ...e, selected: selectedIds.has(e.id) }));
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
  cell.style.background = e.hasBackground ? '#000000' : '#374151';
  cell.title = e.name;

  const tri = document.createElement('div');
  tri.style.width = '0';
  tri.style.height = '0';
  tri.style.borderLeft = '16px solid transparent';
  tri.style.borderRight = '16px solid transparent';
  tri.style.borderBottom = `28px solid ${typeColor(e)}`;
  cell.appendChild(tri);

  cell.onclick = () => {
    if (selectedIds.has(e.id)) selectedIds.delete(e.id); else selectedIds.add(e.id);
    renderInventory();
  };

  return cell;
}

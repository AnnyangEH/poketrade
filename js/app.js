// DEPRECATED 2026-07-16 - 예약 시스템 복구로 인해 재고 그리드 관련 부분만 주석처리
/* ════════════════════════════════════════
   전역 상태 / 탭 라우팅
   2026-07-16 - Firebase 제거, 전부 로컬 저장(localStorage)으로 전환.
   로그인 불필요, 기기 밖으로 데이터가 나가지 않음.
════════════════════════════════════════ */
// import { renderInventory } from './inventory.js'; // DEPRECATED 2026-07-16 - 예약 시스템 복구로 인해 주석처리
import { renderReservations, initReservationForm } from './reservation.js';
import './i18n.js';

/* ════════════════════════════════════════
   정적 데이터 (Pokemon 인덱스 / 배경)
════════════════════════════════════════ */
export let pokemonIndex = [];
export let backgrounds  = [];
export let fullDex      = []; // 전체 1~1025 도감 (dexId, name_ko, name_en) — 예약 폼의 포켓몬 검색용
const staticDataReady = Promise.all([
  fetch('data/pokemon-index.json').then(r => r.json()),
  fetch('data/backgrounds.json').then(r => r.json()),
  fetch('data/pokemon-full-dex.json').then(r => r.json())
]).then(([idx, bg, full]) => { pokemonIndex = idx; backgrounds = bg; fullDex = full; });

/* ════════════════════════════════════════
   상태 — localStorage에서 읽고 씀 (동기, 즉시)
════════════════════════════════════════ */
const LOCAL_KEYS = { inventory: 'poketrade_inventory', reservations: 'poketrade_reservations' };

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export let inventory = loadLocal(LOCAL_KEYS.inventory, {});    // dexId 단위 수량 맵
export let reservations = loadLocal(LOCAL_KEYS.reservations, []);

export function saveInventory() {
  localStorage.setItem(LOCAL_KEYS.inventory, JSON.stringify(inventory));
}
export function saveReservations() {
  localStorage.setItem(LOCAL_KEYS.reservations, JSON.stringify(reservations));
}

/* ════════════════════════════════════════
   초기화 — 로그인 없이 정적 데이터만 기다렸다가 바로 앱 표시
════════════════════════════════════════ */
(async () => {
  await staticDataReady;
  document.getElementById('app').classList.remove('hidden');
  initReservationForm();
  switchTab('reservation');
})();

/* ════════════════════════════════════════
   탭 전환
════════════════════════════════════════ */
window.switchTab = tab => {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`).classList.add('active');
  // if (tab === 'inventory')   renderInventory(); // DEPRECATED 2026-07-16 - 예약 시스템 복구로 인해 주석처리
  if (tab === 'reservation') renderReservations();
};

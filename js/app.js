/* ════════════════════════════════════════
   전역 상태 / 탭 라우팅
════════════════════════════════════════ */
import {
  auth, db,
  doc, getDoc, setDoc,
  signInAnonymously, onAuthStateChanged,
  debounced, fsErr
  // onSnapshot, // 캘린더/예약 시스템 재활성화 시 필요
} from './firebase.js';
import { renderInventory } from './inventory.js';
// import { renderReservations, initReservationForm } from './reservation.js'; // 캘린더/예약 시스템 — 임시 비활성화

/* ════════════════════════════════════════
   정적 데이터 (Pokemon 인덱스 / 배경)
════════════════════════════════════════ */
export let pokemonIndex = [];
export let backgrounds  = [];
const staticDataReady = Promise.all([
  fetch('data/pokemon-index.json').then(r => r.json()),
  fetch('data/backgrounds.json').then(r => r.json())
]).then(([idx, bg]) => { pokemonIndex = idx; backgrounds = bg; });

/* ════════════════════════════════════════
   상태
════════════════════════════════════════ */
export let inventory = {};
// export let reservations = []; // 캘린더/예약 시스템 — 임시 비활성화
export let currentUser = null;

/* ════════════════════════════════════════
   Firestore 문서 참조
════════════════════════════════════════ */
export const invDoc = () => doc(db, 'users', currentUser.uid, 'inventory', 'data');
// export const resDoc = () => doc(db, 'users', currentUser.uid, 'reservations', 'data'); // 캘린더/예약 시스템 — 임시 비활성화

/* ════════════════════════════════════════
   저장
════════════════════════════════════════ */
export function saveInventory() { debounced('inv', () => setDoc(invDoc(), inventory).catch(fsErr('재고'))); }
// export function saveReservations() { debounced('res', () => setDoc(resDoc(), { items: reservations }).catch(fsErr('예약'))); } // 캘린더/예약 시스템 — 임시 비활성화

/* ════════════════════════════════════════
   초기 로드 — 재고는 단일 문서를 1회만 읽는다 (실시간 구독 없음)
════════════════════════════════════════ */
async function loadData() {
  const invSnap = await getDoc(invDoc());
  inventory = invSnap.exists() ? invSnap.data() : {};

  // const resSnap = await getDoc(resDoc());
  // reservations = resSnap.exists() ? (resSnap.data().items || []) : [];
  // onSnapshot(resDoc(), snap => {
  //   reservations = snap.exists() ? (snap.data().items || []) : [];
  //   if (!document.getElementById('section-reservation').classList.contains('hidden')) renderReservations();
  // }, fsErr('예약 리스너')); // 캘린더/예약 시스템 — 임시 비활성화
}

/* ════════════════════════════════════════
   인증 — 테스트 빌드: 로그인 화면 없이 익명 인증으로 자동 로그인
════════════════════════════════════════ */
signInAnonymously(auth).catch(e => {
  console.error('익명 로그인 실패:', e);
  document.getElementById('auth-error-detail').textContent = `${e.code || ''} ${e.message || e}`;
  document.getElementById('auth-error').classList.remove('hidden');
  document.getElementById('auth-error').classList.add('flex');
});

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    document.getElementById('app').classList.remove('hidden');

    await staticDataReady;
    await loadData();
    // initReservationForm(); // 캘린더/예약 시스템 — 임시 비활성화
    switchTab('inventory');
  } else {
    currentUser = null;
    document.getElementById('app').classList.add('hidden');
  }
});

/* ════════════════════════════════════════
   탭 전환
════════════════════════════════════════ */
window.switchTab = tab => {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'inventory')   renderInventory();
  // if (tab === 'reservation') renderReservations(); // 캘린더/예약 시스템 — 임시 비활성화
};

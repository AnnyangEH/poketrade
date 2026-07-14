/* ════════════════════════════════════════
   전역 상태 / 탭 라우팅 / 장부 / 대시보드
════════════════════════════════════════ */
import {
  auth, db,
  doc, getDoc, setDoc, onSnapshot,
  signInAnonymously, onAuthStateChanged,
  debounced, fsErr
} from './firebase.js';
import { renderReservations, initReservationForm } from './reservation.js';
import { renderInventory } from './inventory.js';
import './price.js';

/* ════════════════════════════════════════
   상수
════════════════════════════════════════ */
export const WEEK_DAYS = ['일','월','화','수','목','금','토'];

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
export let inventory = {}, ledger = [], reservations = [];
export let currentUser = null;

/* ════════════════════════════════════════
   Firestore 문서 참조
════════════════════════════════════════ */
export const invDoc  = () => doc(db, 'users', currentUser.uid, 'inventory',    'data');
export const ledDoc  = () => doc(db, 'users', currentUser.uid, 'ledger',       'data');
export const resDoc  = () => doc(db, 'users', currentUser.uid, 'reservations', 'data');

/* ════════════════════════════════════════
   저장
════════════════════════════════════════ */
export function saveInventory()    { debounced('inv', () => setDoc(invDoc(), inventory).catch(fsErr('재고'))); }
export function saveLedger()       { debounced('led', () => setDoc(ledDoc(), { entries: ledger }).catch(fsErr('장부'))); }
export function saveReservations() { debounced('res', () => setDoc(resDoc(), { items: reservations }).catch(fsErr('예약'))); }

/* ════════════════════════════════════════
   품목 라벨 (dexId_formId_backgroundId → 표시용 이름)
════════════════════════════════════════ */
export function itemLabel(itemKey) {
  if (!itemKey || !itemKey.includes('_')) return itemKey || '';
  const [dexId, formId, backgroundId] = itemKey.split('_');
  const p = pokemonIndex.find(x => String(x.dexId) === dexId);
  const f = p && p.forms.find(x => x.formId === formId);
  if (!p || !f) return itemKey;
  const bg = backgrounds.find(x => String(x.id) === backgroundId);
  return `${p.name_ko} ${f.name}${bg ? ' · ' + bg.name : ''}`;
}

/* ════════════════════════════════════════
   품목 선택 <select> 채우기 (보관함 기준, 장부/예약 공용)
════════════════════════════════════════ */
export function populateInventorySelect(selectEl) {
  selectEl.innerHTML = '';
  const keys = Object.keys(inventory).sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)));
  if (keys.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '보관함이 비어 있습니다';
    selectEl.appendChild(opt);
    return;
  }
  keys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = itemLabel(key);
    selectEl.appendChild(opt);
  });
}

/* ════════════════════════════════════════
   초기 로드 + localStorage 마이그레이션
   재고는 단일 문서를 1회만 읽는다 (실시간 구독 없음)
════════════════════════════════════════ */
async function loadData() {
  /* 마이그레이션: localStorage → Firestore (최초 1회) */
  if (!localStorage.getItem('fb_migrated')) {
    const lsInv = localStorage.getItem('inventory');
    const lsLed = localStorage.getItem('ledger');
    const lsRes = localStorage.getItem('reservations');
    if (lsInv || lsLed || lsRes) {
      if (lsInv) await setDoc(invDoc(), JSON.parse(lsInv));
      if (lsLed) await setDoc(ledDoc(), { entries: JSON.parse(lsLed) });
      if (lsRes) await setDoc(resDoc(), { items:   JSON.parse(lsRes) });
      localStorage.clear();
      localStorage.setItem('fb_migrated', '1');
    }
  }

  /* 초기 1회 getDoc — 재고는 이후로도 재구독하지 않는다 */
  const [invSnap, ledSnap, resSnap] = await Promise.all([
    getDoc(invDoc()), getDoc(ledDoc()), getDoc(resDoc())
  ]);
  inventory    = invSnap.exists() ? invSnap.data()              : {};
  ledger       = ledSnap.exists() ? (ledSnap.data().entries || []) : [];
  reservations = resSnap.exists() ? (resSnap.data().items   || []) : [];

  /* 실시간 onSnapshot — 장부/예약만 유지 */
  onSnapshot(ledDoc(), snap => {
    ledger = snap.exists() ? (snap.data().entries || []) : [];
    renderLedger();
    if (!document.getElementById('section-dashboard').classList.contains('hidden')) renderDashboard();
  }, fsErr('장부 리스너'));
  onSnapshot(resDoc(), snap => {
    reservations = snap.exists() ? (snap.data().items || []) : [];
    if (!document.getElementById('section-reservation').classList.contains('hidden')) renderReservations();
  }, fsErr('예약 리스너'));
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
    initLedgerForm();
    initReservationForm();
    renderLedger();
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
  if (tab === 'ledger')      populateInventorySelect(document.getElementById('form-item'));
  if (tab === 'dashboard')   renderDashboard();
  if (tab === 'reservation') renderReservations();
};

/* ════════════════════════════════════════
   장부 (거래내역) — 금액 없이 날짜/품목/메모/상태만 기록
════════════════════════════════════════ */
function initLedgerForm() {
  const d = new Date();
  document.getElementById('form-date').value =
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  populateInventorySelect(document.getElementById('form-item'));
}

window.addEntry = () => {
  const date = document.getElementById('form-date').value;
  const item = document.getElementById('form-item').value;
  const memo = document.getElementById('form-memo').value.trim();
  if (!date) { alert('날짜를 입력해주세요.'); return; }
  if (!item) { alert('품목을 선택해주세요.'); return; }

  ledger.push({ id: Date.now().toString(), date, item, memo, status: '활성' });
  saveLedger();

  document.getElementById('form-memo').value = '';
  renderLedger();
};

window.completeLedgerEntry = id => {
  const e = ledger.find(x => x.id === id);
  if (!e) return;
  if (!confirm('이 거래를 완료 처리하시겠습니까?\n→ 보관함 수량이 1개 차감됩니다.')) return;
  if (inventory[e.item]) {
    inventory[e.item].qty = Math.max(0, (inventory[e.item].qty || 0) - 1);
    saveInventory();
  }
  e.status = '완료';
  saveLedger();
  renderLedger();
};

window.cancelLedgerEntry = id => {
  const e = ledger.find(x => x.id === id);
  if (!e) return;
  if (!confirm('이 거래를 취소하시겠습니까?')) return;
  e.status = '취소';
  saveLedger();
  renderLedger();
};

window.deleteEntry = id => {
  if (!confirm('이 거래를 삭제하시겠습니까?')) return;
  ledger = ledger.filter(e => e.id !== id);
  saveLedger(); renderLedger();
};

export function renderLedger() {
  const tbody = document.getElementById('ledger-tbody');
  const empty = document.getElementById('ledger-empty');
  tbody.innerHTML = '';
  const sorted = [...ledger].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  sorted.forEach(e => {
    const badgeCls = e.status === '완료' ? 'bg-green-100 text-green-700'
                    : e.status === '취소' ? 'bg-gray-200 text-gray-500'
                    : 'bg-blue-100 text-blue-700';
    const actions = e.status === '활성'
      ? `<button onclick="completeLedgerEntry('${e.id}')" class="text-[11px] bg-green-50 hover:bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">완료</button>
         <button onclick="cancelLedgerEntry('${e.id}')" class="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">취소</button>`
      : '';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">${e.date}</td>
      <td class="px-2 py-2 text-xs font-medium">${itemLabel(e.item)}</td>
      <td class="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">${e.memo || '—'}</td>
      <td class="px-2 py-2"><span class="px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls}">${e.status}</span></td>
      <td class="px-2 py-2 text-right whitespace-nowrap space-x-1">
        ${actions}
        <button onclick="deleteEntry('${e.id}')" class="text-gray-300 hover:text-red-500 text-sm font-bold leading-none">✕</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ════════════════════════════════════════
   대시보드
════════════════════════════════════════ */
function renderDashboard() {
  const totalQty = Object.values(inventory).reduce((sum, it) => sum + (it && it.qty ? it.qty : 0), 0);
  document.getElementById('dash-qty').textContent = totalQty;
}

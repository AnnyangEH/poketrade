/* ════════════════════════════════════════
   예약 / 달력 — dexId 기반 교환 예약 (받을 포켓몬 / 줄 포켓몬)
════════════════════════════════════════ */
import { fullDex, inventory, saveInventory, reservations, saveReservations } from './app.js';
import { t } from './i18n.js';

/* ════════════════════════════════════════
   이미지 — PokeMiners 아이콘, 없으면 텍스트로 대체
════════════════════════════════════════ */
const POKEMINERS_BASE = 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Pokemon/Addressable Assets';
function spriteUrl(dexId, shiny) {
  return `${encodeURI(POKEMINERS_BASE)}/pm${dexId}${shiny ? '.s' : ''}.icon.png`;
}
function pokemonName(dexId) {
  const p = fullDex.find(x => x.dexId === Number(dexId));
  return p ? p.name_ko : `#${dexId}`;
}

/* ════════════════════════════════════════
   헬퍼
════════════════════════════════════════ */
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getDday(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}
function formatDateKR(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}(${t('weekDays')[d.getDay()]})`;
}
function badgeTags(r) {
  const tags = [];
  if (r.isGuaranteedLucky) tags.push(t('checkGuaranteedLucky'));
  if (r.isLuckyTrinket)    tags.push(t('checkLuckyTrinket'));
  return tags.map(tag => `<span class="text-[10px] bg-gray-100 text-gray-600 rounded px-1 ml-0.5">${tag}</span>`).join('');
}

/* ════════════════════════════════════════
   메모 자동완성 히스토리 (localStorage)
════════════════════════════════════════ */
const MEMO_HISTORY_KEYS = { receive: 'poketrade_receive_memo_history', give: 'poketrade_give_memo_history' };

function loadMemoHistory(side) {
  try { return JSON.parse(localStorage.getItem(MEMO_HISTORY_KEYS[side])) || []; }
  catch { return []; }
}
function saveMemoHistory(side, memo) {
  if (!memo) return;
  let list = loadMemoHistory(side).filter(m => m !== memo);
  list.unshift(memo);
  list = list.slice(0, 20);
  localStorage.setItem(MEMO_HISTORY_KEYS[side], JSON.stringify(list));
  populateMemoDatalist(side);
}
function populateMemoDatalist(side) {
  const listId = side === 'receive' ? 'receive-memo-history' : 'give-memo-history';
  const datalist = document.getElementById(listId);
  if (!datalist) return;
  datalist.innerHTML = '';
  loadMemoHistory(side).forEach(memo => {
    const opt = document.createElement('option');
    opt.value = memo;
    datalist.appendChild(opt);
  });
}

/* ════════════════════════════════════════
   포켓몬 검색 피커 (이름/번호 검색 → 최대 10개 결과)
   받을 포켓몬 / 줄 포켓몬 둘 다 이 함수로 만듦
════════════════════════════════════════ */
function wirePokemonPicker(inputId, resultsId) {
  const input   = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return null;

  let selectedDexId = null;

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { results.classList.add('hidden'); return; }

    const matches = fullDex.filter(p =>
      p.name_ko.toLowerCase().includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      String(p.dexId).includes(q)
    ).slice(0, 10);

    if (matches.length === 0) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');

    matches.forEach(p => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-sm';

      const img = document.createElement('img');
      img.src = spriteUrl(p.dexId, false);
      img.className = 'w-6 h-6 object-contain flex-shrink-0';
      img.onerror = () => img.remove();

      const label = document.createElement('span');
      label.textContent = `${p.name_ko} #${p.dexId}`;

      row.append(img, label);
      row.onclick = () => {
        selectedDexId = p.dexId;
        input.value = `${p.name_ko} #${p.dexId}`;
        results.classList.add('hidden');
      };
      results.appendChild(row);
    });
  }

  input.addEventListener('input', () => {
    selectedDexId = null;
    renderResults(input.value);
  });
  input.addEventListener('focus', () => renderResults(input.value));
  document.addEventListener('click', e => {
    if (e.target !== input && !results.contains(e.target)) results.classList.add('hidden');
  });

  return {
    getDexId: () => selectedDexId,
    reset: () => { input.value = ''; selectedDexId = null; results.innerHTML = ''; results.classList.add('hidden'); }
  };
}

let receivePicker = null;
let givePicker = null;

/* ════════════════════════════════════════
   폼 초기화
════════════════════════════════════════ */
export function initReservationForm() {
  receivePicker = wirePokemonPicker('res-receive-search', 'res-receive-results');
  givePicker    = wirePokemonPicker('res-give-search', 'res-give-results');
  populateMemoDatalist('receive');
  populateMemoDatalist('give');
}

window.addReservation = () => {
  const date    = document.getElementById('res-date').value.trim();
  const buyer   = document.getElementById('res-buyer').value.trim();
  const receiveDexId = receivePicker && receivePicker.getDexId();
  const giveDexId    = givePicker && givePicker.getDexId();
  const receiveMemo  = document.getElementById('res-receive-memo').value.trim();
  const giveMemo     = document.getElementById('res-give-memo').value.trim();
  const isGuaranteedLucky = document.getElementById('res-guaranteed-lucky').checked;
  const isLuckyTrinket    = document.getElementById('res-lucky-trinket').checked;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00').getTime())) { alert(t('alertDate')); return; }
  if (!buyer) { alert(t('alertBuyer')); return; }
  if (!receiveDexId) { alert(t('alertReceive')); return; }
  if (!giveDexId)    { alert(t('alertGive')); return; }

  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  if (!isWeekend) {
    const isFriday = dow === 5;
    const maxCount = isFriday ? 3 : 1;
    const existing = reservations.filter(r => r.tradeDate === date && r.status !== '취소');
    if (existing.length >= maxCount) {
      const names = [...new Set(existing.map(r => r.buyer))].join(', ');
      if (!confirm(t('confirmQuota')(names))) return;
    }
  }

  reservations.push({
    id: Date.now().toString(),
    buyer,
    tradeDate: date,
    receiveDexId, giveDexId,
    receiveMemo, giveMemo,
    isGuaranteedLucky, isLuckyTrinket,
    status: '활성'
  });
  saveReservations();
  saveMemoHistory('receive', receiveMemo);
  saveMemoHistory('give', giveMemo);

  document.getElementById('res-date').value = '';
  document.getElementById('res-buyer').value = '';
  document.getElementById('res-receive-memo').value = '';
  document.getElementById('res-give-memo').value = '';
  if (receivePicker) receivePicker.reset();
  if (givePicker) givePicker.reset();
  document.getElementById('res-guaranteed-lucky').checked = false;
  document.getElementById('res-lucky-trinket').checked = false;
  renderReservations();
};

window.completeReservation = id => {
  const r = reservations.find(r => r.id === id);
  if (!r) return;
  if (!confirm(t('confirmComplete')(r.buyer))) return;

  if (!inventory[r.giveDexId]) inventory[r.giveDexId] = { qty: 0 };
  inventory[r.giveDexId].qty = Math.max(0, (inventory[r.giveDexId].qty || 0) - 1);
  saveInventory();

  r.status = '완료';
  saveReservations();
  renderReservations();
};

window.cancelReservation = id => {
  const r = reservations.find(r => r.id === id);
  if (!r) return;
  if (!confirm(t('confirmCancel')(r.buyer))) return;

  if (r.status === '완료' && inventory[r.giveDexId]) {
    inventory[r.giveDexId].qty = (inventory[r.giveDexId].qty || 0) + 1;
    saveInventory();
  }
  r.status = '취소';
  saveReservations();
  renderReservations();
};

window.resetAllReservations = () => {
  if (!confirm(t('confirmResetAll'))) return;
  reservations.length = 0;
  saveReservations();
  renderReservations();
  closeSettings();
};

/* ════════════════════════════════════════
   확반(Guaranteed Lucky) 연도별 사용 횟수
   포켓몬고 자체에는 이 카운트가 안 보여서 직접 추적
════════════════════════════════════════ */
function renderGuaranteedLuckyCount() {
  const el = document.getElementById('guaranteed-lucky-count');
  if (!el) return;
  const year = new Date().getFullYear();
  const count = reservations.filter(r =>
    r.isGuaranteedLucky &&
    r.status !== '취소' &&
    r.tradeDate && new Date(r.tradeDate + 'T00:00:00').getFullYear() === year
  ).length;
  el.textContent = `(${count})`;
}

/* ════════════════════════════════════════
   렌더링
════════════════════════════════════════ */
export function renderReservations() {
  renderCalendar();
  renderUpcomingList();
  renderCompletedList();
  renderGuaranteedLuckyCount();
}

window.addEventListener('languagechange', () => renderReservations());

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const today = new Date(); today.setHours(0,0,0,0);
  const dow = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + offset);

  const countMap = {};
  const guaranteedLuckyMap = {}, luckyTrinketMap = {};
  reservations.filter(r => r.status !== '취소').forEach(r => {
    if (!r.tradeDate) return;
    countMap[r.tradeDate] = (countMap[r.tradeDate] || 0) + 1;
    if (r.isGuaranteedLucky) guaranteedLuckyMap[r.tradeDate] = true;
    if (r.isLuckyTrinket)    luckyTrinketMap[r.tradeDate] = true;
  });

  const endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 34);
  const titleEl = document.getElementById('cal-title');
  if (titleEl) {
    const sm = startDate.getMonth() + 1, em = endDate.getMonth() + 1;
    titleEl.textContent = sm === em
      ? `${startDate.getFullYear()}년 ${sm}월`
      : `${startDate.getFullYear()}년 ${sm}~${em}월`;
  }

  for (let i = 0; i < 35; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr   = toLocalDateStr(date);
    const count     = countMap[dateStr] || 0;
    const isPast    = date < today;
    const isToday   = date.getTime() === today.getTime();
    const dayOfWeek = date.getDay();
    const isFriday  = dayOfWeek === 5;
    const isSat     = dayOfWeek === 6;
    const isSun     = dayOfWeek === 0;
    const isWeekend = isSat || isSun;
    const exceeded  = !isWeekend && count > (isFriday ? 3 : 1);

    const cell = document.createElement('div');
    cell.className = 'cal-cell rounded-lg text-center py-1 px-0.5 relative flex flex-col items-center justify-center gap-px cursor-pointer';

    if (isPast)         cell.style.cssText = 'background:#f9fafb;opacity:0.45';
    else if (count === 0) cell.style.background = '#f3f4f6';
    else if (count === 1) cell.style.background = 'rgba(239,68,68,0.3)';
    else                  cell.style.background = 'rgba(239,68,68,0.6)';

    if (guaranteedLuckyMap[dateStr]) cell.style.boxShadow = 'inset 0 0 0 2px #eab308'; // 확반 = 노란 테두리

    const dayNum     = date.getDate();
    const displayDay = (i === 0 || dayNum === 1)
      ? `<span class="text-[9px] font-normal">${date.getMonth()+1}/</span>${dayNum}`
      : String(dayNum);
    const dayColor   = isToday ? 'text-blue-600 font-extrabold'
                     : isSun   ? 'text-red-500'
                     : isSat   ? 'text-blue-400'
                     : 'text-gray-600';
    const countHtml  = count > 0
      ? `<span class="text-[9px] leading-none ${exceeded ? 'text-red-700 font-bold' : 'text-gray-500'}">${exceeded ? '!' : count}건</span>`
      : '';
    const trinketHtml = luckyTrinketMap[dateStr] ? '<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500"></span>' : '';

    cell.innerHTML = `<span class="${dayColor} text-[11px] leading-tight">${displayDay}</span>${countHtml}${trinketHtml}`;
    cell.onclick = () => {
      const dateInput = document.getElementById('res-date');
      if (dateInput) dateInput.value = dateStr;
    };
    grid.appendChild(cell);
  }
}

function renderUpcomingList() {
  const container = document.getElementById('upcoming-list');
  const empty     = document.getElementById('upcoming-empty');
  if (!container) return;
  container.innerHTML = '';

  const active = reservations
    .filter(r => r.status === '활성')
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    .slice(0, 10);

  const countEl = document.getElementById('res-count');
  if (countEl) countEl.textContent = active.length ? `(${active.length}건)` : '';

  if (active.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  active.forEach(r => {
    const dday = getDday(r.tradeDate);
    let colorClass, ddayLabel;
    if (dday < 0)        { colorClass = 'text-gray-400';  ddayLabel = `D+${Math.abs(dday)}`; }
    else if (dday === 0) { colorClass = 'text-red-700';   ddayLabel = 'D-Day'; }
    else if (dday <= 3)  { colorClass = 'text-red-600';   ddayLabel = `D-${dday}`; }
    else if (dday <= 7)  { colorClass = 'text-orange-600';ddayLabel = `D-${dday}`; }
    else                 { colorClass = 'text-gray-600';  ddayLabel = `D-${dday}`; }

    const receiveText = r.receiveMemo ? `${pokemonName(r.receiveDexId)} (${r.receiveMemo})` : pokemonName(r.receiveDexId);
    const giveText    = r.giveMemo ? `${pokemonName(r.giveDexId)} (${r.giveMemo})` : pokemonName(r.giveDexId);

    const boldClass = dday === 0 ? 'font-bold' : '';
    const el = document.createElement('div');
    el.className = `py-2 flex items-start justify-between gap-2 ${dday < 0 ? 'opacity-60' : ''}`;
    el.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="${colorClass} ${boldClass} text-sm leading-snug">
          <span class="font-mono font-bold text-xs mr-0.5">[${ddayLabel}]</span>${formatDateKR(r.tradeDate)}
          <span class="font-medium ml-1">${t('receiveLabel')}: ${receiveText}</span>${badgeTags(r)}
          <span class="text-gray-400"> / ${t('giveLabel')}: ${giveText}</span>
        </p>
        <p class="${colorClass} text-xs mt-0.5 opacity-80">${t('buyerLabel')}: ${r.buyer}</p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0 pt-0.5">
        <button onclick="completeReservation('${r.id}')"
          class="text-[11px] bg-green-50 hover:bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium whitespace-nowrap">${t('btnComplete')}</button>
        <button onclick="cancelReservation('${r.id}')"
          class="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-500 px-2 py-0.5 rounded whitespace-nowrap">${t('btnCancel')}</button>
      </div>`;
    container.appendChild(el);
  });
}

function renderCompletedList() {
  const container = document.getElementById('completed-list');
  const empty     = document.getElementById('completed-empty');
  if (!container) return;
  container.innerHTML = '';

  const completed = reservations
    .filter(r => r.status === '완료')
    .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
    .slice(0, 20);

  const countEl = document.getElementById('completed-count');
  if (countEl) countEl.textContent = completed.length ? `(${completed.length}건)` : '';

  if (completed.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  completed.forEach(r => {
    const receiveText = r.receiveMemo ? `${pokemonName(r.receiveDexId)} (${r.receiveMemo})` : pokemonName(r.receiveDexId);
    const giveText    = r.giveMemo ? `${pokemonName(r.giveDexId)} (${r.giveMemo})` : pokemonName(r.giveDexId);

    const el = document.createElement('div');
    el.className = 'py-2 flex items-start justify-between gap-2';
    el.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-gray-600 text-sm leading-snug">
          <span class="font-mono font-bold text-xs mr-0.5">${formatDateKR(r.tradeDate)}</span>
          <span class="font-medium ml-1">${t('receiveLabel')}: ${receiveText}</span>${badgeTags(r)}
          <span class="text-gray-400"> / ${t('giveLabel')}: ${giveText}</span>
        </p>
        <p class="text-gray-400 text-xs mt-0.5 opacity-80">${t('buyerLabel')}: ${r.buyer}</p>
      </div>
      <div class="flex-shrink-0 pt-0.5">
        <button onclick="cancelReservation('${r.id}')"
          class="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-500 px-2 py-0.5 rounded whitespace-nowrap">${t('btnCancel')}</button>
      </div>`;
    container.appendChild(el);
  });
}

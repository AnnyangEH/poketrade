/* ════════════════════════════════════════
   예약 / 달력 — 금액 없이 품목/일정/상태만 관리
════════════════════════════════════════ */
import {
  WEEK_DAYS,
  reservations, inventory,
  saveInventory, saveReservations, itemLabel, populateInventorySelect
} from './app.js';

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
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}(${WEEK_DAYS[d.getDay()]})`;
}

/* ════════════════════════════════════════
   폼 초기화 — 품목은 보관함에서 선택
════════════════════════════════════════ */
export function initReservationForm() {
  const sel = document.getElementById('res-item');
  if (!sel) return;
  populateInventorySelect(sel);
}

window.updateTradeDate = () => {
  const friendStart = document.getElementById('res-friendStart').value;
  const friendType  = document.getElementById('res-friendType').value;
  let tradeDate = '';
  if (friendType === '즉시') {
    tradeDate = toLocalDateStr(new Date());
  } else if (friendType && friendStart) {
    const base = new Date(friendStart + 'T00:00:00');
    base.setDate(base.getDate() + (friendType === '그레이트' ? 7 : 30));
    tradeDate = toLocalDateStr(base);
  }
  if (tradeDate) document.getElementById('res-tradeDate').value = tradeDate;
};

window.addReservation = () => {
  const buyer       = document.getElementById('res-buyer').value.trim();
  const platform    = document.getElementById('res-platform').value;
  const item        = document.getElementById('res-item').value;
  const friendStart = document.getElementById('res-friendStart').value;
  const friendType  = document.getElementById('res-friendType').value;
  const tradeDate   = document.getElementById('res-tradeDate').value;
  const notes       = document.getElementById('res-notes').value.trim();

  if (!buyer)     { alert('구매자를 입력해주세요.'); return; }
  if (!item)      { alert('품목을 선택해주세요.'); return; }
  if (!tradeDate) { alert('거래예정일을 입력해주세요.(친구타입을 선택하면 자동 계산됩니다.)'); return; }

  const d = new Date(tradeDate + 'T00:00:00');
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  if (!isWeekend) {
    const isFriday  = dow === 5;
    const maxCount  = isFriday ? 2 : 1;
    const curCount  = reservations.filter(r => r.tradeDate === tradeDate && r.status !== '취소').length;
    if (curCount >= maxCount) { alert('해당 날짜 특교 한도 초과'); return; }
  }

  reservations.push({
    id: Date.now().toString(),
    buyer, platform, item,
    friendStart, friendType, tradeDate,
    status: '활성', notes
  });
  saveReservations();

  ['res-buyer','res-friendStart','res-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('res-friendType').value = '';
  document.getElementById('res-tradeDate').value  = '';
  renderReservations();
};

window.completeReservation = id => {
  const r = reservations.find(r => r.id === id);
  if (!r) return;
  if (!confirm(`${r.buyer}님 예약 완료 처리?\n→ 보관함 수량이 1개 차감됩니다.`)) return;

  if (r.item && inventory[r.item]) {
    inventory[r.item].qty = Math.max(0, (inventory[r.item].qty || 0) - 1);
    saveInventory();
  }
  r.status = '완료';
  saveReservations();
  renderReservations();
};

window.cancelReservation = id => {
  const r = reservations.find(r => r.id === id);
  if (!r) return;
  if (!confirm(`${r.buyer}님 예약을 취소하시겠습니까?`)) return;
  r.status = '취소';
  saveReservations();
  renderReservations();
};

/* ════════════════════════════════════════
   렌더링
════════════════════════════════════════ */
export function renderReservations() {
  renderCalendar();
  renderUpcomingList();
}

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
  reservations.filter(r => r.status !== '취소').forEach(r => {
    if (r.tradeDate) countMap[r.tradeDate] = (countMap[r.tradeDate] || 0) + 1;
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
    const exceeded  = !isWeekend && count > (isFriday ? 2 : 1);

    const cell = document.createElement('div');
    cell.className = 'cal-cell rounded-lg text-center py-1 px-0.5 relative flex flex-col items-center justify-center gap-px';

    if (isPast)         cell.style.cssText = 'background:#f9fafb;opacity:0.45';
    else if (count === 0) cell.style.background = '#f3f4f6';
    else if (count === 1) cell.style.background = 'rgba(239,68,68,0.3)';
    else                  cell.style.background = 'rgba(239,68,68,0.6)';

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

    cell.innerHTML = `<span class="${dayColor} text-[11px] leading-tight">${displayDay}</span>${countHtml}`;
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

    const boldClass = dday === 0 ? 'font-bold' : '';
    const el = document.createElement('div');
    el.className = `py-2 flex items-start justify-between gap-2 ${dday < 0 ? 'opacity-60' : ''}`;
    el.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="${colorClass} ${boldClass} text-sm leading-snug">
          <span class="font-mono font-bold text-xs mr-0.5">[${ddayLabel}]</span>${formatDateKR(r.tradeDate)}
          <span class="font-medium ml-1">${r.platform}</span> — <span>${itemLabel(r.item)}</span>
        </p>
        <p class="${colorClass} text-xs mt-0.5 opacity-80">
          구매자: ${r.buyer}${r.notes ? ` / ${r.notes}` : ''}
        </p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0 pt-0.5">
        <button onclick="completeReservation('${r.id}')"
          class="text-[11px] bg-green-50 hover:bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium whitespace-nowrap">완료</button>
        <button onclick="cancelReservation('${r.id}')"
          class="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-500 px-2 py-0.5 rounded whitespace-nowrap">취소</button>
      </div>`;
    container.appendChild(el);
  });
}

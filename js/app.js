/* ════════════════════════════════════════
   레이드 패스 소모량 카운터 — 14개 계정 x 오전/오후 두 페이즈
   전부 로컬 저장(localStorage), 로그인/서버 없음.
════════════════════════════════════════ */
const ACCOUNT_COUNT = 14;
const PHASES = {
  morning: { key: 'morningCount', max: 24, label: '오전' },
  evening: { key: 'eveningCount', max: 12, label: '오후' }
};

const ACCOUNTS_KEY = 'raidpass_accounts';
const PHASE_KEY    = 'raidpass_active_phase';

function loadAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
    if (Array.isArray(parsed) && parsed.length === ACCOUNT_COUNT) return parsed;
  } catch {}
  return Array.from({ length: ACCOUNT_COUNT }, (_, i) => ({ id: i + 1, morningCount: 0, eveningCount: 0 }));
}
function saveAccounts() {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

let accounts    = loadAccounts();
let activePhase = localStorage.getItem(PHASE_KEY) === 'evening' ? 'evening' : 'morning';
const selected  = new Set();

function currentPhase() {
  return PHASES[activePhase];
}

/* ════════════════════════════════════════
   렌더링
════════════════════════════════════════ */
function render() {
  const phase = currentPhase();

  const toggleBtn = document.getElementById('phase-toggle-btn');
  toggleBtn.textContent = `${phase.label} (Max ${phase.max})`;

  accounts.forEach(acc => {
    const card    = document.getElementById(`card-${acc.id}`);
    const countEl = document.getElementById(`count-${acc.id}`);
    const barEl   = document.getElementById(`bar-${acc.id}`);
    const value    = acc[phase.key];
    const complete = value >= phase.max;

    countEl.textContent = `${value}/${phase.max}`;
    barEl.style.width = `${Math.min(100, (value / phase.max) * 100)}%`;

    card.classList.toggle('is-selected', selected.has(acc.id) && !complete);
    card.classList.toggle('is-complete', complete);
  });
}

function buildGrid() {
  const grid = document.getElementById('account-grid');
  grid.innerHTML = '';
  accounts.forEach(acc => {
    const card = document.createElement('div');
    card.id = `card-${acc.id}`;
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-num">#${acc.id}</div>
      <div class="account-count" id="count-${acc.id}"></div>
      <div class="account-bar-track"><div class="account-bar-fill" id="bar-${acc.id}"></div></div>
      <div class="account-done-badge">DONE</div>
    `;
    card.addEventListener('click', () => {
      if (selected.has(acc.id)) selected.delete(acc.id);
      else selected.add(acc.id);
      render();
    });
    grid.appendChild(card);
  });
}

/* ════════════════════════════════════════
   선택된 계정 일괄 증감 — 상한 도달 시 해당 계정만 증가 무시
════════════════════════════════════════ */
function adjustSelected(delta) {
  const phase = currentPhase();
  let changed = false;

  selected.forEach(id => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (delta > 0 && acc[phase.key] >= phase.max) return; // 완료된 계정은 증가 차단
    acc[phase.key] = Math.max(0, Math.min(phase.max, acc[phase.key] + delta));
    changed = true;
  });

  if (changed) { saveAccounts(); render(); }
}

/* ════════════════════════════════════════
   페이즈 토글
════════════════════════════════════════ */
document.getElementById('phase-toggle-btn').addEventListener('click', () => {
  activePhase = activePhase === 'morning' ? 'evening' : 'morning';
  localStorage.setItem(PHASE_KEY, activePhase);
  render();
});

/* ════════════════════════════════════════
   전역 키보드 컨트롤
════════════════════════════════════════ */
window.addEventListener('keydown', e => {
  if (e.repeat) return; // 키를 누르고 있어도 한 번만 반응

  if (e.code === 'Space') {
    e.preventDefault();
    adjustSelected(1);
  } else if (e.key === 'Control') {
    adjustSelected(-1);
  } else if (e.key === 'Escape') {
    if (selected.size === 0) return;
    selected.clear();
    render();
  }
});

buildGrid();
render();

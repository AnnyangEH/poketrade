/* ════════════════════════════════════════
   레이드 패스 소모량 카운터 — 14개 계정 x 오전/오후 두 페이즈
   전부 로컬 저장(localStorage), 로그인/서버 없음.
════════════════════════════════════════ */
const ACCOUNT_COUNT = 14;
const PHASES = {
  morning: { key: 'morningCount', max: 24, label: '오전' },
  evening: { key: 'eveningCount', max: 12, label: '오후' }
};
const PREMIUM_PASS_MAX = 999999; // 안전 정수 범위(2^53) 안에서 충분히 여유 있는 상한

const ACCOUNTS_KEY = 'raidpass_accounts';
const PHASE_KEY    = 'raidpass_active_phase';

function loadAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
    if (Array.isArray(parsed) && parsed.length === ACCOUNT_COUNT) {
      parsed.forEach(acc => {
        if (typeof acc.nickname !== 'string') acc.nickname = '';
        if (typeof acc.premiumPassCount !== 'number' || !Number.isInteger(acc.premiumPassCount) || acc.premiumPassCount < 0) {
          acc.premiumPassCount = 0;
        } else if (acc.premiumPassCount > PREMIUM_PASS_MAX) {
          acc.premiumPassCount = PREMIUM_PASS_MAX;
        }
      });
      return parsed;
    }
  } catch {}
  return Array.from({ length: ACCOUNT_COUNT }, (_, i) => ({ id: i + 1, morningCount: 0, eveningCount: 0, nickname: '', premiumPassCount: 0 }));
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
    const card      = document.getElementById(`card-${acc.id}`);
    const labelEl   = document.getElementById(`label-${acc.id}`);
    const premiumEl = document.getElementById(`premium-${acc.id}`);
    const countEl   = document.getElementById(`count-${acc.id}`);
    const barEl     = document.getElementById(`bar-${acc.id}`);
    const value    = acc[phase.key];
    const complete = value >= phase.max;

    labelEl.textContent   = acc.nickname ? `#${acc.id} · ${acc.nickname}` : `#${acc.id}`;
    premiumEl.textContent = `프패 ${acc.premiumPassCount}`;
    countEl.textContent   = `${value}/${phase.max}`;
    barEl.style.width = `${Math.min(100, (value / phase.max) * 100)}%`;

    card.classList.toggle('is-selected', selected.has(acc.id) && !complete);
    card.classList.toggle('is-complete', complete);
  });
}

function editNickname(acc) {
  const input = prompt(`#${acc.id} 닉네임 (비우면 삭제)`, acc.nickname || '');
  if (input === null) return; // 취소
  acc.nickname = input.trim();
  saveAccounts();
  render();
}

function editPremiumPass(acc) {
  const input = prompt(`#${acc.id} 프리미엄 패스 개수`, String(acc.premiumPassCount));
  if (input === null) return; // 취소
  const trimmed = input.trim();
  // parseInt는 "12abc"→12, "1e10"→1 처럼 뒤에 붙은 문자를 조용히 무시해버려서
  // 숫자만으로 이루어진 문자열인지 정규식으로 먼저 검증
  if (!/^\d+$/.test(trimmed)) { alert('숫자만 입력해주세요 (예: 26).'); return; }
  const n = Number(trimmed);
  if (n > PREMIUM_PASS_MAX) { alert(`${PREMIUM_PASS_MAX} 이하로 입력해주세요.`); return; }
  acc.premiumPassCount = n;
  saveAccounts();
  render();
}

function buildGrid() {
  const grid = document.getElementById('account-grid');
  grid.innerHTML = '';
  accounts.forEach(acc => {
    const card = document.createElement('div');
    card.id = `card-${acc.id}`;
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-header">
        <span class="account-num" id="label-${acc.id}">#${acc.id}</span>
        <button type="button" class="account-edit-btn" data-role="nickname" title="닉네임 설정">✎</button>
      </div>
      <div class="account-premium-row">
        <span class="account-premium" id="premium-${acc.id}"></span>
        <button type="button" class="account-edit-btn" data-role="premium" title="프리미엄 패스 개수 설정">✎</button>
      </div>
      <div class="account-count-row">
        <span class="account-count" id="count-${acc.id}"></span>
        <span class="account-done-badge">DONE</span>
      </div>
      <div class="account-bar-track"><div class="account-bar-fill" id="bar-${acc.id}"></div></div>
    `;
    card.addEventListener('click', () => {
      if (selected.has(acc.id)) selected.delete(acc.id);
      else selected.add(acc.id);
      render();
    });
    card.querySelector('[data-role="nickname"]').addEventListener('click', e => {
      e.stopPropagation();
      editNickname(acc);
    });
    card.querySelector('[data-role="premium"]').addEventListener('click', e => {
      e.stopPropagation();
      editPremiumPass(acc);
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

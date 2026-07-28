/* ════════════════════════════════════════
   도감번호 추첨 트래커
   디시 댓글을 붙여넣으면 파싱해서 닉네임+응모번호 카드로 표시.
   당첨(정확 일치)=초록, 아까움(±5 이내)=주황, 그 외=기본.
   전부 로컬 저장(localStorage), 로그인/서버 없음.
════════════════════════════════════════ */

const WINNERS_KEY = 'pokequiz_winning_numbers';
const ENTRIES_KEY = 'pokequiz_entries';
const NEAR_MISS_RANGE = 5;

/* ════════════════════════════════════════
   상태
════════════════════════════════════════ */
function loadWinners() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WINNERS_KEY));
    if (Array.isArray(parsed)) return parsed.filter(n => Number.isInteger(n) && n >= 1 && n <= 1025);
  } catch {}
  return [];
}
function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ENTRIES_KEY));
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

let winningNumbers = loadWinners();
let entries        = loadEntries();
const nameCache     = {}; // dexId -> 한글 이름

function saveWinners() { localStorage.setItem(WINNERS_KEY, JSON.stringify(winningNumbers)); }
function saveEntries() { localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries)); }

/* ════════════════════════════════════════
   댓글 파싱
   "갤로그로 이동합니다." 줄을 앵커로 삼아 실제 댓글 블록만 추려낸다.
   (삭제 안내 줄 / 댓글돌이 캐러셀 / 파워링크 광고 블록은 이 문자열이
   없어서 자동으로 걸러짐)
════════════════════════════════════════ */
const GALLOG_MARKER = '갤로그로 이동합니다.';
const TIMESTAMP_RE  = /^\d{2}\.\d{2}\s+\d{2}:\d{2}(:\d{2})?$/;

function parseComments(raw) {
  const lines = raw.split('\n').map(l => l.trim());
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== GALLOG_MARKER) continue;

    let ni = i - 1;
    while (ni >= 0 && lines[ni] === '') ni--;
    const nickname = ni >= 0 ? lines[ni] : '(알 수 없음)';

    const content = [];
    let j = i + 1;
    while (j < lines.length && !TIMESTAMP_RE.test(lines[j])) {
      if (lines[j] !== '') content.push(lines[j]);
      j++;
    }
    const timestamp = j < lines.length ? lines[j] : '';

    result.push({
      nickname,
      dexId: extractDexGuess(content),
      timestamp,
      raw: content.join(' / ')
    });

    i = j; // 다음 블록 탐색은 타임스탬프 줄 다음부터
  }

  return result;
}

// 번호 뒤에 남는 꼬리 텍스트가 "번" / "- dc App" / 이모지성 문장부호 정도로만
// 이루어져 있으면 진짜 응모번호로 판단. 긴 문장이 붙어있으면(예: "200은 가볍게
// 넘는데 고닉이 아니네 ㅠ") 응모가 아니라 잡담으로 보고 버린다.
function isCleanTail(tail) {
  let t = tail;
  t = t.replace(/-\s*dc App/gi, '');
  t = t.replace(/번/g, '');
  t = t.replace(/[?!~.,]/g, '');
  t = t.replace(/ㅎ+/g, '');
  t = t.replace(/줄/g, '');
  t = t.replace(/\s+/g, '');
  return t === '';
}

function extractDexGuess(contentLines) {
  let best = null;
  let bestScore = -Infinity;

  contentLines.forEach(line => {
    const re = /(?:^|[^0-9A-Za-z])(\d{1,4})(?![0-9A-Za-z])/g;
    let m;
    while ((m = re.exec(line))) {
      const num = parseInt(m[1], 10);
      if (num < 1 || num > 1025) continue;

      const tail = line.slice(m.index + m[0].length);
      if (!isCleanTail(tail)) continue;

      const head = line.slice(0, m.index);
      const score = -(head.trim().length) - line.length;
      if (score > bestScore) { bestScore = score; best = num; }
    }
  });

  return best;
}

/* ════════════════════════════════════════
   포켓몬 이름 조회 (PokeAPI GraphQL, 파싱된 도감번호만 조회)
════════════════════════════════════════ */
const POKEAPI_URL = 'https://beta.pokeapi.co/graphql/v1beta';

async function fetchNames(dexIds) {
  const missing = [...new Set(dexIds)].filter(id => !(id in nameCache));
  if (missing.length === 0) return;

  const query = `{ pokemon_v2_pokemonspecies(where: {id: {_in: [${missing.join(',')}]}}) { id pokemon_v2_pokemonspeciesnames(where: {pokemon_v2_language: {name: {_eq: "ko"}}}) { name } } }`;

  try {
    const res = await fetch(POKEAPI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    (json.data?.pokemon_v2_pokemonspecies || []).forEach(p => {
      const nm = p.pokemon_v2_pokemonspeciesnames[0]?.name;
      nameCache[p.id] = nm || `#${p.id}`;
    });
  } catch {
    // 조회 실패해도 카드 자체는 도감번호로 표시되니 조용히 무시
  }
  missing.forEach(id => { if (!(id in nameCache)) nameCache[id] = `#${id}`; });
}

const POKEMINERS_BASE = 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Pokemon/Addressable Assets';
function spriteUrl(dexId) {
  return `${encodeURI(POKEMINERS_BASE)}/pm${dexId}.icon.png`;
}

/* ════════════════════════════════════════
   당첨/아까움 판정 + 정렬
════════════════════════════════════════ */
function tierFor(dexId) {
  if (dexId == null || winningNumbers.length === 0) return 'none';
  if (winningNumbers.includes(dexId)) return 'win';
  const minDist = Math.min(...winningNumbers.map(w => Math.abs(w - dexId)));
  return minDist <= NEAR_MISS_RANGE ? 'close' : 'none';
}

const TIER_RANK = { win: 0, close: 1, none: 2 };

function sortedEntries() {
  return [...entries].sort((a, b) =>
    TIER_RANK[tierFor(a.dexId)] - TIER_RANK[tierFor(b.dexId)] || a._order - b._order
  );
}

/* ════════════════════════════════════════
   렌더링
════════════════════════════════════════ */
function buildCard(entry) {
  const tier = tierFor(entry.dexId);
  const card = document.createElement('div');
  card.className = `entry-card tier-${tier}`;

  const nickEl = document.createElement('div');
  nickEl.className = 'entry-nickname';
  nickEl.textContent = entry.nickname;
  card.appendChild(nickEl);

  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'entry-sprite-wrap';
  if (entry.dexId != null) {
    const img = document.createElement('img');
    img.src = spriteUrl(entry.dexId);
    img.alt = `#${entry.dexId}`;
    img.className = 'entry-sprite';
    img.onerror = () => { img.style.display = 'none'; };
    spriteWrap.appendChild(img);
  } else {
    const noGuess = document.createElement('span');
    noGuess.className = 'entry-no-guess';
    noGuess.textContent = '번호 없음';
    spriteWrap.appendChild(noGuess);
  }
  card.appendChild(spriteWrap);

  if (entry.dexId != null) {
    const nameRow = document.createElement('div');
    nameRow.className = 'entry-name-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'entry-name';
    nameEl.textContent = nameCache[entry.dexId] || '';

    const dexEl = document.createElement('span');
    dexEl.className = 'entry-dex';
    dexEl.textContent = `#${entry.dexId}`;

    nameRow.append(nameEl, dexEl);
    card.appendChild(nameRow);
  }

  return card;
}

function render() {
  const grid  = document.getElementById('entry-grid');
  const empty = document.getElementById('entry-empty');
  grid.innerHTML = '';

  if (entries.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  sortedEntries().forEach(entry => grid.appendChild(buildCard(entry)));
}

/* ════════════════════════════════════════
   설정 UI 초기화
════════════════════════════════════════ */
['win-1', 'win-2', 'win-3'].forEach((id, i) => {
  const el = document.getElementById(id);
  if (winningNumbers[i] != null) el.value = winningNumbers[i];
});

document.getElementById('save-winners-btn').addEventListener('click', () => {
  const vals = ['win-1', 'win-2', 'win-3']
    .map(id => parseInt(document.getElementById(id).value, 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 1025);
  winningNumbers = vals;
  saveWinners();
  render();
});

document.getElementById('parse-btn').addEventListener('click', () => {
  const raw = document.getElementById('paste-area').value;
  const parsed = parseComments(raw);
  entries = parsed.map((e, i) => ({ ...e, _order: i }));
  saveEntries();

  const matched = entries.filter(e => e.dexId != null).length;
  document.getElementById('parse-summary').textContent =
    `${entries.length}개 댓글 파싱 완료 (번호 인식 ${matched}개 · 미인식 ${entries.length - matched}개)`;

  render();
  const uniqueIds = entries.filter(e => e.dexId != null).map(e => e.dexId);
  fetchNames(uniqueIds).then(render);
});

/* ════════════════════════════════════════
   초기 렌더 — 새로고침해도 이전 상태 유지
════════════════════════════════════════ */
render();
const initialIds = entries.filter(e => e.dexId != null).map(e => e.dexId);
if (initialIds.length) fetchNames(initialIds).then(render);

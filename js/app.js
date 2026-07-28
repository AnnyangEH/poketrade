/* ════════════════════════════════════════
   도감번호 추첨 트래커
   디시 댓글을 붙여넣으면 파싱해서 닉네임+응모번호 카드로 표시.
   당첨(정확 일치)=초록, 아까움(±5 이내)=주황, 그 외=기본.
   같은 당첨번호를 여러 명이 맞히면(교착) 회색/반투명으로 비활성화 표시.
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

// 문맥은 안 따지고 댓글 안에서 처음 발견되는 유효 범위(1~1025) 숫자를 그대로 씀.
// 애매한 것도 일단 다 넣고, 잘못 잡힌 건 카드의 쓰레기통 버튼으로 직접 지우는
// 방식으로 처리 (200처럼 잡담에 섞인 숫자나 909처럼 문장에 붙은 숫자도 포함됨)
function extractDexGuess(contentLines) {
  for (const line of contentLines) {
    const re = /(?:^|[^0-9A-Za-z])(\d{1,4})(?![0-9A-Za-z])/g;
    let m;
    while ((m = re.exec(line))) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 1025) return num;
    }
  }
  return null;
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

// PokeMiners(포켓몬GO 전용 아이콘)는 아직 GO에 없는 포켓몬(예: #1025)이나
// 특수 폼 네이밍(예: #670 플라엣테)에서 이미지가 아예 없는 경우가 있고
// 스프라이트마다 여백 비율도 제각각이라, 1~1025 전종을 항상 커버하고
// 캔버스 비율도 일관된 PokeAPI 공식 아트워크를 씀
const ARTWORK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
function spriteUrl(dexId) {
  return `${ARTWORK_BASE}/${dexId}.png`;
}

/* ════════════════════════════════════════
   당첨/아까움 판정 + 정렬 + 교착(중복 당첨) 판정
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

// 같은 당첨번호를 두 명 이상이 맞히면 랜덤 추첨으로 정해야 해서(교착),
// 해결(한 명만 남기고 지우기) 전까지는 흐리게 표시
function winCounts() {
  const counts = {};
  entries.forEach(e => {
    if (winningNumbers.includes(e.dexId)) counts[e.dexId] = (counts[e.dexId] || 0) + 1;
  });
  return counts;
}

function deleteEntry(order) {
  entries = entries.filter(e => e._order !== order);
  saveEntries();
  render();
}

/* ════════════════════════════════════════
   렌더링
════════════════════════════════════════ */
function buildCard(entry, contested) {
  const tier = tierFor(entry.dexId);
  const card = document.createElement('div');
  card.className = `entry-card tier-${tier}${contested ? ' contested' : ''}`;
  card.title = '클릭하면 원본 댓글 보기';

  const header = document.createElement('div');
  header.className = 'entry-header';

  const nickEl = document.createElement('span');
  nickEl.className = 'entry-nickname';
  nickEl.textContent = entry.nickname;
  header.appendChild(nickEl);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'entry-delete-btn';
  delBtn.title = '삭제';
  delBtn.textContent = '🗑';
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    deleteEntry(entry._order);
  });
  header.appendChild(delBtn);

  card.appendChild(header);

  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'entry-sprite-wrap';
  const img = document.createElement('img');
  img.src = spriteUrl(entry.dexId);
  img.alt = `#${entry.dexId}`;
  img.className = 'entry-sprite';
  img.onerror = () => { img.style.display = 'none'; };
  spriteWrap.appendChild(img);
  card.appendChild(spriteWrap);

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

  card.addEventListener('click', () => {
    alert(`${entry.nickname}\n\n"${entry.raw}"\n\n${entry.timestamp}`);
  });

  return card;
}

function render() {
  renderChart();

  const grid  = document.getElementById('entry-grid');
  const empty = document.getElementById('entry-empty');
  grid.innerHTML = '';

  if (entries.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const counts = winCounts();
  sortedEntries().forEach(entry => {
    const contested = winningNumbers.includes(entry.dexId) && counts[entry.dexId] > 1;
    grid.appendChild(buildCard(entry, contested));
  });
}

/* ════════════════════════════════════════
   가장 많이 나온 번호 도넛 차트
   상위 7개 + 나머지는 "기타"로 묶음. 색은 고정 순서 카테고리컬 팔레트.
════════════════════════════════════════ */
const CHART_HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];
const CHART_OTHER_COLOR = '#6b7280';
const CHART_TOP_N = 7;
const SVG_NS = 'http://www.w3.org/2000/svg';

function computeChartSlices() {
  const counts = {};
  entries.forEach(e => { counts[e.dexId] = (counts[e.dexId] || 0) + 1; });

  const sorted = Object.entries(counts)
    .map(([dexId, count]) => ({ dexId: Number(dexId), count }))
    .sort((a, b) => b.count - a.count || a.dexId - b.dexId);

  const top  = sorted.slice(0, CHART_TOP_N);
  const rest = sorted.slice(CHART_TOP_N);
  const otherCount = rest.reduce((sum, s) => sum + s.count, 0);

  const slices = top.map((s, i) => ({
    dexId: s.dexId,
    count: s.count,
    color: CHART_HUES[i],
    label: nameCache[s.dexId] ? `${nameCache[s.dexId]} #${s.dexId}` : `#${s.dexId}`
  }));
  if (otherCount > 0) {
    slices.push({ dexId: null, count: otherCount, color: CHART_OTHER_COLOR, label: `기타 (${rest.length}종)` });
  }
  return slices;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(cx, cy, outerR, innerR, startAngle, endAngle) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.999); // 100% 단일 슬라이스 대비
  const startOuter = polarToCartesian(cx, cy, outerR, clampedEnd);
  const endOuter    = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner  = polarToCartesian(cx, cy, innerR, startAngle);
  const endInner    = polarToCartesian(cx, cy, innerR, clampedEnd);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return [
    'M', startOuter.x, startOuter.y,
    'A', outerR, outerR, 0, largeArc, 0, endOuter.x, endOuter.y,
    'L', startInner.x, startInner.y,
    'A', innerR, innerR, 0, largeArc, 1, endInner.x, endInner.y,
    'Z'
  ].join(' ');
}

function showChartTooltip(e, slice, total) {
  const tooltip = document.getElementById('chart-tooltip');
  const pct = ((slice.count / total) * 100).toFixed(1);
  tooltip.innerHTML = '';

  const valueEl = document.createElement('div');
  valueEl.className = 'font-bold text-gray-100';
  valueEl.textContent = `${slice.count}명 (${pct}%)`;

  const labelEl = document.createElement('div');
  labelEl.className = 'text-gray-400';
  labelEl.textContent = slice.label;

  tooltip.append(valueEl, labelEl);
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top = `${e.clientY + 14}px`;
  tooltip.classList.remove('hidden');
}
function hideChartTooltip() {
  document.getElementById('chart-tooltip').classList.add('hidden');
}

function renderChart() {
  const chartCard = document.getElementById('chart-card');
  const svg       = document.getElementById('chart-svg');
  const legend    = document.getElementById('chart-legend');
  const totalEl   = document.getElementById('chart-total');

  const total = entries.length;
  if (total === 0) {
    chartCard.classList.add('hidden');
    return;
  }
  chartCard.classList.remove('hidden');
  totalEl.textContent = total;

  svg.innerHTML = '';
  legend.innerHTML = '';

  const slices = computeChartSlices();
  let angle = 0;

  slices.forEach(slice => {
    const sweep = (slice.count / total) * 360;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', donutSlicePath(100, 100, 90, 55, angle, angle + sweep));
    path.setAttribute('fill', slice.color);
    path.setAttribute('stroke', '#111827');
    path.setAttribute('stroke-width', '2');
    path.classList.add('chart-slice');
    path.addEventListener('pointermove', e => showChartTooltip(e, slice, total));
    path.addEventListener('pointerenter', e => showChartTooltip(e, slice, total));
    path.addEventListener('pointerleave', hideChartTooltip);
    svg.appendChild(path);

    angle += sweep;

    const row = document.createElement('div');
    row.className = 'chart-legend-row';
    const swatch = document.createElement('span');
    swatch.className = 'chart-legend-swatch';
    swatch.style.background = slice.color;
    const label = document.createElement('span');
    label.className = 'chart-legend-label';
    label.textContent = slice.label;
    const countEl = document.createElement('span');
    countEl.className = 'chart-legend-count';
    countEl.textContent = String(slice.count);
    row.append(swatch, label, countEl);
    legend.appendChild(row);
  });
}

/* ════════════════════════════════════════
   당첨번호 참조 카드 (설정한 번호 자체를 카드로 보여줌)
════════════════════════════════════════ */
function buildWinnerRefCard(dexId) {
  const card = document.createElement('div');
  card.className = 'winner-ref-card';

  const label = document.createElement('span');
  label.className = 'winner-ref-label';
  label.textContent = '당첨번호';
  card.appendChild(label);

  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'entry-sprite-wrap';
  const img = document.createElement('img');
  img.src = spriteUrl(dexId);
  img.alt = `#${dexId}`;
  img.className = 'entry-sprite';
  img.onerror = () => { img.style.display = 'none'; };
  spriteWrap.appendChild(img);
  card.appendChild(spriteWrap);

  const nameRow = document.createElement('div');
  nameRow.className = 'entry-name-row';
  const nameEl = document.createElement('span');
  nameEl.className = 'entry-name';
  nameEl.textContent = nameCache[dexId] || '';
  const dexEl = document.createElement('span');
  dexEl.className = 'entry-dex';
  dexEl.textContent = `#${dexId}`;
  nameRow.append(nameEl, dexEl);
  card.appendChild(nameRow);

  return card;
}

function renderWinnerRefs() {
  const grid = document.getElementById('winner-ref-grid');
  grid.innerHTML = '';
  winningNumbers.forEach(dexId => grid.appendChild(buildWinnerRefCard(dexId)));
}

/* ════════════════════════════════════════
   설정 패널 — 저장하면 접히고, "수정"으로 다시 펼침
════════════════════════════════════════ */
function updateSettingsVisibility() {
  const panel     = document.getElementById('settings-panel');
  const collapsed = document.getElementById('settings-collapsed');
  const hasWinners = winningNumbers.length > 0;

  panel.classList.toggle('hidden', hasWinners);
  collapsed.classList.toggle('hidden', !hasWinners);
  collapsed.classList.toggle('flex', hasWinners);
}

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
  updateSettingsVisibility();
  renderWinnerRefs();
  render();
  if (vals.length) fetchNames(vals).then(renderWinnerRefs);
});

document.getElementById('edit-winners-btn').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.remove('hidden');
  document.getElementById('settings-collapsed').classList.add('hidden');
  document.getElementById('settings-collapsed').classList.remove('flex');
});

/* ════════════════════════════════════════
   붙여넣기 패널 — 파싱 완료하면 접히고, "다시 붙여넣기"로 다시 펼침
════════════════════════════════════════ */
function updatePasteVisibility() {
  const panel     = document.getElementById('paste-panel');
  const collapsed = document.getElementById('paste-collapsed');
  const hasEntries = entries.length > 0;

  panel.classList.toggle('hidden', hasEntries);
  collapsed.classList.toggle('hidden', !hasEntries);
  collapsed.classList.toggle('flex', hasEntries);
}

document.getElementById('edit-paste-btn').addEventListener('click', () => {
  document.getElementById('paste-panel').classList.remove('hidden');
  document.getElementById('paste-collapsed').classList.add('hidden');
  document.getElementById('paste-collapsed').classList.remove('flex');
});

document.getElementById('parse-btn').addEventListener('click', () => {
  const raw = document.getElementById('paste-area').value;
  const parsed = parseComments(raw);
  const matched = parsed.filter(e => e.dexId != null); // 숫자 없는 댓글은 카드로 안 만듦
  entries = matched.map((e, i) => ({ ...e, _order: i }));
  saveEntries();

  document.getElementById('parse-summary').textContent =
    `${parsed.length}개 댓글 중 번호 인식 ${matched.length}개 표시 (숫자 없는 댓글 ${parsed.length - matched.length}개 제외)`;

  updatePasteVisibility();
  render();
  fetchNames(entries.map(e => e.dexId)).then(render);

  requestAnimationFrame(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
});

document.getElementById('reset-all-btn').addEventListener('click', () => {
  if (!confirm('정말 모든 데이터를 초기화하시겠습니까?\n당첨번호와 파싱된 댓글이 전부 지워지고 되돌릴 수 없습니다.')) return;

  winningNumbers = [];
  entries = [];
  saveWinners();
  saveEntries();

  ['win-1', 'win-2', 'win-3'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('paste-area').value = '';
  document.getElementById('parse-summary').textContent = '';

  updateSettingsVisibility();
  updatePasteVisibility();
  renderWinnerRefs();
  render();
});

/* ════════════════════════════════════════
   초기 렌더 — 새로고침해도 이전 상태 유지
════════════════════════════════════════ */
updateSettingsVisibility();
updatePasteVisibility();
renderWinnerRefs();
render();

const initialIds = [...new Set([...entries.map(e => e.dexId), ...winningNumbers])];
if (initialIds.length) fetchNames(initialIds).then(() => { renderWinnerRefs(); render(); });

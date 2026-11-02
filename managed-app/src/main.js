// 빼빼로데이 챌린지 - Copilot Managed Runtime 버전
// 사내 서버 버전(public/js/app.js)과 화면·게임은 같고, 저장소와 로그인만 다릅니다.
//  - 로그인: 회사 계정 (getUser)
//  - 저장소: 내장 앱 상태 컬렉션 attempt / setting
//  - 실시간: POLL_MS 마다 새로고침
import './styles.css';
import './managed.css';
import { store, currentUser, writable, MOCK, StoreError } from './store.js';
import { ADMINS, EVENT_END, PARTICIPANTS, POLL_MS } from './config.js';
import { CARDS, GAME_IDS, GAME_INFO, MAX_ATTEMPTS, evaluateResult, scoreOf } from './shared/rules.js';
import { buildLeaderboard, summarize } from './shared/leaderboard.js';
import * as cards from './games/cards.js';
import * as stopwatch from './games/stopwatch.js';
import * as pepero from './games/pepero.js';

const MODULES = { cards, stopwatch, pepero };
const RULES = {
  cards: [
    '빼빼로데이 그림 카드 36장(18쌍)이 <b>4초 동안</b> 공개된 뒤 모두 뒤집혀요.',
    '두 장씩 뒤집어 같은 그림이면 그대로, 다르면 다시 뒤집혀요.',
    '모든 짝을 찾을 때까지 걸린 <b>시간</b>이 기록돼요. 판은 매번 랜덤!',
  ],
  stopwatch: [
    '3·2·1 후 시간이 흐르다가 <b>3초 뒤 숫자가 가려져요.</b>',
    '감으로 <b>11.11초</b>라고 생각될 때 정지! (버튼 또는 스페이스바)',
    '11.11초와의 <b>오차가 작을수록</b> 높은 점수.',
  ],
  pepero: [
    '먼저 멀리서 <b>11.11km 목표선</b>을 보여준 뒤 출발점으로 확대돼요.',
    '<b>스페이스바(또는 버튼)를 누르고 있는 동안</b> 빼빼로가 점점 빠르게 길어져요.',
    '떼는 순간 멈춰요. 11.11km에 <b>가까울수록</b> 높은 점수!',
  ],
};
const SCORING = {
  cards: '20초 이내 완료 시 1000점, 이후 1초마다 −8점',
  stopwatch: '1000점에서 오차 0.001초마다 −1점',
  pepero: '1000점에서 오차 1m마다 −1점 (20km 도달 시 0점)',
};
const PENDING_KEY = 'pp_pending_v2';
const TAB_KEY = 'pp_tab';
const ATTEMPT = 'attempt';
const SETTING = 'setting';

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const local = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* 무시 */
    }
  },
};

const state = {
  user: null, // { id, name }
  attempts: [],
  setting: null, // { itemId, key, frozen, @odata.etag }
  board: null,
  me: null,
  tab: local.get(TAB_KEY) || 'overall',
  game: null,
};

const isAdmin = () => Boolean(state.user && ADMINS.includes(state.user.name));
const isFrozen = () =>
  Boolean(state.setting?.frozen) || Boolean(EVENT_END && Date.now() >= new Date(EVENT_END).getTime());

// ── 토스트 ──
let toastTimer = 0;
function toast(text) {
  const el = $('[data-toast]');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

// ── 데이터 ──
function toAttempt(item) {
  return {
    ...item,
    id: item.itemId,
    finishedAt: item.finishedAt || item.modifiedTime || item.createdTime,
  };
}

function derive() {
  const players = new Map();
  for (const a of state.attempts) players.set(a.playerId, { id: a.playerId, name: a.playerName });
  if (state.user) players.set(state.user.id, { id: state.user.id, name: state.user.name });
  const names = new Set([...players.values()].map((p) => p.name));
  for (const name of PARTICIPANTS) if (!names.has(name)) players.set(`roster:${name}`, { id: `roster:${name}`, name });
  const list = [...players.values()];

  state.board = {
    ...buildLeaderboard(list, state.attempts),
    frozen: isFrozen(),
    eventEnd: EVENT_END,
  };
  if (state.user) {
    const s = summarize([state.user], state.attempts).get(state.user.id);
    const games = {};
    for (const g of GAME_IDS) {
      const { used, best } = s.games[g];
      games[g] = { used, left: Math.max(0, MAX_ATTEMPTS - used), best: best && { score: best.score, display: best.display } };
    }
    state.me = { ...state.user, games };
  }
}

async function load() {
  const [attempts, settings] = await Promise.all([store.list(ATTEMPT), store.list(SETTING)]);
  state.attempts = attempts.map(toAttempt);
  state.setting = settings.find((s) => s.key === 'event') ?? null;
  derive();
}

let refreshing = false;
async function refresh({ quiet = true } = {}) {
  if (refreshing) return;
  refreshing = true;
  try {
    await load();
    renderBoard();
    if (!state.game) renderGames();
    renderAuth();
  } catch (err) {
    if (!quiet) toast(err.message);
    console.error(err);
  } finally {
    refreshing = false;
  }
}

// ── 상단 ──
function renderAuth() {
  const el = $('[data-auth]');
  if (!state.user) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <span class="hello">🍫 <b>${esc(state.user.name)}</b>님${MOCK ? ' <span class="pill pill-red">모의 모드</span>' : ''}</span>
    ${isAdmin() ? '<button class="btn btn-ghost btn-sm" data-admin>관리</button>' : ''}`;
  el.querySelector('[data-admin]')?.addEventListener('click', openAdmin);
}

// ── 게임 카드 ──
function renderGames() {
  const el = $('[data-games]');
  const frozen = state.board?.frozen;
  el.innerHTML = GAME_IDS.map((id) => {
    const info = GAME_INFO[id];
    const mine = state.me?.games[id];
    const left = mine ? mine.left : MAX_ATTEMPTS;
    const dots = Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
      `<i class="${i < MAX_ATTEMPTS - left ? 'used' : ''}"></i>`).join('');
    let label = '플레이';
    let disabled = false;
    if (frozen) [label, disabled] = ['마감', true];
    else if (!state.me) [label, disabled] = ['불러오는 중…', true];
    else if (left <= 0) [label, disabled] = ['기회 소진', true];
    return `
      <article class="game-card game-${id}">
        <div class="game-emoji" aria-hidden="true">${info.emoji}</div>
        <h2>${info.name}</h2>
        <p class="game-desc">${RULES[id][0]}</p>
        <div class="game-meta">
          <span class="dots" title="남은 기회 ${left}/${MAX_ATTEMPTS}">${dots}</span>
          <span>남은 기회 <b>${left}</b>/${MAX_ATTEMPTS}</span>
        </div>
        <div class="game-best">${
          mine?.best ? `내 최고: <b>${esc(mine.best.display)}</b> · ${mine.best.score}점` : '&nbsp;'
        }</div>
        <button class="btn btn-primary btn-block" data-play="${id}" ${disabled ? 'disabled' : ''}>${label}</button>
      </article>`;
  }).join('');
  el.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => openGame(b.dataset.play)));
}

// ── 랭킹 대시보드 ──
const TABS = [['overall', '종합'], ...GAME_IDS.map((g) => [g, `${GAME_INFO[g].emoji} ${GAME_INFO[g].short}`])];
const MEDALS = ['🥇', '🥈', '🥉'];

function renderBoard() {
  const b = state.board;
  if (!b) return;
  $('[data-tabs]').innerHTML = TABS.map(
    ([id, label]) =>
      `<button role="tab" class="tab ${state.tab === id ? 'active' : ''}" aria-selected="${state.tab === id}" data-tab="${id}">${label}</button>`,
  ).join('');
  document.querySelectorAll('[data-tab]').forEach(
    (t) =>
      (t.onclick = () => {
        state.tab = t.dataset.tab;
        local.set(TAB_KEY, state.tab);
        renderBoard();
      }),
  );

  const playedCount = b.overall.filter((r) => r.rank).length;
  const end = b.eventEnd ? new Date(b.eventEnd) : null;
  $('[data-status]').innerHTML = b.frozen
    ? '<span class="pill pill-red">이벤트 마감 · 최종 결과</span>'
    : `<span class="pill pill-live"><i></i>LIVE</span> 참가 ${playedCount}명${
        end ? ` · 마감 ${end.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''
      }`;

  const myId = state.user?.id;
  const isOverall = state.tab === 'overall';
  const rows = isOverall ? b.overall : b.games[state.tab];
  const ranked = rows.filter((r) => r.rank);

  $('[data-podium]').innerHTML = [1, 0, 2]
    .map((i) => {
      const r = ranked[i];
      const val = r ? (isOverall ? `${r.total}점` : esc(r.display)) : '';
      return `
        <div class="pod pod-${i + 1} ${r && r.id === myId ? 'me' : ''}">
          <div class="pod-medal">${MEDALS[i]}</div>
          <div class="pod-name">${r ? esc(r.name) : '?'}</div>
          <div class="pod-val">${val || '도전을 기다려요'}</div>
          <div class="pod-block">${i + 1}</div>
        </div>`;
    })
    .join('');

  const head = isOverall
    ? `<tr><th>순위</th><th>이름</th>${GAME_IDS.map((g) => `<th class="num">${GAME_INFO[g].short}</th>`).join('')}<th class="num">합계</th></tr>`
    : '<tr><th>순위</th><th>이름</th><th>최고 기록</th><th class="num">점수</th><th class="num">도전</th></tr>';
  const body = rows
    .map((r) => {
      const rank = r.rank ? (r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank) : '–';
      const cls = [r.rank && r.rank <= 3 ? 'top' : '', r.id === myId ? 'me' : '', r.rank ? '' : 'waiting'].join(' ');
      if (isOverall) {
        const cells = GAME_IDS.map((g) => {
          const s = r.games[g];
          return `<td class="num">${s.score ?? '<span class="muted">–</span>'}<small class="muted"> ${s.used}/${b.maxAttempts}</small></td>`;
        }).join('');
        return `<tr class="${cls}"><td class="rank">${rank}</td><td>${esc(r.name)}</td>${cells}<td class="num total">${r.rank ? r.total : '<span class="muted">도전 전</span>'}</td></tr>`;
      }
      return `<tr class="${cls}"><td class="rank">${rank}</td><td>${esc(r.name)}</td><td>${r.rank ? esc(r.display) : '<span class="muted">도전 전</span>'}</td><td class="num">${r.rank ? r.score : '–'}</td><td class="num">${r.used}/${b.maxAttempts}</td></tr>`;
    })
    .join('');
  $('[data-table]').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}

// ── 게임 오버레이 ──
const overlay = $('[data-overlay]');
const stage = $('[data-stage]');

function showOverlay(title) {
  $('[data-overlay-title]').textContent = title;
  overlay.hidden = false;
  document.body.classList.add('no-scroll');
}

function closeOverlay() {
  state.game?.handle?.destroy();
  state.game = null;
  overlay.hidden = true;
  stage.innerHTML = '';
  document.body.classList.remove('no-scroll');
  renderGames();
}

$('[data-overlay-close]').onclick = () => {
  if (state.game?.handle && !state.game.finished) {
    if (!confirm('지금 나가면 이번 기회는 기록 없이 소진돼요. 나갈까요?')) return;
  }
  closeOverlay();
};

// ── 팝업 (게임 설명 / 관리자) ──
const modal = $('[data-modal]');
const modalBody = modal.querySelector('[data-modal-body]');
function openModal(className, html) {
  modalBody.className = `modal ${className}`;
  modalBody.innerHTML = html;
  modal.hidden = false;
  document.body.classList.add('no-scroll');
}
function closeModal() {
  modal.hidden = true;
  modalBody.innerHTML = '';
  if (!state.game) document.body.classList.remove('no-scroll');
}
modal.addEventListener('pointerdown', (e) => {
  if (e.target === modal && !modal.querySelector('[data-start]:disabled')) closeModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

function openGame(id) {
  if (!state.me) return toast('사용자 정보를 불러오는 중이에요. 잠시 후 다시 시도해주세요.');
  const info = GAME_INFO[id];
  const mine = state.me.games[id];
  openModal(
    `modal-${id}`,
    `
    <div class="modal-hero"><span>${info.emoji}</span></div>
    <h3 id="modal-title">${info.name}</h3>
    <p class="modal-sub">게임 방법</p>
    <ol class="steps">${RULES[id].map((r) => `<li><span>${r}</span></li>`).join('')}</ol>
    <div class="modal-info">
      <div><span>점수</span><b>${SCORING[id]}</b></div>
      <div><span>남은 기회</span><b>${mine.left} / ${MAX_ATTEMPTS}</b></div>
      ${mine.best ? `<div><span>내 최고</span><b>${esc(mine.best.display)} · ${mine.best.score}점</b></div>` : ''}
    </div>
    <p class="warn">시작 버튼을 누르면 기회 1회가 차감되고 <b>3·2·1</b> 후 게임이 시작돼요.<br/>최고 기록만 랭킹에 반영됩니다.</p>
    <div class="intro-actions">
      <button class="btn btn-ghost btn-lg" data-cancel>닫기</button>
      <button class="btn btn-primary btn-lg" data-start>시작하기 ▶</button>
    </div>`,
  );
  modalBody.querySelector('[data-cancel]').onclick = closeModal;
  modalBody.querySelector('[data-start]').onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const attempt = await beginAttempt(id);
      closeModal();
      startGame(attempt);
    } catch (err) {
      toast(err.message);
      closeModal();
      refresh();
    }
  };
}

function shuffledDeck() {
  const deck = [];
  for (let i = 0; i < CARDS.pairs; i++) deck.push(i, i);
  const rnd = new Uint32Array(deck.length);
  crypto.getRandomValues(rnd);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 게임 시작 = 기회 1회 차감 (attempt 기록 생성) */
async function beginAttempt(game) {
  await load(); // 최신 기록으로 남은 기회 확인
  if (isFrozen()) throw new Error('이벤트가 마감되었습니다.');
  if (state.me.games[game].left <= 0) throw new Error('이 게임의 도전 기회를 모두 사용했습니다.');
  const deck = game === 'cards' ? shuffledDeck() : undefined;
  const item = await store.create(ATTEMPT, {
    playerId: state.user.id,
    playerName: state.user.name,
    game,
    status: 'playing',
    startedAt: new Date().toISOString(),
    deck: deck && JSON.stringify(deck),
  });
  state.attempts.push(toAttempt(item));
  derive();
  return { id: item.itemId, game, deck, item };
}

async function startGame(attempt) {
  const id = attempt.game;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  showOverlay(`${GAME_INFO[id].emoji} ${GAME_INFO[id].name}`);
  const game = { id, handle: null, finished: false };
  state.game = game;
  game.handle = MODULES[id].mount(stage, {
    attempt,
    onFinish: (payload) => submitResult(attempt, payload),
  });
  const ok = await countdown(stage);
  if (ok && state.game === game && game.handle) game.handle.start();
}

function countdown(container) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'countdown';
    container.appendChild(el);
    const steps = ['3', '2', '1', 'START!'];
    let i = 0;
    const next = () => {
      if (!el.isConnected) return resolve(false);
      if (i === steps.length) {
        el.remove();
        return resolve(true);
      }
      el.innerHTML = `<span class="cd-num ${i === 3 ? 'go' : ''}">${steps[i]}</span>`;
      i += 1;
      setTimeout(next, i === steps.length ? 550 : 800);
    };
    next();
  });
}

/** 결과 검증·점수 계산 후 attempt 기록 갱신 */
function buildResultDoc(baseItem, game, deck, payload) {
  // 서버가 없으므로 시간 상한 검사는 생략하고, 카드 게임은 뒤집기 기록을 리플레이해서 검증
  const ev = evaluateResult(game, payload, { deck, serverElapsedMs: Number.MAX_SAFE_INTEGER / 2 });
  const doc = { ...writable(baseItem), finishedAt: new Date().toISOString() };
  if (!ev.ok) return { ...doc, status: 'rejected', rejectReason: ev.reason };
  const s = scoreOf(game, ev.raw);
  return {
    ...doc,
    status: 'done',
    raw: ev.raw,
    metric: s.metric,
    score: s.score,
    display: s.display,
    detail: JSON.stringify(ev.detail),
  };
}

async function saveResult(id, doc) {
  let current = await store.get(ATTEMPT, id).catch(() => null);
  if (current && current.status !== 'playing') return current; // 이미 반영됨
  try {
    return await store.replace(ATTEMPT, id, doc, current?.['@odata.etag']);
  } catch (err) {
    if (!(err instanceof StoreError) || err.status !== 412) throw err;
    current = await store.get(ATTEMPT, id);
    if (current.status !== 'playing') return current;
    return store.replace(ATTEMPT, id, doc, current['@odata.etag']);
  }
}

async function submitResult(attempt, payload) {
  state.game.finished = true;
  state.game.handle?.destroy();
  state.game.handle = null;
  const doc = buildResultDoc(attempt.item, attempt.game, attempt.deck, payload);
  local.set(PENDING_KEY, JSON.stringify({ id: attempt.id, doc }));
  stage.innerHTML = '<div class="result"><div class="spinner"></div><p>결과 저장 중…</p></div>';
  const send = async () => {
    try {
      const saved = await saveResult(attempt.id, doc);
      local.set(PENDING_KEY, null);
      await load().catch(() => {});
      renderBoard();
      showResult(attempt.game, saved);
    } catch (err) {
      stage.innerHTML = `<div class="result"><p class="big">📡</p><p>${esc(err.message)}</p>
        <button class="btn btn-primary" data-retry>다시 저장</button>
        <p class="hint">창을 닫아도 다음에 접속할 때 자동으로 저장돼요.</p></div>`;
      stage.querySelector('[data-retry]').onclick = send;
    }
  };
  await send();
}

function showResult(game, result) {
  const mine = state.me.games[game];
  const overall = state.board.overall.find((r) => r.id === state.user.id);
  const gameRank = state.board.games[game].find((r) => r.id === state.user.id);
  if (result.status !== 'done') {
    stage.innerHTML = `<div class="result"><p class="big">⚠️</p><p>기록이 인정되지 않았어요: ${esc(result.rejectReason)}</p>
      <button class="btn btn-primary" data-close>닫기</button></div>`;
  } else {
    const isBest = mine.best && mine.best.display === result.display;
    stage.innerHTML = `
      <div class="result">
        <p class="result-label">이번 기록</p>
        <p class="result-value">${esc(result.display)}</p>
        <p class="result-score"><b>${result.score}</b>점 ${isBest ? '<span class="pill pill-pink">최고 기록!</span>' : ''}</p>
        <div class="result-ranks">
          <div><span>${GAME_INFO[game].short} 순위</span><b>${gameRank?.rank ?? '-'}위</b></div>
          <div><span>종합 순위</span><b>${overall?.rank ?? '-'}위</b></div>
          <div><span>남은 기회</span><b>${mine.left}/${MAX_ATTEMPTS}</b></div>
        </div>
        <div class="intro-actions">
          <button class="btn btn-ghost" data-close>랭킹 보기</button>
          ${mine.left > 0 && !state.board.frozen ? '<button class="btn btn-primary" data-again>한 번 더!</button>' : ''}
        </div>
      </div>`;
    stage.querySelector('[data-again]')?.addEventListener('click', () => {
      closeOverlay();
      openGame(game);
    });
  }
  stage.querySelector('[data-close]')?.addEventListener('click', closeOverlay);
}

async function flushPending() {
  const raw = local.get(PENDING_KEY);
  if (!raw) return;
  try {
    const { id, doc } = JSON.parse(raw);
    await saveResult(id, doc);
    local.set(PENDING_KEY, null);
    toast('지난번에 저장하지 못한 결과를 반영했어요.');
    refresh();
  } catch (err) {
    if (err instanceof StoreError && err.status === 404) local.set(PENDING_KEY, null);
  }
}

// ── 관리자 ──
const GAME_SHORT = Object.fromEntries(GAME_IDS.map((g) => [g, GAME_INFO[g].short]));
const STATUS = { done: '완료', playing: '진행/중단', rejected: '거절' };

function toCsv() {
  const q = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [
    ['이름', '게임', '상태', '기록', '점수', '시작', '종료'].map(q).join(','),
    ...state.attempts.map((a) =>
      [a.playerName, GAME_SHORT[a.game], STATUS[a.status], a.display, a.score, a.createdTime, a.finishedAt].map(q).join(','),
    ),
  ].join('\n');
}

function openAdmin() {
  if (!isAdmin()) return;
  const rows = [...state.attempts].sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  openModal(
    'modal-admin',
    `
    <h3 id="modal-title">관리자</h3>
    <p class="modal-sub">${isFrozen() ? '현재 마감 상태' : '진행 중'}${EVENT_END ? ` · 자동 마감 ${new Date(EVENT_END).toLocaleString('ko-KR')}` : ''}</p>
    <div class="intro-actions admin-actions">
      <button class="btn btn-sm" data-freeze>${state.setting?.frozen ? '마감 해제' : '지금 마감(랭킹 동결)'}</button>
      <button class="btn btn-sm" data-csv>CSV 보기</button>
      <button class="btn btn-sm btn-danger" data-reset>전체 기록 초기화</button>
    </div>
    <textarea class="csv-box" data-csvbox readonly hidden></textarea>
    <div class="table-wrap admin-table">
      <table class="rank-table">
        <thead><tr><th>시작</th><th>이름</th><th>게임</th><th>상태</th><th>기록</th><th class="num">점수</th><th></th></tr></thead>
        <tbody>${
          rows
            .map(
              (a) => `<tr class="${a.status === 'done' ? '' : 'waiting'}">
              <td>${new Date(a.createdTime).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              <td>${esc(a.playerName)}</td><td>${GAME_SHORT[a.game] ?? esc(a.game)}</td>
              <td>${STATUS[a.status] ?? esc(a.status)}</td><td>${esc(a.display ?? '')}</td><td class="num">${a.score ?? ''}</td>
              <td><button class="btn btn-sm btn-danger" data-del="${esc(a.id)}" title="삭제하면 기회 1회가 복구됩니다">삭제</button></td>
            </tr>`,
            )
            .join('') || '<tr><td colspan="7" class="muted">기록이 없습니다.</td></tr>'
        }</tbody>
      </table>
    </div>
    <div class="intro-actions"><button class="btn btn-ghost btn-lg" data-cancel>닫기</button></div>`,
  );
  const act = (fn) => async (e) => {
    e.currentTarget.disabled = true;
    try {
      await fn(e);
      await load();
      renderBoard();
      renderGames();
      openAdmin();
    } catch (err) {
      toast(err.message);
      e.currentTarget.disabled = false;
    }
  };
  modalBody.querySelector('[data-cancel]').onclick = closeModal;
  modalBody.querySelector('[data-freeze]').onclick = act(async () => {
    const frozen = !state.setting?.frozen;
    if (state.setting) await store.replace(SETTING, state.setting.itemId, { key: 'event', frozen }, state.setting['@odata.etag']);
    else await store.create(SETTING, { key: 'event', frozen });
  });
  modalBody.querySelector('[data-csv]').onclick = () => {
    const box = modalBody.querySelector('[data-csvbox]');
    box.value = toCsv();
    box.hidden = false;
    box.select();
  };
  modalBody.querySelector('[data-reset]').onclick = act(async () => {
    if (prompt('모든 도전 기록이 삭제됩니다. 계속하려면 "초기화"를 입력하세요.') !== '초기화') return;
    for (const a of state.attempts) await store.remove(ATTEMPT, a.id);
  });
  modalBody.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = act(async () => {
        if (!confirm('이 기록을 삭제할까요? (해당 참가자의 기회 1회가 복구됩니다)')) return;
        await store.remove(ATTEMPT, b.dataset.del);
      })),
  );
}

// ── 시작 ──
async function boot() {
  renderGames();
  try {
    state.user = await currentUser();
  } catch (err) {
    console.error(err);
    $('[data-games]').innerHTML = `<article class="game-card"><h2>로그인 정보를 불러오지 못했어요</h2>
      <p class="game-desc">Copilot 앱 플레이어(managedapps.cloud.microsoft)에서 열어주세요.<br/>로컬 확인은 주소 뒤에 <code>?mock&amp;user=이름</code> 을 붙이면 됩니다.</p></article>`;
    return;
  }
  renderAuth();
  await refresh({ quiet: false });
  flushPending();
  setInterval(() => {
    if (document.visibilityState === 'visible' && !state.game) refresh();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

boot();

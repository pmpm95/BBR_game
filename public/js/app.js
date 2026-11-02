import { api, ApiError, getToken, setToken, storage } from './api.js';
import { GAME_IDS, GAME_INFO, MAX_ATTEMPTS } from './shared/rules.js';
import * as cards from './games/cards.js';
import * as stopwatch from './games/stopwatch.js';
import * as pepero from './games/pepero.js';

const MODULES = { cards, stopwatch, pepero };
const RULES = {
  cards: [
    '36장(18쌍) 카드가 <b>4초 동안</b> 공개된 뒤 모두 뒤집혀요.',
    '두 장씩 뒤집어 같은 그림이면 그대로, 다르면 다시 뒤집혀요.',
    '모든 짝을 찾을 때까지 걸린 <b>시간</b>이 기록돼요. 판은 매번 랜덤!',
  ],
  stopwatch: [
    '시작하면 시간이 흐르다가 <b>3초 뒤 숫자가 가려져요.</b>',
    '감으로 <b>11.11초</b>라고 생각될 때 정지! (버튼 또는 스페이스바)',
    '11.11초와의 <b>오차가 작을수록</b> 높은 점수.',
  ],
  pepero: [
    '먼저 멀리서 <b>11.11km 목표선</b>을 보여준 뒤 출발점으로 확대돼요.',
    '<b>스페이스바(또는 버튼)를 누르고 있는 동안</b> 빼빼로가 점점 빠르게 길어져요.',
    '떼는 순간 멈춰요. 11.11km에 <b>가까울수록</b> 높은 점수!',
  ],
};
const PENDING_KEY = 'pp_pending';
const TAB_KEY = 'pp_tab';

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = {
  me: null,
  board: null,
  tab: storage.get(TAB_KEY) || 'overall',
  game: null, // { id, handle }
};

// ── 토스트 ──
let toastTimer = 0;
function toast(text) {
  const el = $('[data-toast]');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

// ── 로그인 영역 ──
function renderAuth() {
  const el = $('[data-auth]');
  if (state.me) {
    el.innerHTML = `
      <span class="hello">🍫 <b>${esc(state.me.name)}</b>님</span>
      <button class="btn btn-ghost btn-sm" data-logout>나가기</button>`;
    el.querySelector('[data-logout]').onclick = logout;
  } else {
    el.innerHTML = `
      <form class="login" data-login>
        <label for="code">개인 코드</label>
        <input id="code" name="code" type="password" inputmode="numeric" autocomplete="off"
               maxlength="4" pattern="\\d{4}" placeholder="4자리" required />
        <button class="btn btn-primary btn-sm" type="submit">입장</button>
      </form>`;
    el.querySelector('[data-login]').onsubmit = login;
  }
}

async function login(e) {
  e.preventDefault();
  const code = e.target.code.value.trim();
  if (!/^\d{4}$/.test(code)) return toast('코드는 숫자 4자리예요.');
  try {
    const { token, me } = await api('POST', '/api/login', { code });
    setToken(token);
    state.me = me;
    renderAuth();
    renderGames();
    renderBoard();
    toast(`${me.name}님 환영해요! 🍫`);
    flushPending();
  } catch (err) {
    toast(err.message);
  }
}

async function logout() {
  await api('POST', '/api/logout').catch(() => {});
  setToken(null);
  state.me = null;
  renderAuth();
  renderGames();
  renderBoard();
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
    else if (!state.me) label = '코드 입력 후 플레이';
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
        storage.set(TAB_KEY, state.tab);
        renderBoard();
      }),
  );

  const playedCount = b.overall.filter((r) => r.rank).length;
  const end = b.eventEnd ? new Date(b.eventEnd) : null;
  $('[data-status]').innerHTML = b.frozen
    ? '<span class="pill pill-red">이벤트 마감 · 최종 결과</span>'
    : `<span class="pill pill-live"><i></i>LIVE</span> 참가 ${playedCount}/${b.participants}명${
        end ? ` · 마감 ${end.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''
      }`;

  const myName = state.me?.name;
  const isOverall = state.tab === 'overall';
  const rows = isOverall ? b.overall : b.games[state.tab];
  const ranked = rows.filter((r) => r.rank);

  // 포디움 (TOP 3)
  const podiumOrder = [1, 0, 2];
  $('[data-podium]').innerHTML = podiumOrder
    .map((i) => {
      const r = ranked[i];
      const val = r ? (isOverall ? `${r.total}점` : esc(r.display)) : '';
      return `
        <div class="pod pod-${i + 1} ${r && r.name === myName ? 'me' : ''}">
          <div class="pod-medal">${MEDALS[i]}</div>
          <div class="pod-name">${r ? esc(r.name) : '?'}</div>
          <div class="pod-val">${val || '도전을 기다려요'}</div>
          <div class="pod-block">${i + 1}</div>
        </div>`;
    })
    .join('');

  // 표
  const head = isOverall
    ? `<tr><th>순위</th><th>이름</th>${GAME_IDS.map((g) => `<th class="num">${GAME_INFO[g].short}</th>`).join('')}<th class="num">합계</th></tr>`
    : '<tr><th>순위</th><th>이름</th><th>최고 기록</th><th class="num">점수</th><th class="num">도전</th></tr>';
  const body = rows
    .map((r) => {
      const rank = r.rank ? (r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank) : '–';
      const cls = [r.rank && r.rank <= 3 ? 'top' : '', r.name === myName ? 'me' : '', r.rank ? '' : 'waiting'].join(' ');
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

async function refresh() {
  try {
    state.board = await api('GET', '/api/leaderboard');
    if (getToken()) {
      try {
        state.me = (await api('GET', '/api/me')).me;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          state.me = null;
          renderAuth();
        }
      }
    }
    renderBoard();
    if (!state.game) renderGames();
  } catch {
    /* 다음 갱신에서 재시도 */
  }
}

function connectStream() {
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  };
  if ('EventSource' in window) {
    const es = new EventSource('/api/stream');
    es.addEventListener('update', schedule);
    es.onopen = schedule;
  }
  setInterval(refresh, 20000); // 안전망
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

function openGame(id) {
  if (!state.me) {
    $('#code')?.focus();
    return toast('먼저 개인 코드 4자리를 입력해주세요.');
  }
  const left = state.me.games[id].left;
  showOverlay(`${GAME_INFO[id].emoji} ${GAME_INFO[id].name}`);
  state.game = { id, handle: null, finished: false };
  stage.innerHTML = `
    <div class="intro">
      <ul class="rules">${RULES[id].map((r) => `<li>${r}</li>`).join('')}</ul>
      <p class="warn">시작하면 기회 1회가 차감돼요. (남은 기회 <b>${left}</b>/${MAX_ATTEMPTS})<br/>최고 기록만 랭킹에 반영됩니다.</p>
      <div class="intro-actions">
        <button class="btn btn-ghost" data-cancel>취소</button>
        <button class="btn btn-primary btn-lg" data-start>시작하기</button>
      </div>
    </div>`;
  stage.querySelector('[data-cancel]').onclick = closeOverlay;
  stage.querySelector('[data-start]').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const { attempt, me } = await api('POST', '/api/attempts', { game: id });
      state.me = me;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      state.game.handle = MODULES[id].mount(stage, {
        attempt,
        onFinish: (payload) => submitResult(attempt, payload),
      });
    } catch (err) {
      toast(err.message);
      closeOverlay();
      refresh();
    }
  };
}

async function submitResult(attempt, payload) {
  state.game.finished = true;
  state.game.handle?.destroy();
  state.game.handle = null;
  storage.set(PENDING_KEY, JSON.stringify({ id: attempt.id, payload }));
  stage.innerHTML = '<div class="result"><div class="spinner"></div><p>결과 전송 중…</p></div>';
  const send = async () => {
    try {
      const data = await api('POST', `/api/attempts/${attempt.id}/result`, { payload });
      storage.set(PENDING_KEY, null);
      state.me = data.me;
      state.board = data.leaderboard;
      renderBoard();
      showResult(attempt.game, data.result);
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        storage.set(PENDING_KEY, null);
        stage.innerHTML = `<div class="result"><p class="big">😢</p><p>${esc(err.message)}</p><button class="btn btn-primary" data-close>닫기</button></div>`;
      } else {
        stage.innerHTML = `<div class="result"><p class="big">📡</p><p>${esc(err.message)}</p>
          <button class="btn btn-primary" data-retry>다시 전송</button>
          <p class="hint">창을 닫아도 다음에 접속할 때 자동으로 전송돼요.</p></div>`;
        stage.querySelector('[data-retry]').onclick = send;
      }
      stage.querySelector('[data-close]')?.addEventListener('click', closeOverlay);
    }
  };
  await send();
}

function showResult(game, result) {
  const mine = state.me.games[game];
  const overall = state.board.overall.find((r) => r.name === state.me.name);
  const gameRank = state.board.games[game].find((r) => r.name === state.me.name);
  if (result.status !== 'done') {
    stage.innerHTML = `<div class="result"><p class="big">⚠️</p><p>기록이 인정되지 않았어요: ${esc(result.reason)}</p>
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
    stage.querySelector('[data-again]')?.addEventListener('click', () => openGame(game));
  }
  stage.querySelector('[data-close]')?.addEventListener('click', closeOverlay);
}

// 네트워크 문제로 못 보낸 결과가 있으면 재전송
async function flushPending() {
  const raw = storage.get(PENDING_KEY);
  if (!raw || !getToken()) return;
  try {
    const { id, payload } = JSON.parse(raw);
    await api('POST', `/api/attempts/${id}/result`, { payload });
    storage.set(PENDING_KEY, null);
    toast('지난번에 전송하지 못한 결과를 반영했어요.');
    refresh();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 0) storage.set(PENDING_KEY, null);
  }
}

// ── 시작 ──
renderAuth();
renderGames();
refresh().then(() => {
  renderAuth();
  flushPending();
});
connectStream();

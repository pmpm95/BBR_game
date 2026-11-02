// 게임 규칙 · 점수 계산 · 결과 검증 (브라우저와 서버가 함께 사용하는 단일 소스)

export const MAX_ATTEMPTS = 3;

export const GAME_IDS = ['cards', 'stopwatch', 'pepero'];

export const GAME_INFO = {
  cards: { id: 'cards', name: '카드 짝맞추기', emoji: '🃏', short: '카드' },
  stopwatch: { id: 'stopwatch', name: '11초 11 맞추기', emoji: '⏱️', short: '11.11초' },
  pepero: { id: 'pepero', name: '11.11km 빼빼로', emoji: '🥢', short: '11.11km' },
};

// ── 게임 1: 카드 짝맞추기 ──────────────────────────────
export const CARDS = {
  pairs: 18, // 36장
  previewMs: 4000, // 처음에 전체 공개하는 시간
  mismatchMs: 700, // 틀렸을 때 다시 뒤집기까지
  parSec: 20, // 이 시간 이내면 1000점
  pointsPerSec: 8, // 1초 늦어질 때마다 감점
};

// ── 게임 2: 11초 11 ─────────────────────────────────
export const STOPWATCH = {
  targetMs: 11110,
  revealMs: 3000, // 처음 3초만 숫자를 보여줌
  timeoutMs: 30000, // 30초가 지나면 자동 정지
};

// ── 게임 3: 11.11km 빼빼로 ───────────────────────────
// 길이 L(t) = v0·t + ½·a·t²  (t: 누르고 있는 시간, 초)
// v0=0.5km/s, a=0.25km/s² → 11.11km 도달까지 약 7.6초, 그 순간 속도 약 2.4km/s
export const PEPERO = {
  targetKm: 11.11,
  v0: 0.5,
  accel: 0.25,
  maxKm: 20, // 여기까지 가면 자동으로 멈추고 0점
};

export function peperoLength(holdMs) {
  const t = Math.max(0, holdMs) / 1000;
  return Math.min(PEPERO.maxKm, PEPERO.v0 * t + 0.5 * PEPERO.accel * t * t);
}

export function peperoHoldMsFor(lengthKm) {
  const { v0, accel } = PEPERO;
  const t = (-v0 + Math.sqrt(v0 * v0 + 2 * accel * lengthKm)) / accel;
  return t * 1000;
}

// ── 점수 ─────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function signed(v, digits) {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? s : `±${(0).toFixed(digits)}`;
}

/**
 * raw 값(서버 확정값)을 점수/표시/정렬값으로 변환
 *  - cards: 완료 시간(ms)
 *  - stopwatch: 멈춘 시간(ms)
 *  - pepero: 완성된 길이(km)
 * metric 은 작을수록 좋은 값(게임별 랭킹 정렬 기준)
 */
export function scoreOf(game, raw) {
  switch (game) {
    case 'cards': {
      const sec = raw / 1000;
      return {
        metric: raw,
        score: Math.round(clamp(1000 - (sec - CARDS.parSec) * CARDS.pointsPerSec, 0, 1000)),
        display: `${sec.toFixed(2)}초`,
      };
    }
    case 'stopwatch': {
      const err = raw - STOPWATCH.targetMs;
      return {
        metric: Math.abs(err),
        score: Math.round(clamp(1000 - Math.abs(err), 0, 1000)),
        display: `${(raw / 1000).toFixed(3)}초 (${signed(err / 1000, 3)})`,
      };
    }
    case 'pepero': {
      const err = raw - PEPERO.targetKm;
      const failed = raw >= PEPERO.maxKm;
      return {
        metric: round(Math.abs(err), 4),
        score: failed ? 0 : Math.round(clamp(1000 - Math.abs(err) * 1000, 0, 1000)),
        display: `${raw.toFixed(3)}km (${signed(err, 3)})`,
      };
    }
    default:
      throw new Error(`unknown game: ${game}`);
  }
}

// ── 카드 게임 리플레이 검증 ───────────────────────────
/**
 * flips: [[cardIndex, tMs], ...]  (tMs: 카드가 다 뒤집힌 순간부터의 경과 ms)
 * deck:  [symbolId x 36]
 */
export function replayCards(deck, flips) {
  if (!Array.isArray(flips) || flips.length < deck.length || flips.length > 2000 || flips.length % 2) {
    return { ok: false, reason: '뒤집기 기록이 올바르지 않습니다.' };
  }
  const matched = new Array(deck.length).fill(false);
  let lastT = 0;
  let moves = 0;
  for (let i = 0; i < flips.length; i += 2) {
    const [a, ta] = flips[i] ?? [];
    const [b, tb] = flips[i + 1] ?? [];
    for (const [idx, t] of [[a, ta], [b, tb]]) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= deck.length || matched[idx]) {
        return { ok: false, reason: '잘못된 카드 선택이 있습니다.' };
      }
      if (!Number.isFinite(t) || t < lastT) {
        return { ok: false, reason: '시간 기록이 올바르지 않습니다.' };
      }
      lastT = t;
    }
    if (a === b) return { ok: false, reason: '같은 카드를 두 번 선택했습니다.' };
    moves += 1;
    if (deck[a] === deck[b]) {
      matched[a] = true;
      matched[b] = true;
    }
  }
  if (!matched.every(Boolean)) return { ok: false, reason: '모든 짝을 찾지 않았습니다.' };
  return { ok: true, timeMs: Math.round(lastT), moves };
}

/**
 * 클라이언트가 보낸 결과를 검증하고 서버 확정 raw 값을 계산
 * ctx: { deck, serverElapsedMs }
 */
export function evaluateResult(game, payload, ctx) {
  const slack = 2000; // 네트워크 지연 등 허용 오차
  const limit = ctx.serverElapsedMs + slack;
  payload = payload ?? {};
  switch (game) {
    case 'cards': {
      const r = replayCards(ctx.deck, payload.flips);
      if (!r.ok) return r;
      if (r.timeMs > limit) return { ok: false, reason: '시간 기록이 서버 시간과 맞지 않습니다.' };
      return { ok: true, raw: r.timeMs, detail: { moves: r.moves } };
    }
    case 'stopwatch': {
      const ms = Number(payload.stoppedMs);
      if (!Number.isFinite(ms) || ms <= 0) return { ok: false, reason: '기록이 올바르지 않습니다.' };
      if (ms > limit) return { ok: false, reason: '시간 기록이 서버 시간과 맞지 않습니다.' };
      const raw = Math.round(Math.min(ms, STOPWATCH.timeoutMs));
      return { ok: true, raw, detail: {} };
    }
    case 'pepero': {
      const ms = Number(payload.holdMs);
      if (!Number.isFinite(ms) || ms <= 0) return { ok: false, reason: '기록이 올바르지 않습니다.' };
      if (ms > limit) return { ok: false, reason: '시간 기록이 서버 시간과 맞지 않습니다.' };
      return { ok: true, raw: round(peperoLength(ms), 4), detail: { holdMs: Math.round(ms) } };
    }
    default:
      return { ok: false, reason: '알 수 없는 게임입니다.' };
  }
}

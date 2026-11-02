import { GAME_IDS, MAX_ATTEMPTS } from '../public/js/shared/rules.js';

const better = (a, b) =>
  a.metric !== b.metric ? a.metric < b.metric : a.finishedAt < b.finishedAt;

/** 참가자별 · 게임별 요약 (최고 기록, 사용 횟수) */
export function summarize(players, attempts) {
  const map = new Map();
  for (const p of players) {
    const games = {};
    for (const g of GAME_IDS) games[g] = { used: 0, best: null };
    map.set(p.id, { id: p.id, name: p.name, games });
  }
  for (const a of attempts) {
    const s = map.get(a.playerId);
    if (!s || !s.games[a.game]) continue;
    const g = s.games[a.game];
    g.used += 1;
    if (a.status === 'done' && (!g.best || better(a, g.best))) g.best = a;
  }
  return map;
}

const publicBest = (b) =>
  b && { score: b.score, display: b.display, metric: b.metric, finishedAt: b.finishedAt };

export function buildLeaderboard(players, attempts) {
  const summary = [...summarize(players, attempts).values()];

  const games = {};
  for (const g of GAME_IDS) {
    const rows = summary
      .filter((s) => s.games[g].best)
      .sort((x, y) => (better(x.games[g].best, y.games[g].best) ? -1 : 1))
      .map((s, i) => ({
        rank: i + 1,
        name: s.name,
        used: s.games[g].used,
        ...publicBest(s.games[g].best),
      }));
    const waiting = summary
      .filter((s) => !s.games[g].best)
      .map((s) => ({ rank: null, name: s.name, used: s.games[g].used }));
    games[g] = [...rows, ...waiting];
  }

  const overallRows = summary.map((s) => {
    const bests = GAME_IDS.map((g) => s.games[g].best).filter(Boolean);
    return {
      name: s.name,
      total: bests.reduce((sum, b) => sum + b.score, 0),
      played: bests.length > 0,
      // 동점이면 현재 점수에 먼저 도달한 사람이 위
      reachedAt: bests.reduce((m, b) => (b.finishedAt > m ? b.finishedAt : m), ''),
      games: Object.fromEntries(
        GAME_IDS.map((g) => [g, { used: s.games[g].used, score: s.games[g].best?.score ?? null }]),
      ),
    };
  });
  const played = overallRows
    .filter((r) => r.played)
    .sort((a, b) => b.total - a.total || (a.reachedAt < b.reachedAt ? -1 : 1))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const waiting = overallRows.filter((r) => !r.played).map((r) => ({ ...r, rank: null }));

  return {
    overall: [...played, ...waiting].map(({ reachedAt, played: _p, ...r }) => r),
    games,
    maxAttempts: MAX_ATTEMPTS,
    participants: players.length,
  };
}

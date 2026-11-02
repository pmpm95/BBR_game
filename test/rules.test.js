import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResult, peperoLength, peperoHoldMsFor, replayCards, scoreOf, PEPERO } from '../public/js/shared/rules.js';
import { buildLeaderboard } from '../server/leaderboard.js';

const deck = Array.from({ length: 36 }, (_, i) => Math.floor(i / 2)); // [0,0,1,1,...]
const perfectFlips = deck.map((_, i) => [i, 1000 + i * 500]);

test('카드: 완벽한 플레이 리플레이', () => {
  const r = replayCards(deck, perfectFlips);
  assert.deepEqual(r, { ok: true, timeMs: 1000 + 35 * 500, moves: 18 });
});

test('카드: 짝을 다 못 찾으면 거절', () => {
  assert.equal(replayCards(deck, perfectFlips.slice(0, 34)).ok, false);
});

test('카드: 이미 맞춘 카드를 다시 뒤집으면 거절', () => {
  const flips = [...perfectFlips.slice(0, 2), [0, 2000], [2, 2100], ...perfectFlips.slice(2)];
  assert.equal(replayCards(deck, flips).ok, false);
});

test('카드: 오답 포함 플레이', () => {
  const flips = [[0, 100], [2, 200], ...perfectFlips.map(([i, t]) => [i, t + 1000])];
  const r = replayCards(deck, flips);
  assert.equal(r.ok, true);
  assert.equal(r.moves, 19);
});

test('카드: 서버 경과시간보다 긴 기록은 거절', () => {
  assert.equal(evaluateResult('cards', { flips: perfectFlips }, { deck, serverElapsedMs: 5000 }).ok, false);
  assert.equal(evaluateResult('cards', { flips: perfectFlips }, { deck, serverElapsedMs: 30000 }).ok, true);
});

test('11.11초: 점수', () => {
  assert.equal(scoreOf('stopwatch', 11110).score, 1000);
  assert.equal(scoreOf('stopwatch', 11243).score, 867);
  assert.equal(scoreOf('stopwatch', 13000).score, 0);
  assert.match(scoreOf('stopwatch', 11243).display, /11\.243초 \(\+0\.133\)/);
});

test('빼빼로: 11.11km 도달 시간은 30초 한 판 안에 충분히 들어옴', () => {
  const ms = peperoHoldMsFor(PEPERO.targetKm);
  assert.ok(ms > 6000 && ms < 9000, `${ms}`);
  assert.ok(Math.abs(peperoLength(ms) - PEPERO.targetKm) < 1e-9);
});

test('빼빼로: 점수', () => {
  assert.equal(scoreOf('pepero', 11.11).score, 1000);
  assert.equal(scoreOf('pepero', 11.06).score, 950);
  assert.equal(scoreOf('pepero', PEPERO.maxKm).score, 0);
  const ev = evaluateResult('pepero', { holdMs: peperoHoldMsFor(11.11) }, { serverElapsedMs: 20000 });
  assert.equal(ev.ok, true);
  assert.equal(ev.raw, 11.11);
});

test('랭킹: 게임별 최고 기록 합산으로 종합 순위', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const mk = (playerId, game, raw, finishedAt) => ({ playerId, game, status: 'done', raw, finishedAt, ...scoreOf(game, raw) });
  const attempts = [
    mk('a', 'stopwatch', 11500, '1'),
    mk('a', 'stopwatch', 11120, '2'), // A 최고 990
    mk('b', 'stopwatch', 11110, '3'), // 1000
    mk('b', 'pepero', 11.2, '4'), // 910
    { playerId: 'c', game: 'cards', status: 'playing' },
  ];
  const lb = buildLeaderboard(players, attempts);
  assert.deepEqual(lb.overall.map((r) => [r.name, r.rank, r.total]), [['B', 1, 1910], ['A', 2, 990], ['C', null, 0]]);
  assert.deepEqual(lb.games.stopwatch.map((r) => [r.name, r.rank, r.used]), [['B', 1, 1], ['A', 2, 2], ['C', null, 0]]);
  assert.equal(lb.overall[2].games.cards.used, 1);
});

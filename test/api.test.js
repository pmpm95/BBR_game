import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-'));
fs.writeFileSync(path.join(dir, 'players.json'), JSON.stringify([
  { id: 'p01', name: '테스터', code: '4821' },
  { id: 'p02', name: '둘째', code: '7395' },
]));

let proc;
test.before(async () => {
  proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dir, ADMIN_PASSWORD: 'adminpw' },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${base}/api/leaderboard`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
});
test.after(() => proc.kill());

const call = async (method, url, body, token, headers = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

test('로그인 → 3회 도전 → 4번째는 거절 → 랭킹 반영', async () => {
  assert.equal((await call('POST', '/api/login', { code: '0000' })).status, 401);
  const { body: { token, me } } = await call('POST', '/api/login', { code: '4821' });
  assert.equal(me.name, '테스터');

  // 카드 게임: 서버가 준 덱으로 완벽 플레이
  const start = await call('POST', '/api/attempts', { game: 'cards' }, token);
  assert.equal(start.status, 201);
  const deck = start.body.attempt.deck;
  assert.equal(deck.length, 36);
  const pos = {};
  deck.forEach((s, i) => (pos[s] ??= []).push(i));
  const flips = Object.values(pos).flat().map((i, k) => [i, k * 10]);
  const done = await call('POST', `/api/attempts/${start.body.attempt.id}/result`, { payload: { flips } }, token);
  assert.equal(done.body.result.status, 'done');
  assert.equal(done.body.result.score, 1000);

  // 같은 결과 재전송은 동일 응답 (중복 기록 X)
  const again = await call('POST', `/api/attempts/${start.body.attempt.id}/result`, { payload: { flips: [] } }, token);
  assert.equal(again.body.result.score, 1000);

  // 11.11초: 서버 경과시간보다 훨씬 긴 기록 → 거절
  for (let i = 0; i < 3; i++) {
    const s = await call('POST', '/api/attempts', { game: 'stopwatch' }, token);
    assert.equal(s.status, 201);
    const r = await call('POST', `/api/attempts/${s.body.attempt.id}/result`, { payload: { stoppedMs: 11110 } }, token);
    assert.equal(r.body.result.status, 'rejected');
  }
  assert.equal((await call('POST', '/api/attempts', { game: 'stopwatch' }, token)).status, 403);

  const lb = (await call('GET', '/api/leaderboard')).body;
  assert.equal(lb.overall[0].name, '테스터');
  assert.equal(lb.overall[0].total, 1000);
  assert.equal(lb.overall[1].rank, null);
  assert.equal(JSON.stringify(lb).includes('4821'), false, '코드가 노출되면 안 됨');
});

test('다른 사람의 도전 기록에는 결과를 보낼 수 없음', async () => {
  const a = (await call('POST', '/api/login', { code: '4821' })).body.token;
  const b = (await call('POST', '/api/login', { code: '7395' })).body.token;
  const s = await call('POST', '/api/attempts', { game: 'pepero' }, b);
  assert.equal((await call('POST', `/api/attempts/${s.body.attempt.id}/result`, { payload: { holdMs: 100 } }, a)).status, 404);
});

test('관리자: 마감하면 새 도전 불가', async () => {
  assert.equal((await call('GET', '/api/admin/state')).status, 401);
  const H = { 'x-admin-password': 'adminpw' };
  assert.equal((await call('POST', '/api/admin/frozen', { frozen: true }, null, H)).status, 200);
  const t = (await call('POST', '/api/login', { code: '7395' })).body.token;
  assert.equal((await call('POST', '/api/attempts', { game: 'cards' }, t)).status, 403);
  assert.equal((await call('GET', '/api/leaderboard')).body.frozen, true);
});

test('정적 파일 경로 탈출 차단', async () => {
  const res = await fetch(`${base}/..%2fdata%2fplayers.json`);
  assert.notEqual(res.status, 200);
});

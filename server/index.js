// 빼빼로데이 챌린지 서버 - 외부 의존성 없이 Node.js 만으로 동작
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { buildLeaderboard, summarize } from '../public/js/shared/leaderboard.js';
import {
  CARDS,
  GAME_IDS,
  MAX_ATTEMPTS,
  evaluateResult,
  scoreOf,
} from '../public/js/shared/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const EVENT_END = process.env.EVENT_END ? new Date(process.env.EVENT_END) : null;
const RESULT_WINDOW_MS = 30 * 60 * 1000; // 시작 후 30분 안에 결과 전송

const store = new Store(process.env.DATA_DIR || path.join(ROOT, 'data'));
store.load();

// ── 유틸 ────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 200_000) throw new HttpError(413, '요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON 형식이 아닙니다.');
  }
}

function isFrozen() {
  return store.db.frozen || (EVENT_END && Date.now() >= EVENT_END.getTime());
}

function authPlayer(req) {
  const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
  const playerId = m && store.db.tokens[m[1]];
  const player = playerId && store.playerById(playerId);
  if (!player) throw new HttpError(401, '로그인이 필요합니다.');
  return player;
}

function requireAdmin(req) {
  if (!ADMIN_PASSWORD) throw new HttpError(403, '서버에 ADMIN_PASSWORD 가 설정되지 않았습니다.');
  const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
  const want = Buffer.from(ADMIN_PASSWORD);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new HttpError(401, '관리자 비밀번호가 틀렸습니다.');
  }
}

// 로그인 무차별 대입 방지 (IP당 10분에 10회 실패까지)
const loginFailures = new Map();
function checkLoginRate(ip) {
  const now = Date.now();
  const rec = loginFailures.get(ip);
  if (rec && rec.resetAt > now && rec.count >= 10) {
    throw new HttpError(429, '시도가 너무 많습니다. 잠시 후 다시 시도하세요.');
  }
}
function recordLoginFailure(ip) {
  const now = Date.now();
  const rec = loginFailures.get(ip);
  if (!rec || rec.resetAt <= now) loginFailures.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
  else rec.count += 1;
}

function shuffledDeck() {
  const deck = [];
  for (let i = 0; i < CARDS.pairs; i++) deck.push(i, i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ── 실시간 갱신 (Server-Sent Events) ───────────────────
const streams = new Set();
function broadcast() {
  for (const res of streams) res.write(`event: update\ndata: ${Date.now()}\n\n`);
}
setInterval(() => {
  for (const res of streams) res.write(': ping\n\n');
}, 25_000).unref();

function leaderboardPayload() {
  return {
    ...buildLeaderboard(store.players, store.db.attempts),
    frozen: Boolean(isFrozen()),
    eventEnd: EVENT_END ? EVENT_END.toISOString() : null,
  };
}

function mePayload(player) {
  const s = summarize([player], store.db.attempts).get(player.id);
  const games = {};
  for (const g of GAME_IDS) {
    const { used, best } = s.games[g];
    games[g] = {
      used,
      left: Math.max(0, MAX_ATTEMPTS - used),
      best: best && { score: best.score, display: best.display },
    };
  }
  return { id: player.id, name: player.name, games };
}

// ── 라우트 ───────────────────────────────────────────
async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;
  const ip = req.socket.remoteAddress || '';

  if (method === 'POST' && pathname === '/api/login') {
    checkLoginRate(ip);
    const { code } = await readJson(req);
    const player = /^\d{4}$/.test(String(code ?? '')) && store.playerByCode(code);
    if (!player) {
      recordLoginFailure(ip);
      throw new HttpError(401, '코드가 올바르지 않습니다.');
    }
    const token = crypto.randomBytes(24).toString('hex');
    store.db.tokens[token] = player.id;
    store.save();
    return sendJson(res, 200, { token, me: mePayload(player) });
  }

  if (method === 'POST' && pathname === '/api/logout') {
    const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
    if (m && store.db.tokens[m[1]]) {
      delete store.db.tokens[m[1]];
      store.save();
    }
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    return sendJson(res, 200, { me: mePayload(authPlayer(req)) });
  }

  if (method === 'GET' && pathname === '/api/leaderboard') {
    return sendJson(res, 200, leaderboardPayload());
  }

  if (method === 'GET' && pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    streams.add(res);
    req.on('close', () => streams.delete(res));
    return;
  }

  // 게임 시작 = 도전 기회 1회 차감
  if (method === 'POST' && pathname === '/api/attempts') {
    const player = authPlayer(req);
    if (isFrozen()) throw new HttpError(403, '이벤트가 마감되었습니다.');
    const { game } = await readJson(req);
    if (!GAME_IDS.includes(game)) throw new HttpError(400, '알 수 없는 게임입니다.');
    const used = store.db.attempts.filter((a) => a.playerId === player.id && a.game === game).length;
    if (used >= MAX_ATTEMPTS) throw new HttpError(403, '이 게임의 도전 기회를 모두 사용했습니다.');
    const attempt = {
      id: crypto.randomUUID(),
      playerId: player.id,
      game,
      status: 'playing',
      createdAt: new Date().toISOString(),
      ...(game === 'cards' ? { deck: shuffledDeck() } : {}),
    };
    store.db.attempts.push(attempt);
    store.save();
    broadcast();
    return sendJson(res, 201, {
      attempt: { id: attempt.id, game, deck: attempt.deck },
      me: mePayload(player),
    });
  }

  const resultMatch = /^\/api\/attempts\/([\w-]+)\/result$/.exec(pathname);
  if (method === 'POST' && resultMatch) {
    const player = authPlayer(req);
    const attempt = store.db.attempts.find((a) => a.id === resultMatch[1]);
    if (!attempt || attempt.playerId !== player.id) throw new HttpError(404, '도전 기록을 찾을 수 없습니다.');
    const respond = () =>
      sendJson(res, 200, {
        result: {
          status: attempt.status,
          score: attempt.score ?? 0,
          display: attempt.display ?? null,
          reason: attempt.rejectReason ?? null,
        },
        me: mePayload(player),
        leaderboard: leaderboardPayload(),
      });
    if (attempt.status !== 'playing') return respond(); // 재전송은 같은 결과 반환
    const body = await readJson(req);
    const serverElapsedMs = Date.now() - new Date(attempt.createdAt).getTime();
    if (serverElapsedMs > RESULT_WINDOW_MS) {
      throw new HttpError(403, '결과 전송 가능 시간이 지났습니다.');
    }
    const ev = evaluateResult(attempt.game, body.payload, { deck: attempt.deck, serverElapsedMs });
    attempt.finishedAt = new Date().toISOString();
    if (!ev.ok) {
      attempt.status = 'rejected';
      attempt.rejectReason = ev.reason;
    } else {
      const s = scoreOf(attempt.game, ev.raw);
      Object.assign(attempt, { status: 'done', raw: ev.raw, ...s, detail: ev.detail });
    }
    store.save();
    broadcast();
    return respond();
  }

  // ── 관리자 ──
  if (pathname.startsWith('/api/admin/')) {
    requireAdmin(req);
    const nameOf = (id) => store.playerById(id)?.name ?? id;

    if (method === 'GET' && pathname === '/api/admin/state') {
      return sendJson(res, 200, {
        frozen: Boolean(isFrozen()),
        manualFrozen: store.db.frozen,
        eventEnd: EVENT_END ? EVENT_END.toISOString() : null,
        players: store.players.map((p) => ({ id: p.id, name: p.name })),
        attempts: store.db.attempts.map(({ deck, ...a }) => ({ ...a, name: nameOf(a.playerId) })),
      });
    }
    if (method === 'POST' && pathname === '/api/admin/frozen') {
      const { frozen } = await readJson(req);
      store.db.frozen = Boolean(frozen);
      store.save();
      broadcast();
      return sendJson(res, 200, { frozen: Boolean(isFrozen()) });
    }
    const del = /^\/api\/admin\/attempts\/([\w-]+)$/.exec(pathname);
    if (method === 'DELETE' && del) {
      const before = store.db.attempts.length;
      store.db.attempts = store.db.attempts.filter((a) => a.id !== del[1]);
      if (store.db.attempts.length === before) throw new HttpError(404, '없는 기록입니다.');
      store.save();
      broadcast();
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'POST' && pathname === '/api/admin/reset') {
      store.db.attempts = [];
      store.save();
      broadcast();
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'GET' && pathname === '/api/admin/export.csv') {
      const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
      const lines = [
        ['이름', '게임', '상태', '기록', '점수', '시작', '종료', '비고'].map(esc).join(','),
        ...store.db.attempts.map((a) =>
          [nameOf(a.playerId), a.game, a.status, a.display, a.score, a.createdAt, a.finishedAt, a.rejectReason]
            .map(esc)
            .join(','),
        ),
      ];
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="pepero-results.csv"',
      });
      return res.end('﻿' + lines.join('\n'));
    }
  }

  throw new HttpError(404, '없는 API 입니다.');
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin') rel = '/admin.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
    else throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : '서버 오류' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🍫 빼빼로데이 챌린지 서버 실행 중: http://${HOST}:${PORT}`);
  console.log(`   참가자 ${store.players.length}명 · 관리자 페이지 /admin ${ADMIN_PASSWORD ? '' : '(ADMIN_PASSWORD 미설정)'}`);
  if (EVENT_END) console.log(`   마감: ${EVENT_END.toLocaleString('ko-KR')}`);
});

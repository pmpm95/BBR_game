// Copilot Managed Runtime 내장 앱 상태(state) 저장소 접근
// 계약: /.ms/state/{collection}/items  (POST 생성 · GET 목록(@odata.nextLink 페이지) · PUT 전체 교체(If-Match) · DELETE)
// 인증은 호스트(App Player)가 자동으로 붙여줌
//
// 로컬 확인용 모의 모드: 주소 뒤에 ?mock&user=홍길동  → 브라우저 localStorage 에 저장
import { getUser } from '@microsoft/managed-apps/auth';

const params = new URLSearchParams(location.search);
export const MOCK = params.has('mock');
const BASE = '/.ms/state';
const SERVER_FIELDS = ['itemId', 'createdTime', 'modifiedTime', '@odata.etag', '@ms.scope'];

export class StoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** 로그인한 사용자 (회사 계정) */
export async function currentUser() {
  if (MOCK) {
    const name = params.get('user') || '테스트 사용자';
    return { id: `mock-${name}`, name };
  }
  const u = await getUser();
  return { id: u.objectId, name: u.fullName };
}

/** 서버가 관리하는 필드를 뺀 쓰기용 문서 */
export function writable(item) {
  return Object.fromEntries(
    Object.entries(item).filter(([k, v]) => !SERVER_FIELDS.includes(k) && v !== undefined && v !== null),
  );
}

async function http(method, url, body, etag) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (etag) headers['If-Match'] = etag;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new StoreError(0, '데이터 저장소에 연결할 수 없습니다. 네트워크를 확인해주세요.');
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* 무시 */
    }
    throw new StoreError(res.status, `저장소 오류 (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

const itemsUrl = (c) => `${BASE}/${encodeURIComponent(c)}/items`;
const itemUrl = (c, id) => `${itemsUrl(c)}/${encodeURIComponent(id)}`;

const real = {
  async list(collection) {
    const out = [];
    let url = itemsUrl(collection);
    while (url) {
      const page = await http('GET', url);
      out.push(...(page?.value ?? []));
      url = page?.['@odata.nextLink'];
    }
    return out;
  },
  get: (collection, id) => http('GET', itemUrl(collection, id)),
  create: (collection, doc) => http('POST', itemsUrl(collection), writable(doc)),
  replace: (collection, id, doc, etag) => http('PUT', itemUrl(collection, id), writable(doc), etag),
  remove: (collection, id) => http('DELETE', itemUrl(collection, id)),
};

// ── 모의 저장소 (localStorage) ──
const MOCK_KEY = 'pp_mock_state';
function mockDb() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY)) || {};
  } catch {
    return {};
  }
}
function mockSave(db) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(db));
}
function stamp(id, doc, created) {
  const now = new Date().toISOString();
  return {
    ...writable(doc),
    itemId: id,
    createdTime: created ?? now,
    modifiedTime: now,
    '@odata.etag': `W/"${Date.now()}${Math.random().toString(16).slice(2, 6)}"`,
  };
}
const mock = {
  async list(c) {
    return Object.values(mockDb()[c] ?? {});
  },
  async get(c, id) {
    const item = mockDb()[c]?.[id];
    if (!item) throw new StoreError(404, '없는 항목');
    return item;
  },
  async create(c, doc) {
    const db = mockDb();
    const id = crypto.randomUUID();
    db[c] = { ...(db[c] ?? {}), [id]: stamp(id, doc) };
    mockSave(db);
    return db[c][id];
  },
  async replace(c, id, doc, etag) {
    const db = mockDb();
    const prev = db[c]?.[id];
    if (prev && etag && prev['@odata.etag'] !== etag) throw new StoreError(412, '다른 곳에서 먼저 수정됨');
    db[c] = { ...(db[c] ?? {}), [id]: stamp(id, doc, prev?.createdTime) };
    mockSave(db);
    return db[c][id];
  },
  async remove(c, id) {
    const db = mockDb();
    if (db[c]) delete db[c][id];
    mockSave(db);
  },
};

export const store = MOCK ? mock : real;

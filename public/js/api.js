const TOKEN_KEY = 'pp_token';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장소 사용 불가 시 무시 */
  }
}

export const storage = { get: safeGet, set: safeSet };

let token = safeGet(TOKEN_KEY);

export function getToken() {
  return token;
}
export function setToken(t) {
  token = t;
  safeSet(TOKEN_KEY, t);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(method, url, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `요청 실패 (${res.status})`);
  return data;
}

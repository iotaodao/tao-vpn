const TOKEN_KEY = "tao_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  phoneRequest: (phone) => request("/auth/phone/request", { method: "POST", body: { phone }, auth: false }),
  phoneVerify:  (phone, code) => request("/auth/phone/verify",  { method: "POST", body: { phone, code }, auth: false }),
  emailRequest: (email) => request("/auth/email/request", { method: "POST", body: { email }, auth: false }),
  emailVerify:  (email, code) => request("/auth/email/verify",  { method: "POST", body: { email, code }, auth: false }),
  tgStart:      () => request("/auth/telegram/start", { method: "POST", auth: false }),
  tgPoll:       (state) => request(`/auth/telegram/poll?state=${encodeURIComponent(state)}`, { auth: false }),
  me:           () => request("/auth/me"),
  logout:       () => request("/auth/logout", { method: "POST" }),

  // data
  status:        () => request("/status"),
  configs:       () => request("/configs"),
  notifications: () => request("/notifications"),

  // push
  vapidKey:        () => request("/push/vapid"),
  subscribePush:   (subscription) => request("/push/subscribe", { method: "POST", body: { subscription } }),
  unsubscribePush: (endpoint) => request("/push/unsubscribe", { method: "POST", body: { endpoint } }),

  // matrix (TAO SPACE integration)
  matrixCredentials: () => request("/matrix/credentials"),
  matrixStatus:      () => request("/matrix/status"),
  matrixSyncProfile: (display_name, avatar_mxc) =>
    request("/matrix/sync-profile", { method: "POST", body: { display_name, avatar_mxc } }),
};

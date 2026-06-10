import { nanoid } from "nanoid";
import { db, now } from "../db.js";
import { signSession } from "./jwt.js";

let findInviteByTg, findInviteByPhone, findInviteByEmail, markInviteUsed;
let findUserByTg, findUserByPhone, findUserByEmail, insertUser, insertSession, updateUserSeen;

function initStatements() {
  if (findInviteByTg) return;
  findInviteByTg    = db.prepare("SELECT * FROM invites WHERE telegram_id = ? AND used_by IS NULL");
  findInviteByPhone = db.prepare("SELECT * FROM invites WHERE phone = ? AND used_by IS NULL");
  findInviteByEmail = db.prepare("SELECT * FROM invites WHERE email = ? AND used_by IS NULL");
  markInviteUsed    = db.prepare("UPDATE invites SET used_by = ? WHERE id = ?");
  findUserByTg      = db.prepare("SELECT * FROM users WHERE telegram_id = ?");
  findUserByPhone   = db.prepare("SELECT * FROM users WHERE phone = ?");
  findUserByEmail   = db.prepare("SELECT * FROM users WHERE email = ?");
  insertUser        = db.prepare(`INSERT INTO users (id, name, telegram_id, telegram_handle, phone, email, primary_method, is_admin, is_active, created_at) VALUES (@id, @name, @telegram_id, @telegram_handle, @phone, @email, @primary_method, @is_admin, 1, @created_at)`);
  insertSession     = db.prepare(`INSERT INTO sessions (id, user_id, device_label, user_agent, ip, created_at, last_seen_at, expires_at) VALUES (@id, @user_id, @device_label, @user_agent, @ip, @created_at, @last_seen_at, @expires_at)`);
  updateUserSeen    = db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?");
}

const SESSION_TTL_DAYS = 90;

export function loginOrRegister({ identity, method, deviceLabel, userAgent, ip }) {
  initStatements();
  let user;
  if (method === "telegram") user = findUserByTg.get(identity.telegram_id);
  else if (method === "phone") user = findUserByPhone.get(identity.phone);
  else if (method === "email") user = findUserByEmail.get(identity.email);

  if (!user) {
    let invite;
    if (method === "telegram") invite = findInviteByTg.get(identity.telegram_id);
    else if (method === "phone") invite = findInviteByPhone.get(identity.phone);
    else if (method === "email") invite = findInviteByEmail.get(identity.email);
    if (!invite) {
      const err = new Error("no_invite");
      err.statusCode = 403;
      throw err;
    }
    const userId = nanoid(16);
    const userRow = { id: userId, name: invite.name, telegram_id: identity.telegram_id || invite.telegram_id || null, telegram_handle: identity.telegram_handle || null, phone: identity.phone || invite.phone || null, email: identity.email || invite.email || null, primary_method: method, is_admin: 0, created_at: now() };
    db.transaction(() => { insertUser.run(userRow); markInviteUsed.run(userId, invite.id); })();
    user = { ...userRow, is_active: 1, last_seen_at: null };
  }

  const sessionId = nanoid(24);
  const ts = now();
  insertSession.run({ id: sessionId, user_id: user.id, device_label: deviceLabel || null, user_agent: userAgent || null, ip: ip || null, created_at: ts, last_seen_at: ts, expires_at: ts + SESSION_TTL_DAYS * 86400_000 });
  updateUserSeen.run(ts, user.id);
  return { user, sessionId };
}

export async function issueToken({ userId, sessionId }) {
  return await signSession({ userId, sessionId, ttlDays: SESSION_TTL_DAYS });
}

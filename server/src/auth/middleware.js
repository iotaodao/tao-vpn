import { verifySession } from "./jwt.js";
import { db, now } from "../db.js";

let getSession, touchSession, getUser;

function authError(message, code) {
  const e = new Error(message);
  e.statusCode = code;
  return e;
}

export async function authPlugin(fastify) {
  fastify.decorate("requireAuth", async (req, reply) => {
    if (!getSession) {
      getSession = db.prepare("SELECT * FROM sessions WHERE id = ?");
      touchSession = db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?");
      getUser = db.prepare("SELECT * FROM users WHERE id = ? AND is_active = 1");
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw authError("no_token", 401);

    let payload;
    try {
      payload = await verifySession(token);
    } catch {
      throw authError("bad_token", 401);
    }

    const session = getSession.get(payload.sessionId);
    if (!session || session.revoked_at) throw authError("session_revoked", 401);
    if (session.expires_at < now()) throw authError("session_expired", 401);

    const user = getUser.get(payload.userId);
    if (!user) throw authError("user_inactive", 401);

    touchSession.run(now(), session.id);
    req.user = user;
    req.session = session;
  });

  fastify.decorate("requireAdmin", async (req, reply) => {
    await fastify.requireAuth(req, reply);
    if (!req.user?.is_admin) throw authError("admin_only", 403);
  });
}

import { verifySession } from "./jwt.js";
import { db, now } from "../db.js";

// Объявляем переменные здесь, но НЕ вызываем db.prepare сразу
let getSession;
let touchSession;
let getUser;

export async function authPlugin(fastify) {
  fastify.decorate("requireAuth", async (req, reply) => {
    // Отложенная подготовка (Lazy load): запросы скомпилируются 
    // только при первой реальной попытке авторизации.
    // К этому моменту таблицы в БД уже 100% будут созданы.
    if (!getSession) {
      getSession = db.prepare("SELECT * FROM sessions WHERE id = ?");
      touchSession = db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?");
      getUser = db.prepare("SELECT * FROM users WHERE id = ? AND is_active = 1");
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    
    if (!token) return reply.code(401).send({ error: "no_token" });
    
    let payload;
    try { 
      payload = await verifySession(token); 
    } catch { 
      return reply.code(401).send({ error: "bad_token" }); 
    }
    
    const session = getSession.get(payload.sessionId);
    if (!session || session.revoked_at) return reply.code(401).send({ error: "session_revoked" });
    if (session.expires_at < now()) return reply.code(401).send({ error: "session_expired" });
    
    const user = getUser.get(payload.userId);
    if (!user) return reply.code(401).send({ error: "user_inactive" });
    
    touchSession.run(now(), session.id);
    req.user = user;
    req.session = session;
  });

  fastify.decorate("requireAdmin", async (req, reply) => {
    await fastify.requireAuth(req, reply);
    if (reply.sent) return;
    if (!req.user.is_admin) return reply.code(403).send({ error: "admin_only" });
  });
}

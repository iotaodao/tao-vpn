import { nanoid } from "nanoid";
import { db, now } from "../db.js";
import * as push from "../services/webpush.js";

// 1. Оставляем только пустые переменные
let listServers;
let listConfigsForUser;
let listNotifications;
let getUrgent;
let insertPushSub;
let removePushSubByEndpoint;

// 2. Функция отложенной инициализации
function initStatements() {
  if (listServers) return; // Защита от повторного выполнения

  listServers = db.prepare("SELECT * FROM servers ORDER BY position ASC, name ASC");
  
  listConfigsForUser = db.prepare("SELECT * FROM configs WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC");
  
  listNotifications = db.prepare(`
    SELECT * FROM notifications
    WHERE audience = 'all' OR audience = ?
    ORDER BY created_at DESC LIMIT 50
  `);
  
  getUrgent = db.prepare("SELECT * FROM urgent_message WHERE id = 1");
  
  insertPushSub = db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      failures = 0
  `);
  
  removePushSubByEndpoint = db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?");
}

export default async function appRoutes(fastify) {
  // 3. Вызываем инициализацию перед обработкой любого роута в этом файле
  fastify.addHook('onRequest', async (request, reply) => {
     initStatements();
  });

  // Public-ish (auth required everywhere — VPN is private)

  fastify.get("/status", { preHandler: fastify.requireAuth }, async () => {
    const servers = listServers.all();
    const urgent = getUrgent.get();
    return {
      servers,
      urgent: urgent?.active ? {
        active: true,
        type: urgent.type,
        title: urgent.title,
        body: urgent.body,
        cta_label: urgent.cta_label,
        cta_tab: urgent.cta_tab,
        updated_at: urgent.updated_at,
      } : { active: false },
    };
  });

  fastify.get("/configs", { preHandler: fastify.requireAuth }, async (req) => {
    return { configs: listConfigsForUser.all(req.user.id) };
  });

  fastify.get("/notifications", { preHandler: fastify.requireAuth }, async (req) => {
    return { notifications: listNotifications.all(req.user.id) };
  });

  fastify.get("/push/vapid", { preHandler: fastify.requireAuth }, async () => {
    return { publicKey: push.publicKey() };
  });

  fastify.post("/push/subscribe", { preHandler: fastify.requireAuth }, async (req, reply) => {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return reply.code(400).send({ error: "bad_subscription" });
    }
    insertPushSub.run(
      nanoid(16), req.user.id, sub.endpoint,
      sub.keys.p256dh, sub.keys.auth,
      req.headers["user-agent"] || null, now()
    );
    return { ok: true };
  });

  fastify.post("/push/unsubscribe", { preHandler: fastify.requireAuth }, async (req) => {
    const endpoint = req.body?.endpoint;
    if (endpoint) removePushSubByEndpoint.run(endpoint, req.user.id);
    return { ok: true };
  });
}

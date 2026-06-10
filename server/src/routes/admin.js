import { nanoid } from "nanoid";
import { db, now } from "../db.js";
import * as push from "../services/webpush.js";

let stmts;

function init() {
  if (stmts) return;
  stmts = {
    upsertUrgent: db.prepare(`UPDATE urgent_message SET active = @active, type = @type, title = @title, body = @body, cta_label = @cta_label, cta_tab = @cta_tab, updated_at = @updated_at WHERE id = 1`),

    insertServer: db.prepare(`INSERT INTO servers (id, name, location, protocol, status, latency_ms, load_pct, position, updated_at) VALUES (@id, @name, @location, @protocol, @status, @latency_ms, @load_pct, @position, @updated_at)`),
    updateServer: db.prepare(`UPDATE servers SET name = @name, location = @location, protocol = @protocol, status = @status, latency_ms = @latency_ms, load_pct = @load_pct, position = @position, updated_at = @updated_at WHERE id = @id`),
    deleteServer: db.prepare("DELETE FROM servers WHERE id = ?"),

    insertConfig: db.prepare(`INSERT INTO configs (id, user_id, server_id, name, uri, is_active, created_at, updated_at) VALUES (@id, @user_id, @server_id, @name, @uri, 1, @t, @t)`),
    deactivateConfig: db.prepare("UPDATE configs SET is_active = 0 WHERE id = ?"),
    updateConfigUri: db.prepare("UPDATE configs SET uri = ?, updated_at = ? WHERE id = ?"),

    insertNotification: db.prepare(`INSERT INTO notifications (id, type, title, body, audience, created_at, created_by) VALUES (@id, @type, @title, @body, @audience, @created_at, @created_by)`),

    insertInvite: db.prepare(`INSERT INTO invites (id, name, telegram_id, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
    listInvites: db.prepare("SELECT * FROM invites ORDER BY created_at DESC"),
    deleteInvite: db.prepare("DELETE FROM invites WHERE id = ?"),

    listUsers: db.prepare("SELECT id, name, primary_method, telegram_handle, phone, email, is_admin, is_active, created_at, last_seen_at FROM users ORDER BY created_at DESC"),
    setAdmin: db.prepare("UPDATE users SET is_admin = ? WHERE id = ?"),
    deactivateUser: db.prepare("UPDATE users SET is_active = ? WHERE id = ?"),
  };
}

export default async function adminRoutes(fastify) {
  fastify.addHook("onRequest", async () => { init(); });
  // fastify.addHook("preHandler", fastify.requireAdmin);

  // ═══════════════════════════════════════════════════════
  // URGENT BANNER
  // ═══════════════════════════════════════════════════════

  fastify.put("/urgent", async (req) => {
    const b = req.body || {};
    stmts.upsertUrgent.run({
      active: b.active ? 1 : 0,
      type: b.type || null,
      title: b.title || null,
      body: b.body || null,
      cta_label: b.cta_label || null,
      cta_tab: b.cta_tab || null,
      updated_at: now(),
    });
    if (b.active && b.push !== false) {
      await push.sendBroadcast({
        title: b.title || "TAO VPN",
        body: b.body || "Откройте приложение",
        tag: "urgent",
        url: "/",
      });
    }
    return { ok: true };
  });

  fastify.delete("/urgent", async () => {
    stmts.upsertUrgent.run({
      active: 0, type: null, title: null, body: null,
      cta_label: null, cta_tab: null, updated_at: now(),
    });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════
  // SERVERS
  // ═══════════════════════════════════════════════════════

  fastify.post("/servers", async (req) => {
    const b = req.body || {};
    const row = {
      id: b.id || nanoid(8),
      name: b.name,
      location: b.location,
      protocol: b.protocol,
      status: b.status || "online",
      latency_ms: b.latency_ms ?? null,
      load_pct: b.load_pct ?? 0,
      position: b.position ?? 0,
      updated_at: now(),
    };
    stmts.insertServer.run(row);
    return { ok: true, server: row };
  });

  fastify.put("/servers/:id", async (req) => {
    const b = req.body || {};
    stmts.updateServer.run({
      id: req.params.id,
      name: b.name,
      location: b.location,
      protocol: b.protocol,
      status: b.status,
      latency_ms: b.latency_ms ?? null,
      load_pct: b.load_pct ?? 0,
      position: b.position ?? 0,
      updated_at: now(),
    });
    return { ok: true };
  });

  fastify.delete("/servers/:id", async (req) => {
    stmts.deleteServer.run(req.params.id);
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════
  // CONFIGS (per-user VPN keys)
  // ═══════════════════════════════════════════════════════

  fastify.post("/configs", async (req) => {
    const b = req.body || {};
    const t = now();
    const id = nanoid(16);
    stmts.insertConfig.run({
      id,
      user_id: b.user_id,
      server_id: b.server_id,
      name: b.name,
      uri: b.uri,
      t,
    });
    if (b.notify !== false) {
      const nid = nanoid(16);
      stmts.insertNotification.run({
        id: nid,
        type: "config",
        title: b.notify_title || `Обновлён конфиг: ${b.name}`,
        body: b.notify_body || "Новый ключ доступен. Импортируйте в клиент.",
        audience: b.user_id,
        created_at: t,
        created_by: req.user.id,
      });
      await push.sendToUser(b.user_id, {
        title: b.notify_title || "Обновлён конфиг",
        body: b.notify_body || "Откройте приложение и обновите ключ.",
        tag: "config",
        url: "/",
      });
    }
    return { ok: true, id };
  });

  fastify.put("/configs/:id/uri", async (req) => {
    stmts.updateConfigUri.run(req.body.uri, now(), req.params.id);
    return { ok: true };
  });

  fastify.delete("/configs/:id", async (req) => {
    stmts.deactivateConfig.run(req.params.id);
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════
  // NOTIFICATIONS (broadcast or per-user)
  // ═══════════════════════════════════════════════════════

  fastify.post("/notifications", async (req) => {
    const b = req.body || {};
    const id = nanoid(16);
    const t = now();
    stmts.insertNotification.run({
      id,
      type: b.type || "info",
      title: b.title,
      body: b.body,
      audience: b.audience || "all",
      created_at: t,
      created_by: req.user.id,
    });
    if (b.push !== false) {
      const payload = { title: b.title, body: b.body, tag: id, url: "/" };
      if (b.audience && b.audience !== "all") {
        await push.sendToUser(b.audience, payload);
      } else {
        await push.sendBroadcast(payload);
      }
    }
    return { ok: true, id };
  });

  // ═══════════════════════════════════════════════════════
  // INVITES (whitelist management)
  // ═══════════════════════════════════════════════════════

  fastify.get("/invites", async () => {
    return { invites: stmts.listInvites.all() };
  });

  fastify.post("/invites", async (req, reply) => {
    const b = req.body || {};
    if (!b.name || (!b.telegram_id && !b.phone && !b.email)) {
      return reply.code(400).send({ error: "name and at least one identity required" });
    }
    const id = nanoid(12);
    stmts.insertInvite.run(id, b.name, b.telegram_id || null, b.phone || null, b.email || null, now());
    return { ok: true, id };
  });

  fastify.delete("/invites/:id", async (req) => {
    stmts.deleteInvite.run(req.params.id);
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════

  fastify.get("/users", async () => {
    return { users: stmts.listUsers.all() };
  });

  fastify.put("/users/:id/admin", async (req) => {
    stmts.setAdmin.run(req.body.is_admin ? 1 : 0, req.params.id);
    return { ok: true };
  });

  fastify.put("/users/:id/active", async (req) => {
    stmts.deactivateUser.run(req.body.is_active ? 1 : 0, req.params.id);
    return { ok: true };
  });
}

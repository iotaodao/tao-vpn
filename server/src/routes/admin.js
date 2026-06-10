import { nanoid } from "nanoid";
import { db, now } from "../db.js";
import * as push from "../services/webpush.js";

const upsertUrgent = db.prepare(`
  UPDATE urgent_message
  SET active = @active, type = @type, title = @title, body = @body,
      cta_label = @cta_label, cta_tab = @cta_tab, updated_at = @updated_at
  WHERE id = 1
`);

const insertServer = db.prepare(`
  INSERT INTO servers (id, name, location, protocol, status, latency_ms, load_pct, position, updated_at)
  VALUES (@id, @name, @location, @protocol, @status, @latency_ms, @load_pct, @position, @updated_at)
`);
const updateServer = db.prepare(`
  UPDATE servers SET name = @name, location = @location, protocol = @protocol,
    status = @status, latency_ms = @latency_ms, load_pct = @load_pct,
    position = @position, updated_at = @updated_at
  WHERE id = @id
`);
const deleteServer = db.prepare("DELETE FROM servers WHERE id = ?");

const insertConfig = db.prepare(`
  INSERT INTO configs (id, user_id, server_id, name, uri, is_active, created_at, updated_at)
  VALUES (@id, @user_id, @server_id, @name, @uri, 1, @t, @t)
`);
const deactivateConfig = db.prepare("UPDATE configs SET is_active = 0 WHERE id = ?");
const updateConfigUri = db.prepare("UPDATE configs SET uri = ?, updated_at = ? WHERE id = ?");

const insertNotification = db.prepare(`
  INSERT INTO notifications (id, type, title, body, audience, created_at, created_by)
  VALUES (@id, @type, @title, @body, @audience, @created_at, @created_by)
`);

const insertInvite = db.prepare(`
  INSERT INTO invites (id, name, telegram_id, phone, email, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const listInvites = db.prepare("SELECT * FROM invites ORDER BY created_at DESC");
const listUsers = db.prepare("SELECT id, name, primary_method, telegram_handle, phone, email, is_admin, is_active, created_at, last_seen_at FROM users ORDER BY created_at DESC");

export default async function adminRoutes(fastify) {
  fastify.addHook("preHandler", fastify.requireAdmin);

  // --- Urgent banner ---
  fastify.put("/urgent", async (req) => {
    const b = req.body || {};
    upsertUrgent.run({
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
    upsertUrgent.run({
      active: 0, type: null, title: null, body: null,
      cta_label: null, cta_tab: null, updated_at: now(),
    });
    return { ok: true };
  });

  // --- Servers ---
  fastify.post("/servers", async (req) => {
    const b = req.body || {};
    const row = {
      id: b.id || nanoid(8),
      name: b.name, location: b.location, protocol: b.protocol,
      status: b.status || "online",
      latency_ms: b.latency_ms ?? null,
      load_pct: b.load_pct ?? 0,
      position: b.position ?? 0,
      updated_at: now(),
    };
    insertServer.run(row);
    return { ok: true, server: row };
  });

  fastify.put("/servers/:id", async (req) => {
    const b = req.body || {};
    updateServer.run({
      id: req.params.id,
      name: b.name, location: b.location, protocol: b.protocol,
      status: b.status, latency_ms: b.latency_ms ?? null,
      load_pct: b.load_pct ?? 0, position: b.position ?? 0,
      updated_at: now(),
    });
    return { ok: true };
  });

  fastify.delete("/servers/:id", async (req) => {
    deleteServer.run(req.params.id);
    return { ok: true };
  });

  // --- Configs (publish to user, also creates a "config" notification + push) ---
  fastify.post("/configs", async (req) => {
    const b = req.body || {};
    const t = now();
    const id = nanoid(16);
    insertConfig.run({
      id, user_id: b.user_id, server_id: b.server_id,
      name: b.name, uri: b.uri, t,
    });
    if (b.notify !== false) {
      const nid = nanoid(16);
      insertNotification.run({
        id: nid, type: "config",
        title: b.notify_title || `Обновлён конфиг: ${b.name}`,
        body: b.notify_body || "Новый ключ доступен. Импортируйте в клиент.",
        audience: b.user_id, created_at: t, created_by: req.user.id,
      });
      await push.sendToUser(b.user_id, {
        title: b.notify_title || "Обновлён конфиг",
        body: b.notify_body || "Откройте приложение и обновите ключ.",
        tag: "config", url: "/",
      });
    }
    return { ok: true, id };
  });

  fastify.put("/configs/:id/uri", async (req) => {
    updateConfigUri.run(req.body.uri, now(), req.params.id);
    return { ok: true };
  });

  fastify.delete("/configs/:id", async (req) => {
    deactivateConfig.run(req.params.id);
    return { ok: true };
  });

  // --- Notifications (manual broadcast) ---
  fastify.post("/notifications", async (req) => {
    const b = req.body || {};
    const id = nanoid(16);
    const t = now();
    insertNotification.run({
      id, type: b.type || "info",
      title: b.title, body: b.body,
      audience: b.audience || "all",
      created_at: t, created_by: req.user.id,
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

  // --- Invites & users ---
  fastify.get("/invites", async () => ({ invites: listInvites.all() }));
  fastify.post("/invites", async (req) => {
    const b = req.body || {};
    if (!b.name || (!b.telegram_id && !b.phone && !b.email)) {
      return { error: "name and at least one identity required" };
    }
    const id = nanoid(12);
    insertInvite.run(id, b.name, b.telegram_id || null, b.phone || null, b.email || null, now());
    return { ok: true, id };
  });

  fastify.get("/users", async () => ({ users: listUsers.all() }));
}

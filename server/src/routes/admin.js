import { nanoid } from "nanoid";
import { db, now } from "../db.js";
import * as push from "../services/webpush.js";

let upsertUrgent, insertServer, updateServer, deleteServer, insertConfig, deactivateConfig, updateConfigUri, insertNotification, insertInvite, listInvites, listUsers;

function initStatements() {
  if (upsertUrgent) return;
  upsertUrgent = db.prepare(`UPDATE urgent_message SET active = @active, type = @type, title = @title, body = @body, cta_label = @cta_label, cta_tab = @cta_tab, updated_at = @updated_at WHERE id = 1`);
  insertServer = db.prepare(`INSERT INTO servers (id, name, location, protocol, status, latency_ms, load_pct, position, updated_at) VALUES (@id, @name, @location, @protocol, @status, @latency_ms, @load_pct, @position, @updated_at)`);
  updateServer = db.prepare(`UPDATE servers SET name = @name, location = @location, protocol = @protocol, status = @status, latency_ms = @latency_ms, load_pct = @load_pct, position = @position, updated_at = @updated_at WHERE id = @id`);
  deleteServer = db.prepare("DELETE FROM servers WHERE id = ?");
  insertConfig = db.prepare(`INSERT INTO configs (id, user_id, server_id, name, uri, is_active, created_at, updated_at) VALUES (@id, @user_id, @server_id, @name, @uri, 1, @t, @t)`);
  deactivateConfig = db.prepare("UPDATE configs SET is_active = 0 WHERE id = ?");
  updateConfigUri = db.prepare("UPDATE configs SET uri = ?, updated_at = ? WHERE id = ?");
  insertNotification = db.prepare(`INSERT INTO notifications (id, type, title, body, audience, created_at, created_by) VALUES (@id, @type, @title, @body, @audience, @created_at, @created_by)`);
  insertInvite = db.prepare(`INSERT INTO invites (id, name, telegram_id, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  listInvites = db.prepare("SELECT * FROM invites ORDER BY created_at DESC");
  listUsers = db.prepare("SELECT id, name, primary_method, telegram_handle, phone, email, is_admin, is_active, created_at, last_seen_at FROM users ORDER BY created_at DESC");
}

export default async function adminRoutes(fastify) {
  initStatements();
  fastify.addHook("preHandler", fastify.requireAdmin);

  fastify.put("/urgent", async (req) => {
    const b = req.body || {};
    upsertUrgent.run({ active: b.active ? 1 : 0, type: b.type || null, title: b.title || null, body: b.body || null, cta_label: b.cta_label || null, cta_tab: b.cta_tab || null, updated_at: now() });
    if (b.active && b.push !== false) {
      await push.sendBroadcast({ title: b.title || "TAO VPN", body: b.body || "Откройте приложение", tag: "urgent", url: "/" });
    }
    return { ok: true };
  });

  // ... (остальные роуты админки) ...
  
  fastify.get("/users", async () => ({ users: listUsers.all() }));
}

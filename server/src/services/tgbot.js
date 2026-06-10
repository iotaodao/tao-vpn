import { Bot } from "grammy";
import { nanoid } from "nanoid";
import { db, now } from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS tg_auth (
    state TEXT PRIMARY KEY,
    telegram_id TEXT,
    telegram_name TEXT,
    telegram_user TEXT,
    confirmed_at INTEGER,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

let insertState, confirmState, getState, consumeState;

function initTgStatements() {
  if (insertState) return;
  insertState = db.prepare(`INSERT INTO tg_auth (state, expires_at, created_at) VALUES (?, ?, ?)`);
  confirmState = db.prepare(`UPDATE tg_auth SET telegram_id = ?, telegram_name = ?, telegram_user = ?, confirmed_at = ? WHERE state = ? AND confirmed_at IS NULL AND expires_at > ?`);
  getState = db.prepare(`SELECT * FROM tg_auth WHERE state = ?`);
  consumeState = db.prepare(`DELETE FROM tg_auth WHERE state = ?`);
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function createTgAuthState() {
  initTgStatements();
  const state = nanoid(24);
  insertState.run(state, now() + STATE_TTL_MS, now());
  return state;
}

export function pollTgAuth(state) {
  initTgStatements();
  const row = getState.get(state);
  if (!row) return { status: "unknown" };
  if (row.expires_at < now()) return { status: "expired" };
  if (!row.confirmed_at) return { status: "pending" };
  consumeState.run(state);
  return {
    status: "confirmed",
    identity: {
      telegram_id: row.telegram_id,
      telegram_handle: row.telegram_user,
      name: row.telegram_name,
    },
  };
}

let bot = null;

export async function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[tgbot] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  initTgStatements();
  bot = new Bot(token);

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch {}

  bot.command("start", async (ctx) => {
    const state = ctx.match?.trim();
    const u = ctx.from;
    if (!state) {
      await ctx.reply("Привет! Это бот авторизации TAO VPN.\nОткройте приложение и нажмите «Войти через Telegram».");
      return;
    }
    const r = confirmState.run(
      String(u.id),
      [u.first_name, u.last_name].filter(Boolean).join(" "),
      u.username || null,
      now(),
      state,
      now()
    );
    if (r.changes === 0) {
      await ctx.reply("Ссылка устарела или уже использована. Откройте приложение и попробуйте снова.");
    } else {
      await ctx.reply("✅ Подтверждено. Вернитесь в приложение — вход произойдёт автоматически.");
    }
  });

  bot.catch((err) => console.error("[tgbot] Runtime error:", err.message));

  bot.start({
    drop_pending_updates: true,
    onStart: (botInfo) => console.log(`[tgbot] started as @${botInfo.username}`),
  }).catch((err) => {
    // NON-FATAL: сервер продолжает работать без бота
    console.error("[tgbot] Bot failed to start (non-fatal):", err.message);
  });
}

export function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || "TaoVPNBot";
}

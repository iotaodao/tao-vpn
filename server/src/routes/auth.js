import { nanoid } from "nanoid";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db, now } from "../db.js";
import { sendSms } from "../services/sms.js";
import { sendMail, magicLinkEmail } from "../services/mail.js";
import { createTgAuthState, pollTgAuth, botUsername } from "../services/tgbot.js";
import { loginOrRegister, issueToken } from "../auth/users.js";

const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const insertOtp = db.prepare(`
  INSERT INTO otp_codes (id, channel, target, code_hash, expires_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const findOtp = db.prepare(`
  SELECT * FROM otp_codes
  WHERE channel = ? AND target = ? AND consumed_at IS NULL AND expires_at > ?
  ORDER BY created_at DESC LIMIT 1
`);
const consumeOtp = db.prepare(`UPDATE otp_codes SET consumed_at = ? WHERE id = ?`);
const incOtpAttempts = db.prepare(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`);

const hash = (s) => createHash("sha256").update(s).digest("hex");
const safeEq = (a, b) => {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

function normalizePhone(p) {
  return String(p || "").replace(/[^\d+]/g, "");
}
function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

async function finalizeLogin(req, identity, method) {
  try {
    const { user, sessionId } = loginOrRegister({
      identity,
      method,
      deviceLabel: identity.device_label,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    const token = await issueToken({ userId: user.id, sessionId });
    return { token, user: serializeUser(user) };
  } catch (err) {
    if (err.message === "no_invite") {
      const e = new Error("Вы не в списке приглашённых. Напишите администратору.");
      e.statusCode = 403;
      throw e;
    }
    throw err;
  }
}

function serializeUser(u) {
  return {
    id: u.id, name: u.name, primary_method: u.primary_method,
    telegram_handle: u.telegram_handle, phone: u.phone, email: u.email,
    is_admin: !!u.is_admin,
  };
}

export default async function authRoutes(fastify) {
  // --- PHONE ---
  fastify.post("/phone/request", async (req, reply) => {
    const phone = normalizePhone(req.body?.phone);
    if (!phone || phone.length < 10) return reply.code(400).send({ error: "bad_phone" });
    const code = String(randomInt(1000, 9999));
    insertOtp.run(nanoid(16), "phone", phone, hash(code), now() + OTP_TTL_MS, now());
    await sendSms({ to: phone, text: `TAO VPN: код ${code}. Никому не сообщайте.` });
    return { ok: true };
  });

  fastify.post("/phone/verify", async (req, reply) => {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || "").trim();
    if (!phone || !code) return reply.code(400).send({ error: "bad_input" });
    const otp = findOtp.get("phone", phone, now());
    if (!otp) return reply.code(400).send({ error: "otp_expired" });
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return reply.code(429).send({ error: "too_many_attempts" });
    if (!safeEq(otp.code_hash, hash(code))) {
      incOtpAttempts.run(otp.id);
      return reply.code(400).send({ error: "otp_wrong" });
    }
    consumeOtp.run(now(), otp.id);
    try {
      const result = await finalizeLogin(req, { phone }, "phone");
      return result;
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  // --- EMAIL ---
  fastify.post("/email/request", async (req, reply) => {
    const email = normalizeEmail(req.body?.email);
    if (!email.includes("@")) return reply.code(400).send({ error: "bad_email" });
    const code = String(randomInt(100000, 999999));
    insertOtp.run(nanoid(16), "email", email, hash(code), now() + OTP_TTL_MS, now());
    const base = process.env.PUBLIC_URL || "https://vpn.taodev.net";
    const link = `${base}/?magic=${encodeURIComponent(email)}&code=${code}`;
    const tmpl = magicLinkEmail({ link, code });
    await sendMail({ to: email, ...tmpl });
    return { ok: true };
  });

  fastify.post("/email/verify", async (req, reply) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!email || !code) return reply.code(400).send({ error: "bad_input" });
    const otp = findOtp.get("email", email, now());
    if (!otp) return reply.code(400).send({ error: "otp_expired" });
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return reply.code(429).send({ error: "too_many_attempts" });
    if (!safeEq(otp.code_hash, hash(code))) {
      incOtpAttempts.run(otp.id);
      return reply.code(400).send({ error: "otp_wrong" });
    }
    consumeOtp.run(now(), otp.id);
    try {
      const result = await finalizeLogin(req, { email }, "email");
      return result;
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  // --- TELEGRAM ---
  fastify.post("/telegram/start", async (req, reply) => {
    const state = createTgAuthState();
    const deepLink = `https://t.me/${botUsername()}?start=${state}`;
    return { state, deepLink, bot: botUsername() };
  });

  fastify.get("/telegram/poll", async (req, reply) => {
    const state = req.query?.state;
    if (!state) return reply.code(400).send({ error: "no_state" });
    const r = pollTgAuth(state);
    if (r.status !== "confirmed") return r;
    try {
      const result = await finalizeLogin(req, r.identity, "telegram");
      return { status: "confirmed", ...result };
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  // --- ME / LOGOUT ---
  fastify.get("/me", { preHandler: fastify.requireAuth }, async (req) => {
    return { user: serializeUser(req.user) };
  });

  fastify.post("/logout", { preHandler: fastify.requireAuth }, async (req) => {
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(now(), req.session.id);
    return { ok: true };
  });
}

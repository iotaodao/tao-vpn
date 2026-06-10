import webpush from "web-push";
import { db, now } from "../db.js";

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUB = process.env.VAPID_SUBJECT || "mailto:admin@tao.local";

if (PUB && PRIV) {
  webpush.setVapidDetails(SUB, PUB, PRIV);
} else {
  console.log("[push] VAPID keys not set — push disabled. Generate with: npx web-push generate-vapid-keys");
}

const allSubs = db.prepare("SELECT * FROM push_subscriptions");
const subsForUser = db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?");
const markOk = db.prepare("UPDATE push_subscriptions SET last_ok_at = ?, failures = 0 WHERE id = ?");
const markFail = db.prepare("UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?");
const removeSub = db.prepare("DELETE FROM push_subscriptions WHERE id = ?");

export function publicKey() { return PUB; }

export async function sendToUser(userId, payload) {
  return sendToList(subsForUser.all(userId), payload);
}

export async function sendBroadcast(payload) {
  return sendToList(allSubs.all(), payload);
}

async function sendToList(subs, payload) {
  if (!PUB || !PRIV) return { sent: 0, removed: 0, skipped: subs.length };
  const body = JSON.stringify(payload);
  let sent = 0, removed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      );
      markOk.run(now(), s.id);
      sent++;
    } catch (err) {
      const code = err.statusCode || 0;
      if (code === 404 || code === 410) {
        removeSub.run(s.id);
        removed++;
      } else {
        markFail.run(s.id);
      }
    }
  }));
  return { sent, removed };
}

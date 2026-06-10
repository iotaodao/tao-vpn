import { api } from "./api.js";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function ensureSWRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getCurrentSubscription() {
  const reg = await ensureSWRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribePush() {
  if (!pushSupported()) throw new Error("push_unsupported");
  const reg = await ensureSWRegistration();
  if (!reg) throw new Error("no_sw");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permission_denied");

  const { publicKey } = await api.vapidKey();
  if (!publicKey) throw new Error("no_vapid_key");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.subscribePush(sub.toJSON());
  return sub;
}

export async function unsubscribePush() {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  await api.unsubscribePush(sub.endpoint);
  await sub.unsubscribe();
}

/**
 * TAO SuperApp — Matrix Client
 * Phase 3: notifications + crypto foundation
 */
import * as sdk from "matrix-js-sdk";
import { api } from "./api.js";

let matrixClient = null;
let matrixReady = false;
let notifCallback = null;

export async function getMatrixClient() {
  if (matrixClient && matrixReady) return matrixClient;
  const creds = await api.matrixCredentials();
  matrixClient = sdk.createClient({
    baseUrl: creds.homeserver_url,
    accessToken: creds.access_token,
    userId: creds.matrix_user_id,
    deviceId: creds.device_id,
    useAuthorizationHeader: true,
  });
  return matrixClient;
}

export async function startMatrixSync(client) {
  if (matrixReady) return;
  await client.startClient({ initialSyncLimit: 30, lazyLoadMembers: true });
  matrixReady = true;

  // Background notifications for Matrix messages
  client.on("Room.timeline", (event, room, toStartOfTimeline) => {
    if (toStartOfTimeline) return;
    if (event.getType() !== "m.room.message") return;
    if (event.getSender() === client.getUserId()) return;
    if (document.visibilityState === "visible") return;

    const sender = event.sender?.name || event.getSender()?.split(":")[0].slice(1) || "";
    const body = event.getContent()?.body || "";
    const roomName = room?.name || "Чат";

    showMatrixNotification({
      title: `${sender} · ${roomName}`,
      body: body.length > 100 ? body.slice(0, 100) + "…" : body,
      tag: `matrix-${room?.roomId}`,
      roomId: room?.roomId,
    });
  });
}

function showMatrixNotification({ title, body, tag, roomId }) {
  if (Notification.permission !== "granted") return;

  // Use Service Worker if available
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body, tag, renotify: true,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge.png",
        data: { url: "/", tab: "chat", roomId },
        vibrate: [60, 30, 60],
      });
    });
  } else {
    new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
  }

  notifCallback?.({ title, body, roomId });
}

/**
 * Set callback for notification events (used by App to switch to chat tab)
 */
export function onMatrixNotification(cb) {
  notifCallback = cb;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

export function stopMatrix() {
  if (matrixClient) {
    matrixClient.stopClient();
    matrixClient = null;
    matrixReady = false;
  }
}

export function isMatrixReady() {
  return matrixReady && matrixClient !== null;
}

export function getClient() {
  return matrixClient;
}

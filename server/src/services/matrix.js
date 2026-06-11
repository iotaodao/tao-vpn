/**
 * Matrix Auto-Provisioning Service
 *
 * Creates Matrix accounts on Synapse for TAO VPN users.
 * Uses Synapse Admin API with shared registration secret.
 *
 * Flow:
 * 1. User logs into TAO VPN (via Telegram/Phone/Email)
 * 2. On first login, TAO VPN creates a Matrix account automatically
 * 3. Matrix credentials stored in SQLite
 * 4. Frontend retrieves credentials via /api/matrix/credentials
 * 5. matrix-js-sdk connects directly to Synapse
 */

import { createHmac, randomBytes } from "node:crypto";
import { db, now } from "../db.js";

// Synapse config from env
const SYNAPSE_URL = process.env.SYNAPSE_URL || "http://localhost:8008";
const SYNAPSE_DOMAIN = process.env.SYNAPSE_DOMAIN || "space.taodev.net";
const SYNAPSE_SHARED_SECRET = process.env.SYNAPSE_SHARED_SECRET || "";
const SYNAPSE_ADMIN_TOKEN = process.env.SYNAPSE_ADMIN_TOKEN || "";

// Lazy-init prepared statements
let getMatrixCreds, upsertMatrixCreds, updateMatrixProfile;

function init() {
  if (getMatrixCreds) return;
  getMatrixCreds = db.prepare("SELECT * FROM matrix_credentials WHERE user_id = ?");
  upsertMatrixCreds = db.prepare(`
    INSERT INTO matrix_credentials (user_id, matrix_user_id, access_token, device_id, homeserver_url, display_name, created_at, updated_at)
    VALUES (@user_id, @matrix_user_id, @access_token, @device_id, @homeserver_url, @display_name, @created_at, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      device_id = excluded.device_id,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
  `);
  updateMatrixProfile = db.prepare(
    "UPDATE matrix_credentials SET display_name = ?, avatar_mxc = ?, updated_at = ? WHERE user_id = ?"
  );
}

/**
 * Get or create Matrix credentials for a TAO VPN user.
 */
export async function getOrProvisionMatrix(user) {
  init();
  const existing = getMatrixCreds.get(user.id);
  if (existing) {
    // Verify token still works
    const ok = await verifyMatrixToken(existing);
    if (ok) return existing;
    // Token expired — re-login
    console.log(`[matrix] Token invalid for ${user.id}, re-provisioning`);
  }

  return await provisionMatrixAccount(user);
}

/**
 * Get stored Matrix credentials (no auto-provision).
 */
export function getStoredMatrixCreds(userId) {
  init();
  return getMatrixCreds.get(userId) || null;
}

/**
 * Create a Matrix account via Synapse registration API.
 * Uses shared_secret registration (same as `register_new_matrix_user` CLI).
 */
async function provisionMatrixAccount(user) {
  const username = generateMatrixUsername(user);
  const password = randomBytes(32).toString("base64url");
  const displayName = user.name || username;

  console.log(`[matrix] Provisioning account @${username}:${SYNAPSE_DOMAIN} for user ${user.id}`);

  let result;

  if (SYNAPSE_SHARED_SECRET) {
    result = await registerWithSharedSecret(username, password, displayName);
  } else if (SYNAPSE_ADMIN_TOKEN) {
    result = await registerWithAdminApi(username, password, displayName);
  } else {
    throw new Error("No SYNAPSE_SHARED_SECRET or SYNAPSE_ADMIN_TOKEN configured");
  }

  const t = now();
  const row = {
    user_id: user.id,
    matrix_user_id: result.user_id,
    access_token: result.access_token,
    device_id: result.device_id,
    homeserver_url: process.env.SYNAPSE_PUBLIC_URL || `https://${SYNAPSE_DOMAIN}`,
    display_name: displayName,
    created_at: t,
    updated_at: t,
  };

  upsertMatrixCreds.run(row);
  console.log(`[matrix] Provisioned ${result.user_id} for VPN user ${user.id}`);
  return row;
}

/**
 * Register via Synapse shared_secret (most reliable method).
 * Equivalent to: register_new_matrix_user -c homeserver.yaml
 */
async function registerWithSharedSecret(username, password, displayName) {
  // Step 1: get nonce
  const nonceRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/register`, {
    method: "GET",
  });
  if (!nonceRes.ok) throw new Error(`Synapse nonce request failed: ${nonceRes.status}`);
  const { nonce } = await nonceRes.json();

  // Step 2: compute HMAC
  const mac = createHmac("sha1", SYNAPSE_SHARED_SECRET)
    .update(nonce)
    .update("\x00")
    .update(username)
    .update("\x00")
    .update(password)
    .update("\x00")
    .update("notadmin") // not admin
    .digest("hex");

  // Step 3: register
  const regRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce,
      username,
      password,
      displayname: displayName,
      admin: false,
      mac,
    }),
  });

  if (!regRes.ok) {
    const err = await regRes.json().catch(() => ({}));
    // User already exists — login instead
    if (err.errcode === "M_USER_IN_USE") {
      return await loginToMatrix(username, password);
    }
    throw new Error(`Synapse register failed: ${regRes.status} ${err.error || ""}`);
  }

  return await regRes.json();
}

/**
 * Register via Synapse Admin API v2 (requires admin access token).
 */
async function registerWithAdminApi(username, password, displayName) {
  const userId = `@${username}:${SYNAPSE_DOMAIN}`;

  // Create or modify user
  const res = await fetch(`${SYNAPSE_URL}/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SYNAPSE_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      password,
      displayname: displayName,
      admin: false,
      deactivated: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Synapse admin API failed: ${res.status} ${err.error || ""}`);
  }

  // Now login to get access_token
  return await loginToMatrix(username, password);
}

/**
 * Login to Matrix to get access_token + device_id.
 */
async function loginToMatrix(username, password) {
  const res = await fetch(`${SYNAPSE_URL}/_matrix/client/v3/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: username },
      password,
      initial_device_display_name: "TAO VPN SuperApp",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Matrix login failed: ${res.status} ${err.error || ""}`);
  }

  return await res.json();
}

/**
 * Verify that a stored Matrix token is still valid.
 */
async function verifyMatrixToken(creds) {
  try {
    const url = creds.homeserver_url || `https://${SYNAPSE_DOMAIN}`;
    const res = await fetch(`${url}/_matrix/client/v3/account/whoami`, {
      headers: { "Authorization": `Bearer ${creds.access_token}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sync display name and avatar from TAO VPN to Matrix.
 */
export async function syncProfileToMatrix(userId, displayName, avatarMxc) {
  init();
  const creds = getMatrixCreds.get(userId);
  if (!creds) return;

  const url = creds.homeserver_url || `https://${SYNAPSE_DOMAIN}`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${creds.access_token}`,
  };

  try {
    if (displayName && displayName !== creds.display_name) {
      await fetch(`${url}/_matrix/client/v3/profile/${encodeURIComponent(creds.matrix_user_id)}/displayname`, {
        method: "PUT", headers,
        body: JSON.stringify({ displayname: displayName }),
      });
    }

    if (avatarMxc && avatarMxc !== creds.avatar_mxc) {
      await fetch(`${url}/_matrix/client/v3/profile/${encodeURIComponent(creds.matrix_user_id)}/avatar_url`, {
        method: "PUT", headers,
        body: JSON.stringify({ avatar_url: avatarMxc }),
      });
    }

    updateMatrixProfile.run(displayName || creds.display_name, avatarMxc || creds.avatar_mxc, now(), userId);
  } catch (e) {
    console.error("[matrix] Profile sync failed:", e.message);
  }
}

/**
 * Generate a Matrix-compatible username from TAO VPN user data.
 * Matrix usernames: lowercase, [a-z0-9._=-]
 */
function generateMatrixUsername(user) {
  // Prefer: name → email prefix → phone → random
  let base = "";
  if (user.name) {
    base = user.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  } else if (user.email) {
    base = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._=-]/g, "");
  } else if (user.phone) {
    base = "user" + user.phone.replace(/\D/g, "").slice(-6);
  } else if (user.telegram_handle) {
    base = user.telegram_handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  if (!base || base.length < 2) {
    base = "tao" + randomBytes(4).toString("hex");
  }

  // Prefix to avoid collision with manually created accounts
  return `v.${base}`;
}

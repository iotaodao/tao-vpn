/**
 * TAO SuperApp — Matrix Client
 * 
 * Connects to Synapse using credentials auto-provisioned by TAO VPN backend.
 * Single instance, lazy initialization.
 */
import * as sdk from "matrix-js-sdk";
import { api } from "./api.js";

let matrixClient = null;
let matrixReady = false;

/**
 * Get or initialize Matrix client.
 * Fetches credentials from TAO VPN backend on first call.
 */
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

/**
 * Start sync loop. Call after getMatrixClient().
 */
export async function startMatrixSync(client) {
  if (matrixReady) return;
  await client.startClient({ initialSyncLimit: 30, lazyLoadMembers: true });
  matrixReady = true;
}

/**
 * Stop and cleanup.
 */
export function stopMatrix() {
  if (matrixClient) {
    matrixClient.stopClient();
    matrixClient = null;
    matrixReady = false;
  }
}

/**
 * Check if Matrix is connected and syncing.
 */
export function isMatrixReady() {
  return matrixReady && matrixClient !== null;
}

export function getClient() {
  return matrixClient;
}

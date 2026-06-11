import { getOrProvisionMatrix, getStoredMatrixCreds, syncProfileToMatrix } from "../services/matrix.js";

export default async function matrixRoutes(fastify) {
  /**
   * GET /api/matrix/credentials
   * Returns Matrix access token + homeserver for the authenticated user.
   * Auto-provisions Matrix account on first call.
   */
  fastify.get("/credentials", { preHandler: fastify.requireAuth }, async (req, reply) => {
    try {
      const creds = await getOrProvisionMatrix(req.user);
      return {
        matrix_user_id: creds.matrix_user_id,
        access_token: creds.access_token,
        device_id: creds.device_id,
        homeserver_url: creds.homeserver_url,
        display_name: creds.display_name,
      };
    } catch (e) {
      console.error("[matrix] Provision error:", e.message);
      return reply.code(503).send({
        error: "matrix_unavailable",
        message: "Не удалось подключиться к серверу сообщений",
      });
    }
  });

  /**
   * GET /api/matrix/status
   * Check if user has Matrix account provisioned.
   */
  fastify.get("/status", { preHandler: fastify.requireAuth }, async (req) => {
    const creds = getStoredMatrixCreds(req.user.id);
    return {
      provisioned: !!creds,
      matrix_user_id: creds?.matrix_user_id || null,
    };
  });

  /**
   * POST /api/matrix/sync-profile
   * Sync display name / avatar from VPN profile to Matrix.
   */
  fastify.post("/sync-profile", { preHandler: fastify.requireAuth }, async (req) => {
    const { display_name, avatar_mxc } = req.body || {};
    await syncProfileToMatrix(req.user.id, display_name, avatar_mxc);
    return { ok: true };
  });
}

import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me-please-32chars-min"
);
const ISS = "tao-vpn";
const AUD = "tao-vpn-web";

export async function signSession({ userId, sessionId, ttlDays = 90 }) {
  return await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISS)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(SECRET);
}

export async function verifySession(token) {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISS, audience: AUD });
  return { userId: payload.sub, sessionId: payload.sid, exp: payload.exp };
}

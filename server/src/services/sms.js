// MTS Exolve SMS adapter
// API: https://docs.mts.ru/exolve/manual/sms-api/sms-send

const API_URL = "https://api.exolve.ru/messaging/v1/SendSMS";

export async function sendSms({ to, text }) {
  const token = process.env.EXOLVE_API_TOKEN;
  const from = process.env.EXOLVE_SENDER || "TAO_VPN";

  if (!token) {
    console.log(`[sms:stub] to=${to} text="${text}"`);
    return { ok: true, stub: true };
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number: from, destination: to, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`exolve_sms_failed: ${res.status} ${body}`);
  }
  return { ok: true, data: await res.json() };
}

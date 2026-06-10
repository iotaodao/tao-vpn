import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    return null; // stub mode
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || "TAO VPN <noreply@tao.local>";
  if (!t) {
    console.log(`[mail:stub] to=${to} subject="${subject}"\n${text || html}`);
    return { ok: true, stub: true };
  }
  const info = await t.sendMail({ from, to, subject, html, text });
  return { ok: true, messageId: info.messageId };
}

export function magicLinkEmail({ link, code }) {
  return {
    subject: "TAO VPN — вход в аккаунт",
    text: `Откройте ссылку для входа: ${link}\n\nИли введите код: ${code}\n\nСсылка действует 15 минут.`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: auto; padding: 32px 24px; color: #0A1428;">
        <h2 style="margin: 0 0 8px;">TAO <span style="color:#3B82F6">VPN</span></h2>
        <p style="color: #475569;">Нажмите на кнопку чтобы войти в аккаунт:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Войти в TAO VPN</a>
        </p>
        <p style="color: #475569; font-size: 13px;">Или введите код в приложении: <b style="font-family: monospace;">${code}</b></p>
        <p style="color: #94A3B8; font-size: 12px; margin-top: 24px;">Ссылка и код действительны 15 минут. Если вы не запрашивали вход — игнорируйте письмо.</p>
      </div>
    `,
  };
}

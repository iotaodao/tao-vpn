import { useState, useEffect } from "react";
import { C, timeAgo } from "../theme.js";
import { TgIcon, PhoneIcon, MailIcon } from "../components/ui.jsx";
import { pushSupported, subscribePush, unsubscribePush, getCurrentSubscription } from "../push.js";

// ---------- Configs ----------
export function Configs({ configs = [], onCopy }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, fontWeight: 600, letterSpacing: "0.15em" }}>МОИ КОНФИГУРАЦИИ</div>
      {configs.length === 0 && (
        <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>У вас пока нет активных конфигов</div>
      )}
      {configs.map((c) => <ConfigCard key={c.id} config={c} onCopy={onCopy} />)}
      <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 14, background: "rgba(96,165,250,0.05)", border: `1px solid ${C.border}`, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
        ◉ Импортируйте конфиг в v2rayNG (Android), Streisand или Happ (iOS) через буфер обмена.
      </div>
    </div>
  );
}

function ConfigCard({ config, onCopy }) {
  const [copied, setCopied] = useState(false);
  const isNew = config.updated_at && (Date.now() - config.updated_at) < 7 * 86400_000;
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(config.uri); } catch {}
    setCopied(true); onCopy?.(config.name);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ background: C.surface, border: `1px solid ${isNew ? C.borderStrong : C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 10, position: "relative", boxShadow: isNew ? `0 0 20px rgba(96,165,250,0.1)` : "none" }}>
      {isNew && (<span style={{ position: "absolute", top: -1, right: 14, fontSize: 9, fontWeight: 700, color: C.accentBright, background: C.bg, padding: "1px 8px", borderRadius: 8, letterSpacing: "0.1em", border: `1px solid ${C.borderStrong}` }}>NEW</span>)}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{config.name}</span>
        <span style={{ fontSize: 11, color: C.textMuted }}>{timeAgo(config.updated_at)}</span>
      </div>
      <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: C.accentBright, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all", lineHeight: 1.5, marginBottom: 12, maxHeight: 60, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {config.uri}
      </div>
      <button onClick={handleCopy} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit", background: copied ? "rgba(74,222,128,0.15)" : "rgba(96,165,250,0.12)", color: copied ? C.green : C.accentBright }}>
        {copied ? "✓ Скопировано" : "Копировать конфиг"}
      </button>
    </div>
  );
}

// ---------- Alerts ----------
export function Alerts({ notifications = [], onToast }) {
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return;
      try {
        const sub = await getCurrentSubscription();
        setPushOn(!!sub && Notification.permission === "granted");
      } catch {}
    })();
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await unsubscribePush();
        setPushOn(false); onToast?.("Push отключены");
      } else {
        if (!pushSupported()) { onToast?.("Push не поддерживается"); return; }
        await subscribePush();
        setPushOn(true); onToast?.("Push включены");
      }
    } catch (e) {
      const msg = e.message === "permission_denied" ? "Разрешите уведомления в настройках" : "Не удалось переключить";
      onToast?.(msg);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PushToggle enabled={pushOn} onToggle={toggle} disabled={busy} />
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, fontWeight: 600, letterSpacing: "0.15em" }}>ИСТОРИЯ УВЕДОМЛЕНИЙ</div>
      {notifications.length === 0 && (
        <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>Уведомлений пока нет</div>
      )}
      {notifications.map((n) => <NotificationCard key={n.id} notif={n} />)}
    </div>
  );
}

function PushToggle({ enabled, onToggle, disabled }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>Push-уведомления</div>
        <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{enabled ? "Включены" : "Отключены"}</div>
      </div>
      <button onClick={onToggle} disabled={disabled} style={{ width: 48, height: 28, borderRadius: 14, border: "none", cursor: disabled ? "wait" : "pointer", background: enabled ? "rgba(96,165,250,0.3)" : "rgba(96,165,250,0.08)", position: "relative", transition: "background 0.2s", opacity: disabled ? 0.6 : 1 }}>
        <span style={{ position: "absolute", top: 3, width: 22, height: 22, borderRadius: "50%", background: enabled ? C.accentBright : C.textDim, boxShadow: enabled ? `0 0 8px ${C.cyanGlow}` : "none", transition: "all 0.2s", left: enabled ? 23 : 3 }} />
      </button>
    </div>
  );
}

function NotificationCard({ notif }) {
  const icons = { warning: "⚠", success: "✓", info: "ⓘ", error: "✕", config: "⚿" };
  const colors = { warning: C.amber, success: C.green, info: C.accent, error: C.red, config: C.accentBright };
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, borderLeft: `3px solid ${colors[notif.type]}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: colors[notif.type] }}>{icons[notif.type]}</span>
          <span style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{notif.title}</span>
        </div>
        <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", marginLeft: 8 }}>{timeAgo(notif.created_at)}</span>
      </div>
      <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5, paddingLeft: 22 }}>{notif.body}</div>
    </div>
  );
}

// ---------- Account ----------
export function Account({ user, onLogout }) {
  const methodLabel = { telegram: "Telegram", phone: "Телефон", email: "Email" }[user.primary_method];
  const MethodIcon = { telegram: TgIcon, phone: PhoneIcon, email: MailIcon }[user.primary_method] || (() => null);
  const primaryContact = user.primary_method === "telegram" ? (user.telegram_handle ? `@${user.telegram_handle}` : "Telegram") : (user.primary_method === "phone" ? user.phone : user.email);

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(125,211,252,0.04) 100%)", border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(96,165,250,0.12)", border: `1px solid ${C.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: C.accentBright }}>{user.name?.[0] || "?"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.text, fontWeight: 600, fontSize: 16 }}>{user.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: C.textDim, fontSize: 12 }}>
            <MethodIcon /> {primaryContact}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, fontWeight: 600, letterSpacing: "0.15em" }}>АККАУНТ</div>
      <InfoRow label="Способ входа" value={methodLabel} />
      <InfoRow label="ID пользователя" value={user.id} mono />
      {user.is_admin && <InfoRow label="Роль" value="Администратор" />}

      <div style={{ fontSize: 11, color: C.textMuted, margin: "20px 0 12px", fontWeight: 600, letterSpacing: "0.15em" }}>КАНАЛЫ ДОСТАВКИ</div>
      <ChannelRow icon={<TgIcon />} label="Telegram" value={user.telegram_handle ? `@${user.telegram_handle}` : "не привязан"} bound={!!user.telegram_handle} />
      <ChannelRow icon={<PhoneIcon />} label="Телефон" value={user.phone || "не привязан"} bound={!!user.phone} />
      <ChannelRow icon={<MailIcon />} label="Email" value={user.email || "не привязан"} bound={!!user.email} />

      <button onClick={onLogout} style={{ width: "100%", marginTop: 24, padding: "13px 0", borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: C.red, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Выйти из аккаунта</button>
    </div>
  );
}

const InfoRow = ({ label, value, mono }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
    <span style={{ color: C.textDim, fontSize: 13, flexShrink: 0 }}>{label}</span>
    <span style={{ color: C.text, fontSize: 13, fontWeight: 500, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
  </div>
);

const ChannelRow = ({ icon, label, value, bound }) => (
  <div style={{ background: C.surface, border: `1px solid ${bound ? C.borderStrong : C.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
    <span style={{ color: bound ? C.accentBright : C.textMuted, display: "flex" }}>{icon}</span>
    <div style={{ flex: 1, overflow: "hidden" }}>
      <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ color: C.textDim, fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
    {bound && (
      <span style={{ fontSize: 10, color: C.green, background: "rgba(74,222,128,0.1)", padding: "2px 8px", borderRadius: 10, fontWeight: 600, whiteSpace: "nowrap" }}>✓</span>
    )}
  </div>
);

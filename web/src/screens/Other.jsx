import { useState, useEffect, useCallback } from "react";
import { C, timeAgo } from "../theme.js";
import { TgIcon, PhoneIcon, MailIcon } from "../components/ui.jsx";
import { pushSupported, subscribePush, unsubscribePush, getCurrentSubscription } from "../push.js";
import { requestNotificationPermission } from "../matrix.js";
import { api } from "../api.js";

// ══════════════════════════════════════════════════════════
// CONFIGS
// ══════════════════════════════════════════════════════════

export function Configs({ configs = [], onCopy }) {
  return (
    <div>
      <SectionLabel>МОИ КОНФИГУРАЦИИ</SectionLabel>
      {configs.length === 0 && <Empty>У вас пока нет активных конфигов</Empty>}
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
      {isNew && <Badge>NEW</Badge>}
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

// ══════════════════════════════════════════════════════════
// ALERTS — Unified Push (VPN + Matrix)
// ══════════════════════════════════════════════════════════

export function Alerts({ notifications = [], onToast }) {
  const [pushOn, setPushOn] = useState(false);
  const [matrixNotif, setMatrixNotif] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return;
      try {
        const sub = await getCurrentSubscription();
        setPushOn(!!sub && Notification.permission === "granted");
        setMatrixNotif(Notification.permission === "granted");
      } catch {}
    })();
  }, []);

  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await unsubscribePush(); setPushOn(false); onToast?.("VPN Push отключены");
      } else {
        if (!pushSupported()) { onToast?.("Push не поддерживается"); return; }
        await subscribePush(); setPushOn(true); onToast?.("VPN Push включены");
      }
    } catch (e) {
      onToast?.(e.message === "permission_denied" ? "Разрешите уведомления в настройках" : "Ошибка");
    } finally { setBusy(false); }
  };

  const toggleMatrix = async () => {
    const perm = await requestNotificationPermission();
    setMatrixNotif(perm === "granted");
    onToast?.(perm === "granted" ? "Уведомления чата включены" : "Разрешите уведомления в настройках браузера");
  };

  return (
    <div>
      <SectionLabel>УВЕДОМЛЕНИЯ</SectionLabel>
      <ToggleRow label="VPN Push-уведомления" sub={pushOn ? "Серверные алерты, обновления конфигов" : "Отключены"} enabled={pushOn} onToggle={togglePush} disabled={busy} />
      <ToggleRow label="Уведомления чата" sub={matrixNotif ? "Новые сообщения в TAO SPACE" : "Отключены"} enabled={matrixNotif} onToggle={toggleMatrix} />

      <SectionLabel style={{ marginTop: 20 }}>ИСТОРИЯ</SectionLabel>
      {notifications.length === 0 && <Empty>Уведомлений пока нет</Empty>}
      {notifications.map((n) => <NotificationCard key={n.id} notif={n} />)}
    </div>
  );
}

function ToggleRow({ label, sub, enabled, onToggle, disabled }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{sub}</div>
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

// ══════════════════════════════════════════════════════════
// ACCOUNT — with Profile Sync
// ══════════════════════════════════════════════════════════

export function Account({ user, onLogout }) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const methodLabel = { telegram: "Telegram", phone: "Телефон", email: "Email" }[user.primary_method];
  const MethodIcon = { telegram: TgIcon, phone: PhoneIcon, email: MailIcon }[user.primary_method] || (() => null);
  const primaryContact = user.primary_method === "telegram" ? (user.telegram_handle ? `@${user.telegram_handle}` : "Telegram") : (user.primary_method === "phone" ? user.phone : user.email);

  const syncProfile = useCallback(async () => {
    if (!name.trim() || name === user.name) return;
    setSaving(true);
    try {
      await api.matrixSyncProfile(name.trim(), null);
    } catch (e) {
      console.error("Profile sync:", e);
    } finally { setSaving(false); }
  }, [name, user.name]);

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(125,211,252,0.04) 100%)", border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(96,165,250,0.12)", border: `1px solid ${C.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: C.accentBright }}>{(name || user.name)?.[0]?.toUpperCase() || "?"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={name} onChange={(e) => setName(e.target.value)}
              onBlur={syncProfile} onKeyDown={(e) => e.key === "Enter" && syncProfile()}
              style={{ background: "transparent", border: "none", color: C.text, fontWeight: 600, fontSize: 16, outline: "none", width: "100%", padding: 0, fontFamily: "inherit" }} />
            {name !== user.name && !saving && <span style={{ color: C.accentBright, fontSize: 10 }}>✎</span>}
            {saving && <span style={{ color: C.textMuted, fontSize: 10 }}>…</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: C.textDim, fontSize: 12 }}>
            <MethodIcon /> {primaryContact}
          </div>
        </div>
      </div>

      <SectionLabel>АККАУНТ</SectionLabel>
      <InfoRow label="Способ входа" value={methodLabel} />
      <InfoRow label="ID пользователя" value={user.id} mono />
      {user.is_admin && <InfoRow label="Роль" value="Администратор" />}

      <SectionLabel style={{ marginTop: 20 }}>КАНАЛЫ ДОСТАВКИ</SectionLabel>
      <ChannelRow icon={<TgIcon />} label="Telegram" value={user.telegram_handle ? `@${user.telegram_handle}` : "не привязан"} bound={!!user.telegram_handle} />
      <ChannelRow icon={<PhoneIcon />} label="Телефон" value={user.phone || "не привязан"} bound={!!user.phone} />
      <ChannelRow icon={<MailIcon />} label="Email" value={user.email || "не привязан"} bound={!!user.email} />

      <SectionLabel style={{ marginTop: 20 }}>MATRIX</SectionLabel>
      <MatrixStatus />

      <button onClick={onLogout} style={{ width: "100%", marginTop: 24, padding: "13px 0", borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: C.red, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Выйти из аккаунта</button>
    </div>
  );
}

function MatrixStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api.matrixStatus().then(setStatus).catch(() => {});
  }, []);
  if (!status) return null;
  return (
    <InfoRow
      label="Matrix ID"
      value={status.provisioned ? status.matrix_user_id : "не создан"}
      mono={status.provisioned}
    />
  );
}

// ══════════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════════

export function Admin({ onToast }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, i] = await Promise.all([
        api.adminUsers().catch(() => ({ users: [] })),
        api.adminInvites().catch(() => ({ invites: [] })),
      ]);
      setUsers(u.users || []);
      setInvites(i.invites || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(9,22,39,0.8)", borderRadius: 8, padding: 2 }}>
        <TabBtn active={tab === "users"} onClick={() => setTab("users")}>Юзеры ({users.length})</TabBtn>
        <TabBtn active={tab === "invites"} onClick={() => setTab("invites")}>Инвайты</TabBtn>
        <TabBtn active={tab === "broadcast"} onClick={() => setTab("broadcast")}>Рассылка</TabBtn>
      </div>

      {tab === "users" && <UsersList users={users} onToast={onToast} onRefresh={refresh} />}
      {tab === "invites" && <InvitesList invites={invites} onToast={onToast} onRefresh={refresh} />}
      {tab === "broadcast" && <Broadcast onToast={onToast} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "7px 0", borderRadius: 6, border: active ? `1px solid ${C.border}` : "1px solid transparent",
      background: active ? C.surface : "transparent", color: active ? C.text : C.textMuted,
      fontSize: 11, fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

function UsersList({ users, onToast }) {
  return (
    <div>
      <SectionLabel>ПОЛЬЗОВАТЕЛИ</SectionLabel>
      {users.map((u) => (
        <div key={u.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: C.accentBright }}>{u.name?.[0]?.toUpperCase() || "?"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{u.name} {u.is_admin ? <span style={{ fontSize: 9, color: C.amber }}>ADMIN</span> : ""}</div>
            <div style={{ fontSize: 10, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email || u.phone || u.telegram_handle || u.id}</div>
          </div>
          <div style={{ fontSize: 9, color: u.is_active ? C.green : C.red }}>{u.is_active ? "●" : "○"}</div>
        </div>
      ))}
      {users.length === 0 && <Empty>Нет пользователей</Empty>}
    </div>
  );
}

function InvitesList({ invites, onToast, onRefresh }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      await api.adminCreateInvite({ name: name.trim(), email: email.trim() });
      setName(""); setEmail("");
      onToast?.("Приглашение создано");
      onRefresh?.();
    } catch (e) { onToast?.(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>Новое приглашение</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя"
          style={inputStyle} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          style={{ ...inputStyle, marginTop: 6 }} />
        <button onClick={create} disabled={busy || !name.trim() || !email.trim()}
          style={{ width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 8, border: "none", background: C.accentBright, color: C.bg, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy || !name.trim() || !email.trim() ? 0.3 : 1 }}>
          {busy ? "Создаю…" : "Пригласить"}
        </button>
      </div>

      <SectionLabel>ПРИГЛАШЕНИЯ</SectionLabel>
      {invites.map((inv) => (
        <div key={inv.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{inv.name}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{inv.email || inv.phone || inv.telegram_id || "—"}</div>
          </div>
          <span style={{ fontSize: 9, color: inv.used_by ? C.green : C.textMuted }}>{inv.used_by ? "использован" : "ожидает"}</span>
        </div>
      ))}
      {invites.length === 0 && <Empty>Нет приглашений</Empty>}
    </div>
  );
}

function Broadcast({ onToast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await api.adminNotify({ type, title: title.trim(), body: body.trim(), push: true });
      setTitle(""); setBody("");
      onToast?.("Уведомление отправлено");
    } catch (e) { onToast?.(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <SectionLabel>ОТПРАВИТЬ УВЕДОМЛЕНИЕ</SectionLabel>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {["info", "warning", "error", "config"].map((t) => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
              border: type === t ? `1px solid ${C.borderStrong}` : `1px solid ${C.border}`,
              background: type === t ? C.surface : "transparent",
              color: type === t ? C.text : C.textMuted,
            }}>{t}</button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" style={inputStyle} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Текст…" rows={3}
          style={{ ...inputStyle, marginTop: 6, resize: "none", lineHeight: 1.5 }} />
        <button onClick={send} disabled={busy || !title.trim() || !body.trim()}
          style={{ width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 8, border: "none", background: C.accentBright, color: C.bg, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy || !title.trim() || !body.trim() ? 0.3 : 1 }}>
          {busy ? "Отправляю…" : "Отправить всем"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SHARED UI
// ══════════════════════════════════════════════════════════

const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: `1px solid ${C.border}`, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" };

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, fontWeight: 600, letterSpacing: "0.15em", ...style }}>{children}</div>;
}

function Empty({ children }) {
  return <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>{children}</div>;
}

function Badge({ children }) {
  return <span style={{ position: "absolute", top: -1, right: 14, fontSize: 9, fontWeight: 700, color: C.accentBright, background: C.bg, padding: "1px 8px", borderRadius: 8, letterSpacing: "0.1em", border: `1px solid ${C.borderStrong}` }}>{children}</span>;
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
    {bound && <span style={{ fontSize: 10, color: C.green, background: "rgba(74,222,128,0.1)", padding: "2px 8px", borderRadius: 10, fontWeight: 600, whiteSpace: "nowrap" }}>✓</span>}
  </div>
);

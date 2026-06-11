import { useState, useEffect, useCallback } from "react";
import { C, FONT } from "./theme.js";
import { api, setToken, getToken } from "./api.js";
import { CosmicBackground, Toast, NavItem } from "./components/ui.jsx";
import { GeodesicSphere } from "./components/GeodesicSphere.jsx";
import { Login } from "./screens/Login.jsx";
import { Status } from "./screens/Status.jsx";
import { Configs, Alerts, Account } from "./screens/Other.jsx";
import { Chat } from "./screens/Chat.jsx";
import { stopMatrix } from "./matrix.js";

export default function App() {
  const [user, setUser] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);

  const [tab, setTab] = useState("status");
  const [statusData, setStatusData] = useState({ servers: [], urgent: { active: false } });
  const [configs, setConfigs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [urgentDismissed, setUrgentDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      const t = getToken();
      if (!t) { setBootChecked(true); return; }
      try {
        const { user } = await api.me();
        setUser(user);
      } catch {
        setToken(null);
      } finally {
        setBootChecked(true);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [s, c, n] = await Promise.all([
        api.status().catch(() => null),
        api.configs().catch(() => null),
        api.notifications().catch(() => null),
      ]);
      if (s) setStatusData(s);
      if (c) setConfigs(c.configs || []);
      if (n) setNotifications(n.notifications || []);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(refresh, 60_000);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [user, refresh]);

  const showToast = useCallback((message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: "" }), 2500);
  }, []);

  const logout = async () => {
    try { await api.logout(); } catch {}
    stopMatrix();
    setToken(null);
    setUser(null);
    setTab("status");
  };

  if (!bootChecked) {
    return (
      <div style={appShell()}>
        <GlobalStyles />
        <CosmicBackground />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GeodesicSphere size={64} glow={16} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={appShell()}>
        <GlobalStyles />
        <CosmicBackground />
        <Login onAuth={(u) => setUser(u)} />
      </div>
    );
  }

  const onlineCount = statusData.servers.filter((s) => s.status === "online").length;
  const totalServers = statusData.servers.length;
  const showUrgent = statusData.urgent?.active && !urgentDismissed;

  return (
    <div style={appShell()}>
      <GlobalStyles />
      <CosmicBackground />
      <Toast message={toast.message} visible={toast.visible} />

      <header style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(5,11,26,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GeodesicSphere size={36} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: C.text }}>
                TAO <span style={{ color: C.accentBright, textShadow: `0 0 12px ${C.cyanGlow}` }}>VPN</span>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                {totalServers ? `${onlineCount}/${totalServers} серверов · стабильно` : "загрузка…"}
              </div>
            </div>
          </div>
          <button onClick={() => setTab("account")} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${tab === "account" ? C.borderStrong : C.border}`, background: "rgba(96,165,250,0.1)", color: C.accentBright, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{user.name?.[0] || "?"}</button>
        </div>
      </header>

      <main style={{ padding: tab === "chat" ? "0" : "18px 16px 100px", position: "relative", zIndex: 1, animation: "fadeUp 0.4s ease" }}>
        {tab === "status" && (
          <Status
            data={{ ...statusData, urgent: showUrgent ? statusData.urgent : { active: false } }}
            onAction={(t) => setTab(t || "configs")}
            onDismissUrgent={() => setUrgentDismissed(true)}
          />
        )}
        {tab === "configs" && <Configs configs={configs} onCopy={(name) => showToast(`${name} скопирован`)} />}
        {tab === "chat" && <Chat onToast={showToast} />}
        {tab === "alerts" && <Alerts notifications={notifications} onToast={showToast} />}
        {tab === "account" && <Account user={user} onLogout={logout} />}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(5,11,26,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, display: "flex", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 50 }}>
        <NavItem icon="◈" label="Статус" active={tab === "status"} onClick={() => setTab("status")} badge={showUrgent} />
        <NavItem icon="⚿" label="Конфиги" active={tab === "configs"} onClick={() => setTab("configs")} />
        <NavItem icon="💬" label="Чат" active={tab === "chat"} onClick={() => setTab("chat")} />
        <NavItem icon="⚡" label="Алерты" active={tab === "alerts"} onClick={() => setTab("alerts")} />
        <NavItem icon="◐" label="Аккаунт" active={tab === "account"} onClick={() => setTab("account")} />
      </nav>
    </div>
  );
}

const appShell = () => ({
  minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT,
  maxWidth: 480, margin: "0 auto", position: "relative", overflow: "hidden",
});

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
      @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
      @keyframes scanline { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { display: none; }
      input::placeholder, textarea::placeholder { color: rgba(224,234,255,0.25); }
    `}</style>
  );
}

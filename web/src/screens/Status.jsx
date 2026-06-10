import { C } from "../theme.js";
import { StatusDot } from "../components/ui.jsx";

export function Status({ data, onAction, onDismissUrgent }) {
  const { servers = [], urgent } = data || {};
  return (
    <div>
      {urgent?.active && (
        <UrgentBanner urgent={urgent} onAction={onAction} onDismiss={onDismissUrgent} />
      )}
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, fontWeight: 600, letterSpacing: "0.15em" }}>СЕРВЕРЫ</div>
      {servers.length === 0 && (
        <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>Серверы пока не настроены</div>
      )}
      {servers.map((s) => <ServerCard key={s.id} server={s} />)}
    </div>
  );
}

function UrgentBanner({ urgent, onAction, onDismiss }) {
  return (
    <div style={{ position: "relative", marginBottom: 20, background: "linear-gradient(135deg, rgba(125,211,252,0.12) 0%, rgba(59,130,246,0.06) 100%)", border: `1px solid ${C.borderStrong}`, borderRadius: 16, padding: "16px 18px", boxShadow: `0 0 30px rgba(96,165,250,0.15)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C.accentBright}, transparent)`, animation: "scanline 3s ease-in-out infinite" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accentBright, boxShadow: `0 0 8px ${C.cyanGlow}`, animation: "pulse 1.5s ease-in-out infinite" }} />
          <span style={{ fontSize: 10, color: C.accentBright, fontWeight: 700, letterSpacing: "0.15em" }}>СРОЧНОЕ СООБЩЕНИЕ</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1, fontFamily: "inherit" }}>✕</button>
        )}
      </div>
      <div style={{ color: C.text, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{urgent.title}</div>
      <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.5, marginBottom: urgent.cta_label ? 14 : 0 }}>{urgent.body}</div>
      {urgent.cta_label && (
        <button onClick={() => onAction?.(urgent.cta_tab)} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: "rgba(96,165,250,0.12)", color: C.accentBright, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>{urgent.cta_label} →</button>
      )}
    </div>
  );
}

function ServerCard({ server }) {
  const labels = { online: "Онлайн", maintenance: "Обслуживание", offline: "Оффлайн" };
  const colors = { online: C.green, maintenance: C.amber, offline: C.red };
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot status={server.status} />
          <span style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{server.name}</span>
        </div>
        <span style={{ fontSize: 11, color: colors[server.status], background: `${colors[server.status]}15`, padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>{labels[server.status]}</span>
      </div>
      <div style={{ display: "flex", gap: 18, fontSize: 12, color: C.textDim, marginBottom: server.status === "online" ? 10 : 0 }}>
        <span>◉ {server.location}</span>
        <span>⚡ {server.protocol}</span>
        {server.latency_ms && <span>↔ {server.latency_ms}ms</span>}
      </div>
      {server.status === "online" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
            <span>Нагрузка</span><span>{server.load_pct}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(96,165,250,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, transition: "width 0.6s ease", width: `${server.load_pct}%`, background: server.load_pct < 60 ? C.accent : server.load_pct < 85 ? C.amber : C.red, boxShadow: `0 0 8px ${server.load_pct < 60 ? C.accentGlow : "transparent"}` }} />
          </div>
        </div>
      )}
    </div>
  );
}

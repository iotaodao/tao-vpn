import { useRef } from "react";
import { C } from "../theme.js";

export function Starfield() {
  const stars = useRef(Array.from({ length: 40 }, () => ({
    x: Math.random() * 100, y: Math.random() * 100,
    size: Math.random() * 1.4 + 0.3, opacity: Math.random() * 0.5 + 0.2,
    delay: Math.random() * 4,
  }))).current;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", maxWidth: 480, left: "50%", transform: "translateX(-50%)" }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: "50%",
          background: "#7DD3FC", opacity: s.opacity,
          boxShadow: `0 0 ${s.size * 2}px #7DD3FC`,
          animation: `twinkle 4s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

export function CosmicBackground() {
  return (
    <>
      <Starfield />
      <div style={{ position: "fixed", top: -160, left: "50%", transform: "translateX(-50%)", width: 400, height: 400, pointerEvents: "none", background: "radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 65%)" }} />
      <div style={{ position: "fixed", bottom: -200, right: -100, width: 350, height: 350, pointerEvents: "none", background: "radial-gradient(circle, rgba(30,58,138,0.25) 0%, transparent 70%)" }} />
    </>
  );
}

export function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : -80}px)`,
      background: "rgba(10,20,40,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${C.borderStrong}`, borderRadius: 12,
      padding: "10px 20px", color: C.accentBright, fontSize: 13, fontWeight: 500,
      transition: "transform 0.3s ease, opacity 0.3s ease", opacity: visible ? 1 : 0,
      zIndex: 100, pointerEvents: "none", boxShadow: `0 0 30px rgba(96,165,250,0.2)`,
    }}>{message}</div>
  );
}

export function StatusDot({ status }) {
  const colors = { online: C.green, maintenance: C.amber, offline: C.red };
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{ position: "absolute", inset: -4, borderRadius: "50%", background: colors[status], opacity: 0.25, animation: status === "online" ? "pulse 2s ease-in-out infinite" : "none" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: colors[status], boxShadow: `0 0 6px ${colors[status]}` }} />
    </span>
  );
}

export function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      background: "none", border: "none", cursor: "pointer", padding: "8px 0", position: "relative",
      color: active ? C.accentBright : C.textMuted, transition: "color 0.2s", fontFamily: "inherit",
    }}>
      <span style={{ fontSize: 18, filter: active ? `drop-shadow(0 0 6px ${C.cyanGlow})` : "none" }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: "0.02em" }}>{label}</span>
      {badge && (<span style={{ position: "absolute", top: 4, right: "30%", width: 6, height: 6, borderRadius: "50%", background: C.accentBright, boxShadow: `0 0 6px ${C.cyanGlow}` }} />)}
    </button>
  );
}

export const TgIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.87 4.326-2.96-.924c-.64-.203-.658-.643.135-.953l11.566-4.458c.538-.196 1.006.128.832.953z"/></svg>);
export const PhoneIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
export const MailIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);

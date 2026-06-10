export const C = {
  bg: "#050B1A",
  bgElev: "#0A1428",
  surface: "rgba(59,130,246,0.04)",
  border: "rgba(96,165,250,0.12)",
  borderStrong: "rgba(96,165,250,0.22)",
  text: "#E0EAFF",
  textDim: "rgba(224,234,255,0.5)",
  textMuted: "rgba(224,234,255,0.3)",
  accent: "#60A5FA",
  accentBright: "#7DD3FC",
  accentGlow: "rgba(96,165,250,0.4)",
  cyanGlow: "rgba(125,211,252,0.5)",
  green: "#4ADE80",
  amber: "#FBBF24",
  red: "#F87171",
};

export const FONT = "'DM Sans', 'SF Pro Display', -apple-system, sans-serif";
export const MONO = "'JetBrains Mono', monospace";

export const timeAgo = (iso) => {
  if (!iso) return "";
  const ms = typeof iso === "number" ? iso : new Date(iso).getTime();
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins}м назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  return `${Math.floor(hrs / 24)}д назад`;
};

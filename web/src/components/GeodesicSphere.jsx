import { C } from "../theme.js";

export function GeodesicSphere({ size = 36, animated = true, glow = 8 }) {
  const r = size / 2 - 2, cx = size / 2, cy = size / 2;
  const t = (1 + Math.sqrt(5)) / 2;
  const vertsRaw = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const edges = [
    [0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],
    [2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],
    [4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],[7,10],[8,9],[10,11],
  ];
  const norm = Math.sqrt(1 + t * t);
  const verts = vertsRaw.map(([x, y, z]) => [x / norm, y / norm, z / norm]);
  const id = `sg-${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: `drop-shadow(0 0 ${glow}px ${C.cyanGlow})` }}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.3" />
          <stop offset="60%" stopColor="#3B82F6" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g style={animated ? { transformOrigin: `${cx}px ${cy}px`, animation: "spin 30s linear infinite" } : {}}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
        {edges.map(([a, b], i) => {
          const va = verts[a], vb = verts[b];
          const x1 = cx + va[0] * r, y1 = cy - va[1] * r;
          const x2 = cx + vb[0] * r, y2 = cy - vb[1] * r;
          const opacity = 0.15 + ((va[2] + vb[2]) / 2 + 1) / 2 * 0.7;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7DD3FC" strokeWidth={size > 60 ? 0.8 : 0.6} opacity={opacity} />;
        })}
        {verts.map(([x, y, z], i) => {
          const px = cx + x * r, py = cy - y * r;
          const opacity = 0.4 + (z + 1) / 2 * 0.6;
          return <circle key={i} cx={px} cy={py} r={size > 60 ? 1.8 : 1.2} fill="#7DD3FC" opacity={opacity} />;
        })}
      </g>
    </svg>
  );
}

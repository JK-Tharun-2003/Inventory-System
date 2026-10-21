import { useEffect, useId, useMemo, useRef, useState } from "react";

// Dependency-free line chart: smooth curves, gradient fill, animated draw-in,
// hover / touch tooltip with a crosshair, and a legend with totals.
//
//   <LineChart labels={["01 Oct", ...]} series={[{ name, color, values }]} format={v => "Rs. " + v} />

const H = 320, PAD = { t: 18, r: 18, b: 34, l: 64 };

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const compact = v => (v >= 1e6 ? +(v / 1e6).toFixed(1) + "M" : v >= 1e3 ? +(v / 1e3).toFixed(1) + "k" : String(Math.round(v)));

// Smooth path through the points (monotone-ish cubic, never dips below the baseline)
function smooth(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = (x1 - x0) / 2.4;
    d += ` C${x0 + dx},${y0} ${x1 - dx},${y1} ${x1},${y1}`;
  }
  return d;
}

export default function LineChart({ labels, series, format = v => String(v), height = H }) {
  const uid = useId().replace(/:/g, "");
  const wrap = useRef(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState(null);
  const [off, setOff] = useState({});   // legend toggles: series name -> hidden

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(Math.max(280, el.clientWidth || 720));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = series.filter(s => !off[s.name]);
  const n = labels.length;
  const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const max = useMemo(() => niceMax(Math.max(0, ...shown.flatMap(s => s.values))), [shown]);
  const X = i => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = v => PAD.t + ih - (v / max) * ih;
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i);
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 78))));

  function track(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) - PAD.l;
    setHover(Math.min(n - 1, Math.max(0, Math.round((x / iw) * (n - 1)))));
  }

  const tipX = hover === null ? 0 : X(hover);
  const flip = tipX > w * 0.62;

  return (
    <div className="lc" ref={wrap}>
      <div className="lc-legend">
        {series.map(s => {
          const total = s.values.reduce((a, b) => a + b, 0);
          return (
            <button key={s.name} type="button" className={`lc-key ${off[s.name] ? "off" : ""}`} aria-pressed={!off[s.name]}
              onClick={() => setOff(o => ({ ...o, [s.name]: !o[s.name] }))}>
              <i style={{ background: s.color }} /><span>{s.name}</span><b>{format(total)}</b>
            </button>
          );
        })}
      </div>
      <div className="lc-stage" style={{ height }}>
        <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img"
          aria-label={`Line graph of ${series.map(s => s.name).join(" and ")} over ${n} days`}
          onPointerMove={track} onPointerDown={track} onPointerLeave={() => setHover(null)}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.name} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity=".32" /><stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <filter id={`${uid}sh`} x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity=".18" /></filter>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={w - PAD.r} y1={Y(t)} y2={Y(t)} className={i === 0 ? "lc-axis" : "lc-grid"} />
              <text x={PAD.l - 10} y={Y(t) + 4} textAnchor="end" className="lc-tick">{compact(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => i % step === 0 && (
            <text key={i} x={X(i)} y={height - 10} textAnchor={i === 0 ? "start" : "middle"} className="lc-tick">{l}</text>
          ))}

          {series.map((s, si) => {
            if (off[s.name]) return null;
            const pts = s.values.map((v, i) => [X(i), Y(v)]);
            const line = smooth(pts);
            const area = pts.length > 1 ? `${line} L${X(n - 1)},${Y(0)} L${X(0)},${Y(0)} Z` : "";
            return (
              <g key={s.name}>
                {area && <path d={area} fill={`url(#${uid}g${si})`} className="lc-area" />}
                <path d={line} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="lc-line" filter={`url(#${uid}sh)`} />
                {n <= 31 && pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke={s.color} strokeWidth="2" className="lc-dot" />)}
              </g>
            );
          })}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={tipX} x2={tipX} y1={PAD.t} y2={PAD.t + ih} className="lc-cross" />
              {shown.map(s => <circle key={s.name} cx={tipX} cy={Y(s.values[hover])} r="6" fill={s.color} stroke="#fff" strokeWidth="3" />)}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div className="lc-tip" style={{ left: flip ? "auto" : tipX + 14, right: flip ? w - tipX + 14 : "auto" }}>
            <div className="lc-tip-h">{labels[hover]}</div>
            {shown.map(s => <div key={s.name} className="lc-tip-r"><i style={{ background: s.color }} />{s.name}<b>{format(s.values[hover])}</b></div>)}
          </div>
        )}
        {!shown.length && <div className="lc-none">Turn a line back on to see the graph</div>}
      </div>
    </div>
  );
}

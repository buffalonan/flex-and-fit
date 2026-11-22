// Animated SVG figures for the stretches, after the v2 prototype (prototypes/animaciones/): a jointed figure that eases
// from a start pose (a) into the stretch (b), holds it while breathing, and lights up where you should feel it.
// Angles are in degrees: 0 points up, 90 right, 180 down, 270 left. The figure faces right.
// Pose keys: x/y hip position (y is optional: without it the figure rests on the floor), tr trunk, cv trunk curve,
// hd head, a1/a2 near/far arm [upper, fore], l1/l2 near/far leg [thigh, shin], f1/f2 foot angle,
// vista "frente" or "arriba" (front or top view: limbs split left and right of the trunk).
import { html } from "./html.js";

const L = { tr: 38, ua: 19, fa: 17, th: 30, sh: 29, ft: 9 };
const FLOOR = 142;
const COL = { near: "#7d9cbc", far: "#4d6986", head: "#8fadc9" };

const base = { x: 100, tr: 0, cv: 0, hd: null, a1: [180, 180], a2: [180, 180], l1: [180, 180], l2: [180, 180] };
// modo "hold": ease into b and stay. "reps": move a ↔ b. T: seconds per cycle. hl: what lights up.
const P = {
  resp: { modo: "reps", T: 10, hl: ["tr"], a: { x: 112, tr: 270, a1: [70, 100], a2: [75, 105], l1: [40, 150], l2: [44, 152], f1: 90, f2: 90 }, b: { cv: 4 } },
  gato: { modo: "reps", T: 8, hl: ["tr"], a: { x: 128, tr: 281, hd: 300, cv: -5, a1: [180, 180], a2: [182, 182], l1: [180, 90], l2: [182, 92], f1: 90, f2: 90 }, b: { cv: 9, hd: 220 } },
  rodpecho: { hl: ["lum", "glu"], a: { x: 108, tr: 270, l1: [0, 80], l2: [4, 84], a1: [30, 100], a2: [34, 104] }, b: { l1: [-35, 50], l2: [-31, 54], a1: [10, 110], a2: [14, 114] } },
  isquio_toalla: { hl: ["th1"], toalla: true, a: { x: 100, tr: 270, l1: [45, 50], l2: [90, 90], f2: 0, a1: [40, 55], a2: [90, 90] }, b: { l1: [8, 14], a1: [25, 30] } },
  flex_cadera: { hl: ["th2"], cojin: "k2", a: { x: 96, tr: 0, l1: [90, 180], l2: [200, 270], f1: 90, f2: 270, a1: [160, 115], a2: [165, 120] }, b: { x: 102, tr: -4, l1: [96, 168], l2: [214, 270] } },
  fig4: { hl: ["glu"], a: { x: 104, tr: 270, l2: [25, 105], l1: [75, 320], a1: [45, 20], a2: [49, 24] }, b: { l2: [0, 90], l1: [55, 285], a1: [30, 10], a2: [34, 14] } },
  mariposa: { vista: "frente", hl: ["th1", "th2"], a: { x: 100, y: 112, tr: 0, l1: [75, 235], l2: [-75, 125], a1: [170, 150], a2: [190, 210] }, b: { l1: [100, 245], l2: [-100, 115] } },
  nino: { hl: ["lum", "dor"], a: { x: 74, tr: 25, hd: 40, l1: [135, 270], l2: [137, 272], f1: 270, f2: 270, a1: [150, 110], a2: [152, 112] }, b: { tr: 103, hd: 125, a1: [100, 92], a2: [102, 94] } },
  torsion: { vista: "arriba", hl: ["lum", "glu"], a: { x: 112, y: 62, tr: 270, a1: [180, 180], a2: [0, 0], l1: [100, 90], l2: [100, 90] }, b: { l1: [148, 100], l2: [148, 100] } },
  gemelo: { hl: ["sh1"], pared: "W1", a: { x: 92, tr: 16, l1: [200, 200], l2: [160, 192], f1: 90, f2: 90, a1: [75, 80], a2: [78, 82] }, b: { x: 100, tr: 34, l1: [212, 212], l2: [150, 196], a1: [62, 70], a2: [64, 72] } },
  tobillo_pared: { modo: "reps", T: 4, hl: ["sh1"], pared: "T1", a: { x: 98, tr: 4, l1: [90, 178], l2: [192, 270], f1: 90, f2: 270, a1: [65, 80], a2: [67, 82] }, b: { x: 104, l1: [100, 148], l2: [200, 270], a1: [70, 78] } },
  cuad_pie: { hl: ["th1"], pared: "W2", a: { x: 100, tr: 2, l2: [180, 180], f2: 90, l1: [182, 290], f1: 200, a1: [195, 175], a2: [65, 82] }, b: { l1: [188, 348], f1: 260, a1: [205, 160] } },
  pecho_puerta: { hl: ["dor", "ua1"], marco: "E1", a: { x: 104, tr: 3, l1: [168, 180], l2: [194, 186], f1: 90, f2: 90, a1: [262, 0], a2: [175, 180] }, b: { x: 110, tr: 8, a1: [272, 2] } },
  hombro_cruz: { vista: "frente", hl: ["sho1"], a: { x: 100, tr: 0, l1: [175, 180], l2: [185, 180], a1: [215, 200], a2: [170, 160] }, b: { a1: [268, 268], a2: [160, 62] } },
  angeles: { vista: "frente", modo: "reps", T: 6, hl: ["dor", "sho1", "sho2"], muro: true, a: { x: 100, tr: 0, l1: [175, 180], l2: [185, 180], a1: [115, 20], a2: [245, 340] }, b: { a1: [58, 15], a2: [302, 345] } },
  cuello: { vista: "frente", hl: ["neck"], a: { x: 100, tr: 0, hd: 0, l1: [175, 180], l2: [185, 180], a1: [178, 180], a2: [182, 180] }, b: { hd: 24, a1: [40, 300], a2: [184, 180] } },
  esfinge: { hl: ["lum"], a: { x: 80, tr: 76, hd: 70, l1: [270, 270], l2: [270, 270], f1: 270, f2: 270, a1: [118, 90], a2: [120, 92] }, b: { tr: 60, hd: 30, a1: [178, 90], a2: [180, 92] } },
  sentadilla: { hl: ["glu", "sh1"], marco: "W1", a: { x: 96, tr: 10, l1: [150, 192], l2: [152, 194], f1: 90, f2: 90, a1: [85, 85], a2: [87, 87] }, b: { tr: 30, l1: [78, 196], l2: [80, 198], a1: [78, 82], a2: [80, 84] } },
  nov90: { vista: "arriba", modo: "reps", T: 7, hl: ["glu"], a: { x: 100, y: 74, tr: 0, l1: [90, 180], l2: [270, 0], a1: [205, 190], a2: [155, 170] }, b: { l1: [90, 0], l2: [270, 180] } },
  paloma: { hl: ["glu"], cojin: "h", a: { x: 92, tr: 6, l1: [98, 250], l2: [263, 270], f1: 200, f2: 270, a1: [172, 178], a2: [176, 182] }, b: { tr: 62, hd: 90, a1: [110, 100], a2: [112, 102] } },
  pinza_pie: { hl: ["th1", "lum"], a: { x: 100, tr: 4, l1: [178, 184], l2: [180, 186], f1: 90, f2: 90, a1: [182, 178], a2: [184, 180] }, b: { tr: 160, hd: 178, l1: [172, 188], l2: [174, 190], a1: [175, 180], a2: [177, 182] } },
  estocada_rot: { modo: "reps", T: 6, hl: ["th2", "dor"], a: { x: 92, tr: 55, l1: [88, 180], l2: [245, 252], f1: 90, f2: 0, a1: [165, 180], a2: [160, 178] }, b: { a1: [0, 0], hd: 20 } },
  pinza_sentado: { hl: ["th1"], a: { x: 70, tr: 8, l1: [90, 90], l2: [91, 91], f1: 0, f2: 0, a1: [150, 140], a2: [152, 142] }, b: { tr: 66, hd: 100, a1: [98, 94], a2: [100, 96] } },
  aductor: { vista: "frente", modo: "reps", T: 6, hl: ["th1"], a: { x: 92, tr: 0, l2: [180, 180], ls2: 0.25, l1: [128, 128], a1: [200, 150], a2: [160, 210] }, b: { x: 86, l1: [113, 113] } },
  paso_toalla: { vista: "frente", modo: "reps", T: 6, hl: ["sho1", "sho2"], toalla2: true, a: { x: 100, tr: 0, l1: [175, 180], l2: [185, 180], a1: [140, 140], a2: [220, 220] }, b: { a1: [35, 35], a2: [325, 325] } },
  slr_activa: { modo: "reps", T: 7, hl: ["th1"], a: { x: 100, tr: 270, l1: [90, 90], l2: [91, 91], f1: 0, f2: 0, a1: [95, 92], a2: [97, 94] }, b: { l1: [22, 22] } },
  aguja: { modo: "reps", T: 7, hl: ["dor", "sho1"], a: { x: 128, tr: 281, hd: 270, a1: [180, 180], a2: [182, 182], l1: [180, 90], l2: [182, 92], f1: 90, f2: 90 }, b: { tr: 250, hd: 235, a1: [100, 92], a2: [160, 170] } },
  puente: { modo: "reps", T: 6, hl: ["glu"], a: { x: 112, tr: 270, l1: [40, 150], l2: [44, 152], f1: 90, f2: 90, a1: [95, 90], a2: [97, 92] }, b: { tr: 292, l1: [76, 168], l2: [78, 170], a1: [112, 90], a2: [114, 92] } },
  cobra: { hl: ["lum"], a: { x: 82, tr: 70, hd: 60, l1: [270, 270], l2: [270, 270], f1: 270, f2: 270, a1: [262, 150], a2: [264, 152] }, b: { tr: 44, hd: 20, a1: [212, 150], a2: [214, 152] } },
};
export const FIGURAS = Object.keys(P);

const rad = (a) => (a * Math.PI) / 180;
const dir = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];
const add = (p, a, len) => { const d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
const lerp = (a, b, t) => a + (b - a) * t;
function mix(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k]; // eslint-disable-line security/detect-object-injection -- pose keys
    o[k] = Array.isArray(va) ? va.map((v, i) => lerp(v, vb[i], t)) : typeof va === "number" && typeof vb === "number" ? lerp(va, vb, t) : va; // eslint-disable-line security/detect-object-injection
  }
  return o;
}

/** Joint positions of a pose. Returns points and the lowest point's y (for resting on the floor). */
function joints(p, y) {
  const vista = p.vista;
  const H = [p.x, y];
  const tr = p.tr;
  const S = add(H, tr, L.tr);
  const n = dir(tr + 90);
  const C = [(H[0] + S[0]) / 2 + n[0] * p.cv, (H[1] + S[1]) / 2 + n[1] * p.cv];
  const hd = p.hd ?? tr;
  const head = add(S, hd, 13), neck = add(S, hd, 6);
  const sw = vista ? 9 : 0, hw = vista ? 6 : 0;
  const S1 = [S[0] + n[0] * sw, S[1] + n[1] * sw], S2 = [S[0] - n[0] * sw, S[1] - n[1] * sw];
  const H1 = [H[0] + n[0] * hw, H[1] + n[1] * hw], H2 = [H[0] - n[0] * hw, H[1] - n[1] * hw];
  const E1 = add(S1, p.a1[0], L.ua), W1 = add(E1, p.a1[1], L.fa);
  const E2 = add(S2, p.a2[0], L.ua), W2 = add(E2, p.a2[1], L.fa);
  const K1 = add(H1, p.l1[0], L.th), A1 = add(K1, p.l1[1], L.sh * (p.ls1 || 1));
  const K2 = add(H2, p.l2[0], L.th), A2 = add(K2, p.l2[1], L.sh * (p.ls2 || 1));
  const T1 = vista ? A1 : add(A1, p.f1 ?? p.l1[1] - 90, L.ft), T2 = vista ? A2 : add(A2, p.f2 ?? p.l2[1] - 90, L.ft);
  const low = Math.max(H[1] + 6, S[1] + 6, head[1] + 7, W1[1] + 3, W2[1] + 3, E1[1] + 3.5, E2[1] + 3.5, K1[1] + 5, K2[1] + 5, A1[1] + 4, A2[1] + 4, T1[1] + 2.5, T2[1] + 2.5);
  return { H, S, C, head, neck, S1, S2, H1, H2, E1, W1, E2, W2, K1, A1, K2, A2, T1, T2, low };
}
// Rest a pose on the floor unless it fixes its own height.
const ground = (p) => p.y ?? FLOOR - (joints(p, 0).low);

function def(id) {
  const d = P[id]; // eslint-disable-line security/detect-object-injection -- id is an exercise id
  if (!d) return null;
  if (!d._a) {
    d._a = { ...base, ...d.a, vista: d.vista };
    d._b = { ...d._a, ...d.b };
    d._ya = ground(d._a);
    d._yb = ground(d._b);
  }
  return d;
}

/* ---------- Markup ---------- */
const SEGS = [
  ["ua2", "far", 6], ["fa2", "far", 5], ["th2", "far", 9], ["sh2", "far", 7], ["ft2", "far", 4.5],
  ["tr", "near", 12], ["neck", "near", 5],
  ["th1", "near", 9], ["sh1", "near", 7], ["ft1", "near", 4.5], ["ua1", "near", 6], ["fa1", "near", 5],
];
// A highlight goes right after the limb it sits on, so nearer limbs still cover it.
const SOBRE = { th2: "th2", sh2: "sh2", ua2: "ua2", tr: "tr", lum: "tr", dor: "tr", glu: "tr" };

/** An animated figure for a stretch. */
export function figura(id, { clase = "" } = {}) {
  const d = def(id);
  if (!d) return html`<svg class="fig ${clase}" viewBox="0 0 200 150" aria-hidden="true"></svg>`;
  const front = !!d.vista;
  const segs = SEGS.map(([k, c, w]) => {
    const width = front && k === "tr" ? 20 : w;
    const col = front ? COL.near : COL[c]; // eslint-disable-line security/detect-object-injection -- c is near/far
    return k === "tr"
      ? html`<path data-k="tr" fill="none" stroke="${col}" stroke-width="${width}" stroke-linecap="round"/>`
      : html`<line data-k="${k}" stroke="${col}" stroke-width="${width}" stroke-linecap="round"/>`;
  });
  // Highlights sit on top of their limb.
  const hl = d.hl.map((k) => (k === "glu" || k.startsWith("sho")
    ? html`<circle data-h="${k}" r="${k === "glu" ? 7 : 6}" fill="var(--glow)"/>`
    : k === "tr" || k === "lum" || k === "dor"
      ? html`<path data-h="${k}" fill="none" stroke="var(--glow)" stroke-width="${front ? 12 : 7}" stroke-linecap="round"/>`
      : html`<line data-h="${k}" stroke="var(--glow)" stroke-width="5" stroke-linecap="round"/>`));
  const b = joints(d._b, d._yb);
  const props = [];
  if (d.vista !== "arriba") props.push(html`<line x1="8" y1="${FLOOR}" x2="192" y2="${FLOOR}" stroke="var(--app-line)" stroke-width="2"/>`);
  if (d.muro) props.push(html`<rect x="66" y="8" width="68" height="${FLOOR - 8}" rx="3" fill="var(--app-line)" opacity=".45"/>`);
  // Walls and door frames stand where the hand (or toe) touches them in the stretch.
  if (d.pared) props.push(html`<rect x="${(b[d.pared][0] + (d.pared === "T1" ? 8 : 3)).toFixed(1)}" y="6" width="7" height="${FLOOR - 6}" rx="2" fill="var(--prop)"/>`);
  if (d.marco) props.push(html`<rect x="${(b[d.marco][0] + (d.marco === "E1" ? -7 : 2)).toFixed(1)}" y="6" width="5" height="${FLOOR - 6}" rx="2" fill="var(--prop)"/>`);
  if (d.cojin === "k2") props.push(html`<rect x="${b.K2[0] - 11}" y="${FLOOR - 5}" width="22" height="5" rx="2.5" fill="var(--prop)"/>`);
  if (d.cojin === "h") props.push(html`<rect x="${b.H[0] - 12}" y="${FLOOR - 7}" width="26" height="7" rx="3" fill="var(--prop)"/>`);
  const towel = d.toalla || d.toalla2 ? html`<line data-k="towel" stroke="var(--prop)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${d.toalla ? "4 3" : "none"}"/>` : "";
  const vista = d.vista === "arriba" ? html`<text x="194" y="12" text-anchor="end" class="fig-nota">Vista desde arriba</text>` : d.vista ? html`<text x="194" y="12" text-anchor="end" class="fig-nota">De frente</text>` : "";
  const parts = [];
  for (const [k] of SEGS) {
    parts.push(segs.shift());
    for (const [j, h] of d.hl.entries()) if (SOBRE[h] === k) parts.push(hl[j]); // eslint-disable-line security/detect-object-injection
    if (k === "neck") parts.push(html`<circle data-k="head" r="7" fill="${COL.head}"/>`);
  }
  const rest = hl.filter((_, j) => !SOBRE[d.hl[j]]); // eslint-disable-line security/detect-object-injection
  const el = html`<svg class="fig ${clase}" viewBox="0 0 200 150" data-fig="${id}" aria-hidden="true">${props}${parts}${rest}${towel}${vista}</svg>`;
  return el;
}

/* ---------- Drawing a frame ---------- */
function split(H, C, S) {
  const a = [(H[0] + C[0]) / 2, (H[1] + C[1]) / 2], b = [(C[0] + S[0]) / 2, (C[1] + S[1]) / 2], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return [`M${H[0]} ${H[1]}Q${a[0]} ${a[1]} ${m[0]} ${m[1]}`, `M${m[0]} ${m[1]}Q${b[0]} ${b[1]} ${S[0]} ${S[1]}`];
}
const seg = (el, p, q) => { el.setAttribute("x1", p[0].toFixed(1)); el.setAttribute("y1", p[1].toFixed(1)); el.setAttribute("x2", q[0].toFixed(1)); el.setAttribute("y2", q[1].toFixed(1)); };

/** Draws the figure in svg at progress p (0 = start pose, 1 = stretch), with t seconds for breathing. */
export function dibujar(svg, p, t = 0) {
  const d = def(svg.dataset.fig);
  if (!d) return;
  const pose = mix(d._a, d._b, p);
  pose.tr += Math.sin((t * 2 * Math.PI) / 5) * 1.2 * p;
  const j = joints(pose, lerp(d._ya, d._yb, p));
  if (!svg._els) {
    svg._els = {};
    svg.querySelectorAll("[data-k],[data-h]").forEach((e) => { svg._els[e.dataset.k || `h-${e.dataset.h}`] = e; });
  }
  const E = svg._els;
  const [lum, dor] = split(j.H, j.C, j.S);
  E.tr.setAttribute("d", `M${j.H[0]} ${j.H[1]}Q${j.C[0]} ${j.C[1]} ${j.S[0]} ${j.S[1]}`);
  seg(E.neck, j.S, j.neck);
  E.head.setAttribute("cx", j.head[0].toFixed(1)); E.head.setAttribute("cy", j.head[1].toFixed(1));
  const L2 = { ua1: [j.S1, j.E1], fa1: [j.E1, j.W1], ua2: [j.S2, j.E2], fa2: [j.E2, j.W2], th1: [j.H1, j.K1], sh1: [j.K1, j.A1], ft1: [j.A1, j.T1], th2: [j.H2, j.K2], sh2: [j.K2, j.A2], ft2: [j.A2, j.T2] };
  for (const [k, [a, b]] of Object.entries(L2)) seg(E[k], a, b); // eslint-disable-line security/detect-object-injection
  if (E.towel) seg(E.towel, j.W1, d.toalla ? j.T1 : j.W2);
  const glow = (0.3 + 0.7 * p).toFixed(2);
  for (const k of d.hl) {
    const e = E[`h-${k}`];
    e.setAttribute("opacity", glow);
    if (k === "glu") { e.setAttribute("cx", j.H[0].toFixed(1)); e.setAttribute("cy", j.H[1].toFixed(1)); }
    else if (k === "sho1" || k === "sho2") { const s = k === "sho1" ? j.S1 : j.S2; e.setAttribute("cx", s[0].toFixed(1)); e.setAttribute("cy", s[1].toFixed(1)); }
    else if (k === "tr") e.setAttribute("d", E.tr.getAttribute("d"));
    else if (k === "lum") e.setAttribute("d", lum);
    else if (k === "dor") e.setAttribute("d", dor);
    else if (k === "neck") seg(e, j.S, j.neck);
    else seg(e, ...L2[k]); // eslint-disable-line security/detect-object-injection
  }
}

/* ---------- Animation ---------- */
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** Progress of the looping preview at time t (s). */
export function bucle(id, t) {
  const d = def(id);
  if (!d) return 0;
  if (d.modo === "reps") return (1 - Math.cos((t * 2 * Math.PI) / d.T)) / 2;
  const c = t % 10;
  return c < 1 ? 0 : c < 3.5 ? ease((c - 1) / 2.5) : c < 8 ? 1 : 1 - ease((c - 8) / 2);
}
/** Progress inside a player step that has run for t seconds. */
export function enPaso(id, t) {
  const d = def(id);
  if (!d) return 0;
  return d.modo === "reps" ? (1 - Math.cos((t * 2 * Math.PI) / d.T)) / 2 : ease(t / 2.5);
}

const reduce = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const visibles = new Set();
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target)))) : null;
let running = false;

/** Starts animating every figure under root. A figure with a _ctl(t) function is driven by it (the player). */
export function animar(root = document) {
  root.querySelectorAll("svg[data-fig]").forEach((svg) => {
    if (svg._seen) return;
    svg._seen = true;
    svg._off = Math.random() * 6;
    dibujar(svg, reduce() ? 1 : 0, 0);
    if (io) io.observe(svg); else visibles.add(svg);
  });
  if (running || reduce()) return;
  running = true;
  const frame = (ms) => {
    const t = ms / 1000;
    for (const svg of visibles) {
      if (!svg.isConnected) { visibles.delete(svg); io?.unobserve(svg); continue; }
      if (!svg.getClientRects().length) continue;
      if (svg._ctl) { const c = svg._ctl(t); dibujar(svg, c.p, c.t); }
      else dibujar(svg, bucle(svg.dataset.fig, t + svg._off), t);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

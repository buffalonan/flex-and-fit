// Animated SVG figures for the stretches, after the v2 prototype (prototypes/animaciones/): a jointed figure that eases
// from a start pose (a) into the stretch (b), holds it while breathing, and lights up where you should feel it.
// Angles are in degrees: 0 points up, 90 right, 180 down, 270 left. The figure faces right.
// Pose keys: x/y hip position (y is optional: without it the figure rests on the floor), tr trunk, cv trunk curve,
// hd head, a1/a2 near/far arm [upper, fore], l1/l2 near/far leg [thigh, shin], f1/f2 foot angle,
// vista "frente" or "arriba" (front or top view: limbs split left and right of the trunk).
// Strength figures (GYM below) add: m1/m2 a hand's target [dx, dy] from its shoulder and p1/p2 an ankle's target from its
// hip, solved with two-bone IK (c1/c2, k1/k2 flip the elbow or knee); fijo [joint, x, y] pins a joint (feet on the floor,
// hands on a bar, hips on a bench); peso the weight held; obj fixed furniture; cable a pulley anchor [x, y, to] (to: "manos" the point between
// the hands, "cuerda" a rope whose ends are in each hand, else the near hand); fr keyframes
// for movements that aren't a simple back and forth (modo "ciclo").
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
  pinza_pie: { hl: ["th1", "lum"], a: { x: 100, tr: 4, l1: [178, 184], l2: [180, 186], f1: 90, f2: 90, a1: [182, 178], a2: [184, 180] }, b: { tr: 146, hd: 166, l1: [172, 188], l2: [174, 190], a1: [168, 176], a2: [170, 178] } },
  estocada_rot: { modo: "reps", T: 6, hl: ["th2", "dor"], a: { x: 92, tr: 55, l1: [88, 180], l2: [245, 252], f1: 90, f2: 0, a1: [165, 180], a2: [160, 178] }, b: { a1: [0, 0], hd: 20 } },
  pinza_sentado: { hl: ["th1"], a: { x: 70, tr: 8, l1: [90, 90], l2: [91, 91], f1: 0, f2: 0, a1: [150, 140], a2: [152, 142] }, b: { tr: 66, hd: 100, a1: [98, 94], a2: [100, 96] } },
  aductor: { vista: "frente", modo: "reps", T: 6, hl: ["th1"], a: { x: 92, tr: 0, l2: [180, 180], ls2: 0.25, l1: [128, 128], a1: [200, 150], a2: [160, 210] }, b: { x: 86, l1: [113, 113] } },
  paso_toalla: { vista: "frente", modo: "reps", T: 6, hl: ["sho1", "sho2"], toalla2: true, a: { x: 100, tr: 0, l1: [175, 180], l2: [185, 180], a1: [140, 140], a2: [220, 220] }, b: { a1: [35, 35], a2: [325, 325] } },
  slr_activa: { modo: "reps", T: 7, hl: ["th1"], a: { x: 100, tr: 270, l1: [90, 90], l2: [91, 91], f1: 0, f2: 0, a1: [95, 92], a2: [97, 94] }, b: { l1: [22, 22] } },
  aguja: { modo: "reps", T: 7, hl: ["dor", "sho1"], a: { x: 128, tr: 281, hd: 270, a1: [180, 180], a2: [182, 182], l1: [180, 90], l2: [182, 92], f1: 90, f2: 90 }, b: { tr: 250, hd: 235, a1: [100, 92], a2: [160, 170] } },
  // Shoulders, head and feet stay on the floor; only the hips rise, to a straight line from shoulder to knee.
  puente: { modo: "reps", T: 6, hl: ["glu"], a: { x: 112, tr: 270, hd: 270, p1: [34, 2], p2: [36, 2], f1: 90, f2: 90, a1: [95, 90], a2: [97, 92] }, b: { x: 109.2, tr: 248, p1: [36.8, 16.2], p2: [38.8, 16.2] } },
  cobra: { hl: ["lum"], a: { x: 82, tr: 70, hd: 60, l1: [270, 270], l2: [270, 270], f1: 270, f2: 270, a1: [262, 150], a2: [264, 152] }, b: { tr: 44, hd: 20, a1: [212, 150], a2: [214, 152] } },
};
export const FIGURAS = Object.keys(P);

/* ---------- Strength exercises ---------- */
// Side view facing right unless vista says otherwise. Floor at y 142; a bench top at y 112.
const G = {};
const DE_PIE = { p1: [2, 58], p2: [4, 58], f1: 90, f2: 90 };
const PIES = ["A1", 100, 138];
const BANCO = [["r", 46, 112, 96, 6, 3], ["r", 54, 118, 5, 24, 1], ["r", 128, 118, 5, 24, 1]];
const TORRE = (x) => [["r", x, 6, 8, 136, 2]];
const RACK = (x) => [["r", x - 2, 104, 10, 6, 2]];
const kbRemo = { hl: ["dor", "ua1"], fijo: ["A1", 74, 138], obj: [["r", 112, 104, 40, 6, 3], ["r", 118, 110, 5, 32, 1], ["r", 142, 110, 5, 32, 1]],
  a: { tr: 75, hd: 85, p1: [-6, 56], p2: [12, 54], f1: 90, f2: 90, m1: [0, 33], m2: [10, 33] }, b: { m1: [-16, 14] } };
const swingA = { tr: 66, hd: 76, p1: [16, 50], p2: [18, 50], f1: 90, f2: 90, m1: [-10, 32], m2: [-8, 32] };
const tumbado = { tr: 270, hd: 270 };
Object.assign(G, {
  kb_halo: { vista: "frente", hl: ["sho1", "sho2"], peso: [["kb", "manos"]], T: 3.5, fr: [
    { x: 100, tr: 0, l1: [175, 180], l2: [185, 180], m1: [-9, 2], m2: [9, 2], c1: -1, c2: 1 },
    { m1: [9, -12], m2: [27, -12] }, { m1: [-9, -28], m2: [9, -28] }, { m1: [-27, -12], m2: [-9, -12] }] },
  kb_pm: { hl: ["glu", "th1"], peso: [["kb", "manos"]], fijo: PIES, T: 3.5,
    a: { tr: 66, hd: 74, p1: [18, 46], p2: [20, 46], f1: 90, f2: 90, m1: [0, 34], m2: [2, 34] }, b: { tr: 0, hd: 0, ...DE_PIE, m1: [3, 34], m2: [5, 34] } },
  kb_swing: { hl: ["glu", "th1"], peso: [["kb", "manos"]], fijo: PIES, T: 2.4, a: swingA, b: { tr: -4, hd: -4, ...DE_PIE, m1: [35, 2], m2: [35, 4] } },
  kb_goblet: { hl: ["th1", "glu"], peso: [["kb", "manos"]], fijo: PIES, T: 4,
    a: { tr: 0, hd: 0, ...DE_PIE, m1: [9, 14], m2: [11, 14] }, b: { tr: 30, hd: 10, p1: [30, 22], p2: [32, 22], m1: [12, 14], m2: [14, 14] } },
  kb_press: { escala: 0.84, hl: ["sho1", "ua1"], peso: [["kb", "W1"]], fijo: PIES, a: { tr: 0, ...DE_PIE, m1: [7, 12], m2: [2, 35] }, b: { m1: [2, -35] } },
  kb_remo: { ...kbRemo, peso: [["kb", "W1"]] },
  kb_swing1: { hl: ["glu", "th1"], peso: [["kb", "W1"]], fijo: PIES, T: 2.4, a: { ...swingA, m2: [-4, 33] }, b: { tr: -4, hd: -4, ...DE_PIE, m1: [35, 2], m2: [16, 28] } },
  kb_cargada: { hl: ["glu", "th1"], peso: [["kb", "W1"]], fijo: PIES, T: 2.6, a: { ...swingA, m2: [-4, 33] }, b: { tr: 0, hd: 0, ...DE_PIE, m1: [7, 12], m2: [4, 34] } },
  kb_molino: { escala: 0.84, vista: "frente", hl: ["tr"], peso: [["kb", "W1"]], T: 5,
    a: { x: 100, tr: 0, l1: [162, 180], l2: [198, 180], m1: [0, -35], m2: [0, 35] }, b: { x: 108, tr: -42, m2: [-6, 34] } },
  kb_turco: { escala: 0.84, hl: ["sho1", "tr"], peso: [["kb", "W1"]], T: 14, fr: [
    { tr: 270, hd: 270, l1: [40, 150], l2: [92, 92], f1: 90, f2: 0, m1: [0, -35], a2: [120, 100] },
    { tr: 305, hd: 320, a2: [190, 260] },
    { tr: 330, hd: 350, a2: [200, 200] },
    { tr: 340, hd: 0, l1: [70, 170], l2: [110, 110], a2: [200, 200] },
    { tr: 0, hd: 0, l1: [90, 180], l2: [180, 270], f2: 270, a2: [185, 185] },
    { tr: 0, hd: 0, l1: [180, 180], l2: [182, 182], f1: 90, f2: 90, a2: [182, 182] },
    { tr: 0, hd: 0, l1: [90, 180], l2: [180, 270], f2: 270, a2: [185, 185] },
    { tr: 340, hd: 0, l1: [70, 170], l2: [110, 110], f2: 0, a2: [200, 200] },
    { tr: 330, hd: 350, l1: [40, 150], l2: [92, 92], a2: [200, 200] },
    { tr: 305, hd: 320, a2: [190, 260] }] },

  banca: { hl: ["dor", "ua1"], peso: [["barra", "manos"]], fijo: ["H", 112, 106], obj: [...BANCO, ...RACK(66)],
    a: { ...tumbado, p1: [20, 33], p2: [22, 33], f1: 90, f2: 90, m1: [8, -8], m2: [9, -8] }, b: { m1: [3, -35], m2: [4, -35] } },
  inclinado: { hl: ["dor", "ua1"], peso: [["barra", "manos"]], fijo: ["H", 106, 106], obj: [["l", 112, 110, 64, 80, 6], ["r", 90, 108, 30, 6, 3], ["r", 102, 114, 5, 28, 1]],
    a: { tr: 302, hd: 320, p1: [22, 33], p2: [24, 33], f1: 90, f2: 90, m1: [12, -4], m2: [13, -4] }, b: { m1: [6, -35], m2: [7, -35] } },
  press_hombro: { hl: ["sho1", "ua1"], peso: [["manc", "W1"], ["manc", "W2"]], fijo: ["H", 96, 106], obj: [["r", 80, 108, 32, 6, 3], ["r", 76, 50, 6, 58, 3], ["r", 94, 114, 5, 28, 1]],
    a: { tr: 0, hd: 0, l1: [90, 180], l2: [92, 182], f1: 90, f2: 90, m1: [8, -3], m2: [10, -3] }, b: { m1: [3, -35], m2: [5, -35] } },
  laterales: { vista: "frente", hl: ["sho1", "sho2"], peso: [["manc", "W1"], ["manc", "W2"]],
    a: { x: 100, tr: 0, l1: [175, 180], l2: [185, 180], a1: [168, 172], a2: [192, 188] }, b: { a1: [90, 98], a2: [270, 262] } },
  fondos: { hl: ["ua1", "dor"], fijo: ["W1", 100, 72], obj: [["l", 70, 72, 140, 72, 4], ["r", 132, 72, 5, 70, 1], ["r", 72, 72, 5, 70, 1]],
    a: { tr: 10, hd: 12, l1: [172, 268], l2: [174, 270], f1: 180, f2: 180, m1: [-3, 34], m2: [-2, 34] }, b: { tr: 24, hd: 30, m1: [8, 20], m2: [9, 20] } },
  triceps_polea: { hl: ["ua1"], fijo: ["A1", 90, 138], cable: [146, 14, "cuerda"], obj: TORRE(150),
    a: { tr: 10, hd: 14, ...DE_PIE, a1: [176, 60], a2: [178, 62] }, b: { a1: [176, 172], a2: [178, 174] } },

  sentadilla_barra: { hl: ["th1", "glu"], peso: [["barra", "S"]], fijo: PIES, T: 4,
    a: { tr: 4, hd: 0, ...DE_PIE, m1: [-6, 6], m2: [-5, 6] }, b: { tr: 38, hd: 20, p1: [30, 24], p2: [32, 24], m1: [-6, 6], m2: [-5, 6] } },
  rumano: { hl: ["th1", "glu"], peso: [["barra", "manos"]], fijo: PIES, T: 4,
    a: { tr: 0, hd: 0, ...DE_PIE, m1: [2, 34], m2: [3, 34] }, b: { tr: 72, hd: 82, p1: [12, 55], p2: [14, 55], m1: [0, 34], m2: [1, 34] } },
  bulgara: { hl: ["th1", "glu"], fijo: ["A1", 120, 138], obj: [["r", 40, 106, 36, 6, 3], ["r", 46, 112, 5, 30, 1], ["r", 66, 112, 5, 30, 1]], T: 3.5,
    a: { tr: 4, hd: 0, p1: [10, 57], p2: [-36, 24], f1: 90, f2: 200, m1: [2, 34], m2: [3, 34] }, b: { tr: 14, p1: [22, 38], p2: [-40, 6] } },
  prensa: { hl: ["th1", "glu"], peso: [["placa", "A1"]], fijo: ["H", 76, 112], obj: [["l", 82, 120, 48, 90, 7], ["l", 96, 124, 184, 36, 3], ["r", 72, 118, 8, 24, 1]],
    a: { tr: 312, hd: 330, p1: [24, -16], p2: [24, -15], m1: [10, 26], m2: [10, 26], f1: 45, f2: 45 }, b: { p1: [44, -34], p2: [44, -33] } },
  curl_femoral: { hl: ["th1"], peso: [["rodillo", "A1"]], fijo: ["H", 96, 106], obj: BANCO,
    a: { tr: 90, hd: 100, l1: [270, 270], l2: [272, 272], f1: 180, f2: 180, a1: [180, 120], a2: [182, 122] }, b: { l1: [270, 380], l2: [272, 382] } }, // 380 = 20° past vertical: the shin curls up, not down through the floor
  talones: { hl: ["sh1"], fijo: ["T1", 112, 140], T: 2,
    a: { tr: 0, hd: 0, l1: [180, 180], l2: [182, 182], f1: 90, f2: 90, a1: [182, 180], a2: [184, 182] }, b: { f1: 150, f2: 150 } },

  peso_muerto: { hl: ["glu", "th1", "lum"], peso: [["barra", "manos"]], fijo: PIES, T: 4,
    a: { tr: 52, hd: 64, p1: [26, 30], p2: [28, 30], f1: 90, f2: 90, m1: [0, 34], m2: [1, 34] }, b: { tr: 0, hd: 0, ...DE_PIE, m1: [3, 34], m2: [4, 34] } },
  dominadas: { escala: 0.8, sinSuelo: true, hl: ["dor", "ua1"], fijo: ["W1", 100, 6], obj: [["l", 50, 6, 150, 6, 4]], T: 3.5,
    a: { tr: 2, hd: 0, l1: [176, 250], l2: [178, 252], f1: 180, f2: 180, m1: [3, -34], m2: [4, -34] }, b: { m1: [6, -10], m2: [7, -10] } },
  remo_barra: { hl: ["dor"], peso: [["barra", "manos"]], fijo: PIES,
    a: { tr: 62, hd: 72, p1: [12, 52], p2: [14, 52], f1: 90, f2: 90, m1: [0, 34], m2: [1, 34] }, b: { m1: [-6, 18], m2: [-5, 18] } },
  remo_manc: { ...kbRemo, peso: [["manc", "W1"]] },
  face_pull: { hl: ["sho1", "dor"], fijo: ["A1", 84, 138], cable: [146, 34, "cuerda"], obj: TORRE(150),
    a: { tr: -4, hd: 0, ...DE_PIE, m1: [34, 6], m2: [33, 7] }, b: { m1: [12, -4], m2: [12, -3], c1: -1, c2: -1 } },
  curl: { hl: ["ua1"], peso: [["manc", "W1"]], fijo: PIES, a: { tr: 0, hd: 0, ...DE_PIE, a1: [176, 178], a2: [182, 182] }, b: { a1: [172, 30] } },

  hip_thrust: { hl: ["glu"], fijo: ["S", 66, 108], obj: [["r", 30, 112, 40, 30, 3]], T: 3,
    a: { tr: 306, hd: 300, p1: [24, 6], p2: [25, 6], f1: 90, f2: 90, a1: [100, 90], a2: [102, 92] }, b: { tr: 270, hd: 290, p1: [18, 31], p2: [19, 31] } },
  zancadas: { hl: ["th1", "glu"], peso: [["manc", "W1"], ["manc", "W2"]], fijo: ["A1", 122, 138], T: 3.5,
    a: { tr: 2, hd: 0, p1: [12, 56], p2: [-24, 52], f1: 90, f2: 180, m1: [2, 34], m2: [3, 34] }, b: { p1: [22, 38], p2: [-12, 32] } },
  piernas_colgado: { escala: 0.8, sinSuelo: true, hl: ["tr"], fijo: ["W1", 100, 6], obj: [["l", 50, 6, 150, 6, 4]], T: 3.5,
    a: { tr: 0, hd: 0, l1: [180, 180], l2: [182, 182], f1: 160, f2: 160, m1: [2, -35], m2: [3, -35] }, b: { tr: -8, l1: [88, 90], l2: [90, 92], f1: 70, f2: 70 } },
  plancha: { modo: "hold", hl: ["tr"], a: { tr: 84, hd: 92, l1: [264, 264], l2: [266, 266], f1: 180, f2: 180, a1: [180, 90], a2: [182, 92] }, b: { tr: 86 } },
  plancha_lateral: { vista: "frente", modo: "hold", hl: ["tr"], a: { x: 100, tr: 72, hd: 72, l1: [252, 252], l2: [254, 254], a1: [180, 90], a2: [0, 0] }, b: { tr: 74 } },

  press_militar: { escala: 0.84, hl: ["sho1", "ua1"], peso: [["barra", "manos"]], fijo: PIES, a: { tr: 0, hd: 0, ...DE_PIE, m1: [9, 4], m2: [10, 4] }, b: { tr: 3, m1: [2, -35], m2: [3, -35] } },
  press_pecho: { hl: ["dor", "ua1"], fijo: ["H", 86, 106], obj: [["r", 70, 108, 32, 6, 3], ["r", 66, 48, 6, 60, 3], ["r", 84, 114, 5, 28, 1]],
    a: { tr: 0, hd: 0, l1: [90, 180], l2: [92, 182], f1: 90, f2: 90, m1: [12, 4], m2: [13, 4] }, b: { m1: [34, 4], m2: [34, 5] } },
  jalon: { hl: ["dor", "ua1"], peso: [["manc", "manos"]], fijo: ["H", 96, 106], cable: [98, 4, "manos"], obj: [["r", 82, 108, 30, 6, 3], ["r", 108, 84, 12, 8, 3], ["r", 92, 114, 5, 28, 1]],
    a: { tr: -4, hd: 0, l1: [90, 180], l2: [92, 182], f1: 90, f2: 90, m1: [3, -35], m2: [4, -35] }, b: { tr: -12, m1: [8, -6], m2: [9, -6] } },
  remo_polea: { hl: ["dor"], peso: [["manc", "manos"]], fijo: ["H", 70, 112], cable: [168, 116, "manos"], obj: [["r", 50, 114, 34, 6, 3], ["r", 160, 104, 10, 38, 2], ["l", 144, 112, 148, 136, 4]],
    a: { tr: 8, hd: 10, p1: [72, 14], p2: [72, 15], k1: -1, f1: 90, f2: 90, m1: [34, 6], m2: [34, 7] }, b: { tr: -6, m1: [8, 22], m2: [9, 22] } },
  ext_cuadriceps: { hl: ["th1"], peso: [["rodillo", "A1"]], fijo: ["H", 90, 102], obj: [["r", 70, 104, 34, 6, 3], ["r", 66, 50, 6, 56, 3], ["r", 86, 110, 5, 32, 1]],
    a: { tr: 0, hd: 0, l1: [90, 180], l2: [92, 182], f1: 90, f2: 90, a1: [180, 180], a2: [182, 182] }, b: { l1: [90, 100], l2: [92, 102], f1: 10, f2: 10 } },
  ext_lumbar: { hl: ["lum"], fijo: ["H", 100, 92], obj: [["c", 104, 98, 6], ["r", 60, 128, 18, 6, 2], ["l", 104, 104, 92, 142, 4]], T: 3.5,
    a: { tr: 150, hd: 160, l1: [228, 228], l2: [230, 230], f1: 140, f2: 140, a1: [150, 30], a2: [152, 32] }, b: { tr: 48, hd: 60, a1: [80, 330], a2: [82, 332] } },
});
for (const d of Object.values(G)) { d.fuerza = true; d.modo ??= "reps"; d.T ??= 3; }
export const FIGURAS_FUERZA = Object.keys(G);

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

const ang = (v) => (Math.atan2(v[0], -v[1]) * 180) / Math.PI;
/** Two-bone IK: the angles [upper, lower] that put the end of a limb at target t (relative to its root). */
function ik(t, a, b, sign) {
  const d = Math.min(Math.max(Math.hypot(t[0], t[1]), Math.abs(a - b) + 0.01), a + b - 0.01);
  const al = (Math.acos((a * a + d * d - b * b) / (2 * a * d)) * 180) / Math.PI;
  const up = ang(t) + sign * al;
  const e = dir(up);
  return [up, ang([t[0] - e[0] * a, t[1] - e[1] * a])];
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
  const a1 = p.m1 ? ik(p.m1, L.ua, L.fa, p.c1 ?? 1) : p.a1, a2 = p.m2 ? ik(p.m2, L.ua, L.fa, p.c2 ?? 1) : p.a2;
  const l1 = p.p1 ? ik(p.p1, L.th, L.sh, p.k1 ?? -1) : p.l1, l2 = p.p2 ? ik(p.p2, L.th, L.sh, p.k2 ?? -1) : p.l2;
  const E1 = add(S1, a1[0], L.ua), W1 = add(E1, a1[1], L.fa);
  const E2 = add(S2, a2[0], L.ua), W2 = add(E2, a2[1], L.fa);
  const K1 = add(H1, l1[0], L.th), A1 = add(K1, l1[1], L.sh * (p.ls1 || 1));
  const K2 = add(H2, l2[0], L.th), A2 = add(K2, l2[1], L.sh * (p.ls2 || 1));
  const T1 = vista ? A1 : add(A1, p.f1 ?? l1[1] - 90, L.ft), T2 = vista ? A2 : add(A2, p.f2 ?? l2[1] - 90, L.ft);
  const low = Math.max(H[1] + 6, S[1] + 6, head[1] + 7, W1[1] + 3, W2[1] + 3, E1[1] + 3.5, E2[1] + 3.5, K1[1] + 5, K2[1] + 5, A1[1] + 4, A2[1] + 4, T1[1] + 2.5, T2[1] + 2.5);
  return { H, S, C, head, neck, S1, S2, H1, H2, E1, W1, E2, W2, K1, A1, K2, A2, T1, T2, low, tr };
}
/** Where the weights held are: kettlebell, dumbbell or barbell (seen end on), at a hand, both hands or the shoulders. */
// Also a leg press sled (placa, at the feet) and a machine's ankle pad (rodillo).
const RADIO = { kb: 6.5, manc: 4.5, barra: 13, placa: 4, rodillo: 4 };
function pesos(d, j) {
  return (d.peso || []).map(([tipo, en]) => {
    if (en === "A1") {
      const push = ang([j.A1[0] - j.H[0], j.A1[1] - j.H[1]]), shin = ang([j.A1[0] - j.K1[0], j.A1[1] - j.K1[1]]);
      return tipo === "placa" ? { tipo, c: add(j.A1, push, 5), rot: push, r: 4 } : { tipo, c: add(j.A1, shin + 90, 5), rot: 0, r: 4 };
    }
    if (en === "H") return { tipo, c: add(j.H, j.tr + 90, 8), rot: 0, r: RADIO[tipo] }; // eslint-disable-line security/detect-object-injection -- tipo is a weight type
    const W = en === "manos" ? [(j.W1[0] + j.W2[0]) / 2, (j.W1[1] + j.W2[1]) / 2] : en === "S" ? add(j.S, j.tr - 90, 5) : en === "W2" ? j.W2 : j.W1;
    const E = en === "W2" ? j.E2 : j.E1;
    const fore = ang([W[0] - E[0], W[1] - E[1]]);
    const c = tipo === "kb" ? add(W, fore, 7) : W;
    return { tipo, c, rot: fore - 180, r: RADIO[tipo] }; // eslint-disable-line security/detect-object-injection -- tipo is a weight type
  });
}
/** Joints of a pose at height y, moved so the figure's pinned joint (fijo) sits where it should. */
function colocar(d, pose, y) {
  if (!d.fijo) return joints(pose, y);
  const [k, fx, fy] = d.fijo;
  const j0 = joints(pose, 0);
  return joints({ ...pose, x: pose.x + fx - j0[k][0] }, fy - j0[k][1]); // eslint-disable-line security/detect-object-injection -- k is a joint name
}
// Rest a pose on the floor (weights included) unless it fixes its own height or pins a joint.
function ground(d, p) {
  if (p.y != null || d.fijo) return p.y ?? 0;
  const j = joints(p, 0);
  return FLOOR - Math.max(j.low, ...pesos(d, j).map((w) => w.c[1] + w.r));
}

function def(id) {
  const d = P[id] || G[id]; // eslint-disable-line security/detect-object-injection -- id is an exercise id
  if (!d) return null;
  if (!d._a && d.fr) {
    let f = { ...base, vista: d.vista };
    d._fr = d.fr.map((x) => (f = { ...f, ...x }));
    d._fy = d._fr.map((x) => ground(d, x));
    d._a = d._fr[0];
    d._ya = d._fy[0];
  } else if (!d._a) {
    d._a = { ...base, ...d.b, ...d.a, vista: d.vista };
    // A start pose without its own head follows its trunk, not the stretch's head (a standing figure looking at the floor).
    if (d.a.hd == null && d.b.hd != null) d._a.hd = d._a.tr;
    d._b = { ...d._a, ...d.b };
    d._ya = ground(d, d._a);
    d._yb = ground(d, d._b);
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
  const b = d._b ? colocar(d, d._b, d._yb) : null;
  const props = [];
  if (d.vista !== "arriba" && !d.sinSuelo) props.push(html`<line x1="8" y1="${FLOOR}" x2="192" y2="${FLOOR}" stroke="var(--app-line)" stroke-width="2"/>`);
  if (d.muro) props.push(html`<rect x="66" y="8" width="68" height="${FLOOR - 8}" rx="3" fill="var(--app-line)" opacity=".45"/>`);
  // Walls and door frames stand where the hand (or toe) touches them in the stretch.
  if (d.pared) props.push(html`<rect x="${(b[d.pared][0] + (d.pared === "T1" ? 8 : 3)).toFixed(1)}" y="6" width="7" height="${FLOOR - 6}" rx="2" fill="var(--prop)"/>`);
  if (d.marco) props.push(html`<rect x="${(b[d.marco][0] + (d.marco === "E1" ? -7 : 2)).toFixed(1)}" y="6" width="5" height="${FLOOR - 6}" rx="2" fill="var(--prop)"/>`);
  if (d.cojin === "k2") props.push(html`<rect x="${b.K2[0] - 11}" y="${FLOOR - 5}" width="22" height="5" rx="2.5" fill="var(--prop)"/>`);
  if (d.cojin === "h") props.push(html`<rect x="${b.H[0] - 12}" y="${FLOOR - 7}" width="26" height="7" rx="3" fill="var(--prop)"/>`);
  for (const o of d.obj || []) {
    if (o[0] === "r") props.push(html`<rect x="${o[1]}" y="${o[2]}" width="${o[3]}" height="${o[4]}" rx="${o[5] ?? 2}" fill="var(--prop)"/>`);
    else if (o[0] === "l") props.push(html`<line x1="${o[1]}" y1="${o[2]}" x2="${o[3]}" y2="${o[4]}" stroke="var(--prop)" stroke-width="${o[5] ?? 3}" stroke-linecap="round"/>`);
    else props.push(html`<circle cx="${o[1]}" cy="${o[2]}" r="${o[3]}" fill="var(--prop)"/>`);
  }
  const cuerda = d.cable?.[2] === "cuerda" ? html`<line data-k="cuerda1" stroke="var(--prop)" stroke-width="2" stroke-linecap="round"/><line data-k="cuerda2" stroke="var(--prop)" stroke-width="2" stroke-linecap="round"/>` : "";
  const cable = d.cable ? html`${cuerda}<line data-k="cable" stroke="var(--app-muted)" stroke-width="1.2"/><circle cx="${d.cable[0]}" cy="${d.cable[1]}" r="3.5" fill="none" stroke="var(--app-muted)" stroke-width="1.5"/>` : "";
  // A barbell's plate goes behind the body, so the lifter stays visible; other weights are held in front.
  const pesoEls = (d.peso || []).map(([tipo], i) => [tipo, html`<g data-k="${`peso${i}`}" class="peso">${tipo === "kb"
    ? html`<circle cy="-6.5" r="3.6" fill="none" stroke="var(--peso)" stroke-width="2"/><circle r="6.5" fill="var(--peso)"/>`
    : tipo === "barra"
      ? html`<circle r="13" fill="var(--prop)" stroke="var(--peso)" stroke-width="2"/><circle r="2.5" fill="var(--peso)"/>`
      : tipo === "placa"
        ? html`<rect x="-15" y="-2.5" width="30" height="5" rx="2" fill="var(--peso)"/>`
        : tipo === "rodillo"
          ? html`<circle r="4" fill="var(--prop)" stroke="var(--peso)" stroke-width="1.5"/>`
          : html`<circle r="4.5" fill="var(--peso)"/><circle r="1.6" fill="var(--prop)"/>`}</g>`]);
  const detras = pesoEls.filter(([t]) => t === "barra").map(([, e]) => e), delante = pesoEls.filter(([t]) => t !== "barra").map(([, e]) => e);
  const towel = d.toalla || d.toalla2 ? html`<line data-k="towel" stroke="var(--prop)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${d.toalla ? "4 3" : "none"}"/>` : "";
  const vista = d.vista === "arriba" ? html`<text x="194" y="12" text-anchor="end" class="fig-nota">Vista desde arriba</text>` : d.vista ? html`<text x="194" y="12" text-anchor="end" class="fig-nota">De frente</text>` : "";
  const parts = [];
  for (const [k] of SEGS) {
    parts.push(segs.shift());
    for (const [j, h] of d.hl.entries()) if (SOBRE[h] === k) parts.push(hl[j]); // eslint-disable-line security/detect-object-injection
    if (k === "neck") parts.push(html`<circle data-k="head" r="7" fill="${COL.head}"/>`);
  }
  const rest = hl.filter((_, j) => !SOBRE[d.hl[j]]); // eslint-disable-line security/detect-object-injection
  // Tall movements (arms overhead, hanging from a bar) are drawn smaller so they fit.
  const esc = d.escala ? `translate(100 ${FLOOR}) scale(${d.escala}) translate(-100 -${FLOOR})` : null;
  const el = html`<svg class="fig ${clase}" viewBox="0 0 200 150" data-fig="${id}" aria-hidden="true"><g transform="${esc}">${props}${cable}${detras}${parts}${rest}${delante}${towel}</g>${vista}</svg>`;
  return el;
}

/* ---------- Drawing a frame ---------- */
function split(H, C, S) {
  const a = [(H[0] + C[0]) / 2, (H[1] + C[1]) / 2], b = [(C[0] + S[0]) / 2, (C[1] + S[1]) / 2], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return [`M${H[0]} ${H[1]}Q${a[0]} ${a[1]} ${m[0]} ${m[1]}`, `M${m[0]} ${m[1]}Q${b[0]} ${b[1]} ${S[0]} ${S[1]}`];
}
/** Where a rope held in both hands meets the cable: 8 units from between the hands towards the pulley. */
export function nudo(mid, polea, len = 8) {
  const dx = polea[0] - mid[0], dy = polea[1] - mid[1], d = Math.hypot(dx, dy), f = d < 1e-6 ? 0 : Math.min(len, d / 2) / d;
  return [mid[0] + dx * f, mid[1] + dy * f];
}
const seg = (el, p, q) => { el.setAttribute("x1", p[0].toFixed(1)); el.setAttribute("y1", p[1].toFixed(1)); el.setAttribute("x2", q[0].toFixed(1)); el.setAttribute("y2", q[1].toFixed(1)); };

/** The pose of figure id at progress p and time t: its definition, joint positions (2D, SVG units) and weights.
 * The SVG draws it; figura3d.js turns it into the 3D mannequin's pose. */
export function estado(id, p, t = 0) {
  const d = def(id);
  if (!d) return null;
  let pose, y, brillo = p;
  if (d._fr) {
    // Keyframes: p runs once round the loop.
    const n = d._fr.length, x = (((p % 1) + 1) % 1) * n, i = Math.floor(x), k = (i + 1) % n, f = ease(x - i);
    pose = mix(d._fr[i], d._fr[k], f); // eslint-disable-line security/detect-object-injection -- i, k are frame indexes
    y = lerp(d._fy[i], d._fy[k], f); // eslint-disable-line security/detect-object-injection
    brillo = 1;
  } else {
    pose = mix(d._a, d._b, p);
    y = lerp(d._ya, d._yb, p);
  }
  if (!d.fuerza) pose.tr += Math.sin((t * 2 * Math.PI) / 5) * 1.2 * p;
  const j = colocar(d, pose, y);
  return { d, j, pose, brillo, pesos: pesos(d, j), FLOOR };
}

/** Draws the figure in svg at progress p (0 = start pose, 1 = stretch), with t seconds for breathing. */
export function dibujar(svg, p, t = 0) {
  const e = estado(svg.dataset.fig, p, t);
  if (!e) return;
  const { d, j, brillo } = e;
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
  for (const [i, w] of pesos(d, j).entries()) E[`peso${i}`].setAttribute("transform", `translate(${w.c[0].toFixed(1)} ${w.c[1].toFixed(1)}) rotate(${w.rot.toFixed(0)})`);
  if (E.cable) {
    const mid = [(j.W1[0] + j.W2[0]) / 2, (j.W1[1] + j.W2[1]) / 2];
    if (E.cuerda1) {
      const k = nudo(mid, d.cable);
      seg(E.cuerda1, j.W1, k); seg(E.cuerda2, j.W2, k); seg(E.cable, k, d.cable);
    } else seg(E.cable, d.cable[2] === "manos" ? mid : j.W1, d.cable);
  }
  const glow = (0.3 + 0.7 * brillo).toFixed(2);
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
  if (d.fr) return (t / d.T) % 1;
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

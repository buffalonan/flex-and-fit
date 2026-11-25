// The 3D mannequin (Three.js, vendored in vendor/): one figure in sports clothes that does every exercise.
// Poses come from figura.js: estado() gives the 2D side (or front) view joints of the SVG figure, and posar() turns
// them into 3D with two-bone IK for arms and legs, so props, weights and contacts line up with the 2D design.
// A few movements that don't live in one plane (halo, lumbar twist, 90/90) have their own 3D poses (ESPECIAL).
// One WebGL canvas is shared: montar() moves it into whichever sheet is open (exercise sheet, player, set logger);
// the sheet it leaves gets the SVG figure back. Without WebGL, montar() returns false and the caller keeps the SVG.
import * as THREE from "./vendor/three.module.min.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";
import { estado, bucle, figura, animar } from "./figura.js";
import { html } from "./html.js";

const D2R = Math.PI / 180;
const K = 0.0147; // metres per SVG unit: the 2D figure's limbs are the 3D figure's limbs at this scale
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ---------- Geometry ---------- */
// Loft: rings [y, rx, rzF, rzB, cz, cx] stitched into one smooth tube. Front (+z) and back (-z) depths differ and
// blend round the sides without a crease, so muscle shape (chest, calf, quads) is part of the surface.
function loft(rings, seg = 40) {
  const pos = [], idx = [];
  for (const [y, rx, rzF, rzB = rzF, cz = 0, cx = 0] of rings)
    for (let j = 0; j < seg; j++) {
      const t = (j / seg) * Math.PI * 2, s = Math.sin(t);
      pos.push(cx + rx * Math.cos(t), y, cz + s * (rzB + ((rzF - rzB) * (1 + s)) / 2));
    }
  for (let i = 0; i < rings.length - 1; i++) {
    const up = rings[i + 1][0] > rings[i][0]; // eslint-disable-line security/detect-object-injection -- ring index
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
      if (up) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function caps(r) {
  const n = 7;
  const end = (ring, away) => {
    const [y, rx, rzF, rzB = rzF, cz = 0, cx = 0] = ring, rr = (rx + (rzF + rzB) / 2) / 2, res = [];
    for (let k = 1; k <= n; k++) { const a = ((k / n) * Math.PI) / 2, c = Math.cos(a); res.push([y + away * rr * Math.sin(a) * 0.9, rx * c, rzF * c, rzB * c, cz, cx]); }
    return res;
  };
  const s0 = Math.sign(r[0][0] - r[1][0]), s1 = Math.sign(r[r.length - 1][0] - r[r.length - 2][0]);
  return [...end(r[0], s0).reverse(), ...r, ...end(r[r.length - 1], s1)];
}
// Key rings resampled with Catmull-Rom, so outlines have no kinks.
function perfil(keys, n = 24) {
  const out = [], m = keys.length - 1;
  for (let k = 0; k <= n; k++) {
    const u = (k / n) * m, i = Math.min(m - 1, Math.floor(u)), f = u - i;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(m, i + 2)]; // eslint-disable-line security/detect-object-injection
    out.push(p1.map((_, c) => {
      const a = p0[c] ?? 0, b = p1[c] ?? 0, cc = p2[c] ?? 0, d = p3[c] ?? 0; // eslint-disable-line security/detect-object-injection
      return 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
    }));
  }
  return out;
}
const limb = (L, keys) => loft(caps(perfil(keys.map(([t, ...r]) => [-t * L, ...r]))));
const tronco = (keys) => loft(caps(perfil(keys)));
const tubo = (rings, cap = false) => loft(cap ? [...caps(rings).slice(0, 7), ...rings] : rings);
const SPH = new THREE.SphereGeometry(1, 32, 20);

/* ---------- Materials: worked muscles painted onto skin and clothes ---------- */
// Each zone is an ellipsoid fixed to a bone; the shader fades its colour into the surface (skin or shirt).
const MAXZ = 12;
const U = { uZM: { value: Array.from({ length: MAXZ }, () => new THREE.Matrix4()) }, uZC: { value: Array.from({ length: MAXZ }, () => V()) }, uZI: { value: new Array(MAXZ).fill(0) } };
const pintar = (sh) => {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
    .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vWP;
uniform mat4 uZM[${MAXZ}]; uniform vec3 uZC[${MAXZ}]; uniform float uZI[${MAXZ}];
vec4 zonas() {
  vec3 c = vec3(0.0); float wsum = 0.0, wmax = 0.0;
  for (int i = 0; i < ${MAXZ}; i++) {
    if (uZI[i] <= 0.0) continue;
    float d = length((uZM[i] * vec4(vWP, 1.0)).xyz);
    float w = (1.0 - smoothstep(0.1, 1.0, d)) * uZI[i];
    c += uZC[i] * w; wsum += w; wmax = max(wmax, w);
  }
  return vec4(wsum > 0.0 ? c / wsum : c, wmax);
}`).replace("#include <color_fragment>", "#include <color_fragment>\nvec4 zz = zonas();\ndiffuseColor.rgb = mix(diffuseColor.rgb, zz.rgb, zz.a * 0.95);")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += zz.rgb * zz.a * 0.3;");
};
const skin = new THREE.MeshPhysicalMaterial({ color: 0x9aa1ab, roughness: 0.52, clearcoat: 0.15, clearcoatRoughness: 0.7, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xdfe6ef) });
skin.onBeforeCompile = pintar;
const tela = (c) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }); m.onBeforeCompile = pintar; return m; };
const shirt = tela(0xb8302a), shorts = tela(0xeef0f2);
const std = (color, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const shoe = std(0xf3f4f6), sole = std(0xffffff, 0.8), lace = std(0xb4bac2, 0.7);
const iron = std(0x2a2d33, 0.38, 0.7), steel = std(0xb9bec6, 0.3, 0.85), plate = std(0x1d1f23, 0.6, 0.3);
const propMat = std(0x4a5160, 0.7), padMat = std(0x1c1e22, 0.8), towelMat = std(0xd9d4c7, 0.95), matMat = std(0x1d4f4d, 0.9), wallMat = new THREE.MeshStandardMaterial({ color: 0x3a404b, roughness: 0.95, transparent: true, opacity: 0.45, depthWrite: false }), cableMat = std(0x8b909a, 0.5);

function mesh(geo, m, parent, p = [0, 0, 0], s = null, r = null) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(...p);
  if (s) o.scale.set(...s);
  if (r) o.rotation.set(...r.map((v) => v * D2R));
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
const joint = (parent, p) => { const o = new THREE.Object3D(); o.position.set(...p); parent.add(o); return o; };

/* ---------- The mannequin ---------- */
// Faces +Z, up +Y, its left is +X; metres, about 1.80 m. Zones: where each muscle lights up.
const J = {}, Z = {};
function zona(parent, nombre, p, sc) { const o = new THREE.Object3D(); o.position.set(...p); o.scale.set(...sc); parent.add(o); Z[nombre] = o; } // eslint-disable-line security/detect-object-injection
function maniqui() {
  const fig = new THREE.Group();
  J.root = joint(fig, [0, 1.03, 0]);
  mesh(tronco([[-0.14, 0.15, 0.1, 0.11], [-0.08, 0.17, 0.11, 0.12], [-0.01, 0.166, 0.104, 0.11], [0.05, 0.15, 0.098, 0.1], [0.1, 0.142, 0.094, 0.095]]), skin, J.root);
  mesh(tronco([[-0.18, 0.165, 0.112, 0.13], [-0.12, 0.18, 0.12, 0.15], [-0.05, 0.178, 0.118, 0.14], [0.01, 0.17, 0.112, 0.118], [0.05, 0.158, 0.106, 0.104]]), shorts, J.root);
  mesh(tubo(perfil([[-0.075, 0.172, 0.118, 0.122], [-0.02, 0.166, 0.113, 0.118], [0.04, 0.158, 0.108, 0.11], [0.11, 0.153, 0.106, 0.105]])), shirt, J.root);
  for (const [s, n] of [[1, "L"], [-1, "R"]]) zona(J.root, "gluteos" + n, [s * 0.08, -0.08, -0.1], [0.1, 0.1, 0.08]);
  J.spine = joint(J.root, [0, 0.09, 0]);
  mesh(tronco([[-0.02, 0.142, 0.096, 0.094], [0.05, 0.144, 0.1, 0.094], [0.1, 0.148, 0.102, 0.097], [0.16, 0.156, 0.106, 0.1]]), skin, J.spine);
  mesh(tubo(perfil([[-0.04, 0.152, 0.106, 0.104], [0.05, 0.154, 0.11, 0.104], [0.11, 0.158, 0.112, 0.107], [0.18, 0.166, 0.116, 0.11]])), shirt, J.spine);
  zona(J.spine, "abdominales", [0, 0.07, 0.09], [0.12, 0.15, 0.07]);
  zona(J.spine, "lumbar", [0, 0.02, -0.09], [0.13, 0.12, 0.07]);
  for (const [s, n] of [[1, "L"], [-1, "R"]]) zona(J.spine, "oblicuos" + n, [s * 0.13, 0.06, 0.02], [0.06, 0.12, 0.1]);
  J.chest = joint(J.spine, [0, 0.15, 0]);
  mesh(tronco([[-0.03, 0.155, 0.104, 0.1], [0.05, 0.168, 0.118, 0.108], [0.12, 0.182, 0.128, 0.116], [0.18, 0.186, 0.122, 0.116], [0.225, 0.172, 0.1, 0.106], [0.26, 0.135, 0.074, 0.086], [0.29, 0.072, 0.056, 0.062]]), skin, J.chest);
  mesh(tubo(perfil([[-0.04, 0.166, 0.114, 0.11], [0.05, 0.178, 0.128, 0.118], [0.12, 0.192, 0.138, 0.126], [0.18, 0.196, 0.132, 0.126], [0.225, 0.183, 0.11, 0.116], [0.258, 0.145, 0.084, 0.096], [0.282, 0.082, 0.066, 0.072, -0.004]])), shirt, J.chest);
  zona(J.chest, "pecho", [0, 0.15, 0.1], [0.17, 0.1, 0.08]);
  zona(J.chest, "trapecio", [0, 0.25, -0.05], [0.2, 0.1, 0.1]);
  for (const [s, n] of [[1, "L"], [-1, "R"]]) zona(J.chest, "dorsales" + n, [s * 0.11, 0.1, -0.08], [0.08, 0.14, 0.07]);
  J.neck = joint(J.chest, [0, 0.28, -0.01]);
  mesh(limb(0.11, [[-0.02, 0.054, 0.054], [0.4, 0.05, 0.05], [1, 0.054, 0.054]]), skin, J.neck, [0, 0.1, 0]);
  zona(J.neck, "cuello", [0, 0.05, 0], [0.07, 0.08, 0.07]);
  J.head = joint(J.neck, [0, 0.09, 0.005]);
  // Mannequin head: one smooth egg with a soft chin, no features.
  mesh(tronco([[0.005, 0.042, 0.05, 0.046, 0.022], [0.04, 0.058, 0.075, 0.06, 0.024], [0.09, 0.073, 0.094, 0.088, 0.012], [0.13, 0.079, 0.096, 0.097, 0.008], [0.16, 0.076, 0.09, 0.093, 0.006]]), skin, J.head);
  for (const [s, n] of [[1, "L"], [-1, "R"]]) {
    const sh = (J["sh" + n] = joint(J.chest, [s * 0.188, 0.232, -0.005]));
    mesh(limb(0.29, [[0, 0.06, 0.06, 0.058], [0.14, 0.058, 0.058, 0.056], [0.3, 0.046, 0.046, 0.047], [0.5, 0.042, 0.048, 0.046], [0.75, 0.037, 0.041, 0.039], [1, 0.034, 0.034, 0.033]]), skin, sh);
    mesh(tubo([[0.0, 0.07, 0.071, 0.07], [-0.06, 0.068, 0.069, 0.067], [-0.12, 0.064, 0.066, 0.063], [-0.13, 0.064, 0.066, 0.063]], true), shirt, sh);
    zona(sh, "hombros" + n, [s * 0.015, -0.035, 0], [0.09, 0.13, 0.095]);
    zona(sh, "biceps" + n, [0, -0.15, 0.035], [0.06, 0.14, 0.055]);
    zona(sh, "triceps" + n, [0, -0.15, -0.035], [0.065, 0.15, 0.06]);
    const el = (J["el" + n] = joint(sh, [0, -0.29, 0]));
    mesh(limb(0.25, [[0, 0.035, 0.035, 0.034], [0.2, 0.042, 0.04, 0.038], [0.5, 0.034, 0.031, 0.03], [0.85, 0.027, 0.023, 0.023], [1, 0.026, 0.021, 0.021]]), skin, el);
    zona(el, "antebrazo" + n, [0, -0.08, 0], [0.055, 0.12, 0.055]);
    const wr = (J["wr" + n] = joint(el, [0, -0.25, 0]));
    mesh(SPH, skin, wr, [0, -0.045, 0], [0.022, 0.05, 0.042]);
    mesh(SPH, skin, wr, [s * -0.004, -0.1, 0.006], [0.018, 0.04, 0.038], [12, 0, 0]);
    mesh(SPH, skin, wr, [s * -0.01, -0.06, 0.04], [0.013, 0.032, 0.013], [-30, 0, 0]);
    J["mano" + n] = joint(wr, [0, -0.075, 0]);
  }
  for (const [s, n] of [[1, "L"], [-1, "R"]]) {
    const hp = (J["hip" + n] = joint(J.root, [s * 0.092, -0.08, 0]));
    mesh(limb(0.44, [[0, 0.094, 0.096, 0.098], [0.2, 0.09, 0.1, 0.095], [0.5, 0.077, 0.088, 0.08, 0.005], [0.8, 0.061, 0.066, 0.058], [1, 0.052, 0.054, 0.048]]), skin, hp);
    mesh(tubo(perfil([[0.03, 0.104, 0.104, 0.11], [-0.08, 0.101, 0.106, 0.104], [-0.19, 0.096, 0.102, 0.098]])), shorts, hp);
    zona(hp, "cuadriceps" + n, [0, -0.22, 0.05], [0.1, 0.24, 0.08]);
    zona(hp, "isquios" + n, [0, -0.25, -0.05], [0.1, 0.24, 0.085]);
    zona(hp, "aductores" + n, [-s * 0.05, -0.15, 0], [0.07, 0.2, 0.08]);
    const kn = (J["kn" + n] = joint(hp, [0, -0.44, 0]));
    mesh(limb(0.43, [[0, 0.052, 0.054, 0.05], [0.18, 0.053, 0.05, 0.072], [0.36, 0.049, 0.045, 0.064], [0.62, 0.037, 0.035, 0.038], [0.86, 0.03, 0.03, 0.03], [1, 0.03, 0.03, 0.03]]), skin, kn);
    zona(kn, "gemelos" + n, [0, -0.14, -0.045], [0.075, 0.16, 0.07]);
    zona(kn, "tibial" + n, [0, -0.15, 0.04], [0.05, 0.16, 0.05]);
    const an = (J["an" + n] = joint(kn, [0, -0.43, 0]));
    mesh(SPH, shoe, an, [0, -0.036, 0.05], [0.048, 0.054, 0.128]);
    mesh(SPH, sole, an, [0, -0.074, 0.05], [0.052, 0.016, 0.134]);
    for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.05, 0.004, 0.008), lace, an, [0, 0.008 * k, 0.09 - 0.025 * k], null, [-20 - 8 * k, 0, 0]);
    J["toe" + n] = joint(an, [0, -0.085, 0.17]);
    J["talon" + n] = joint(an, [0, -0.085, -0.07]);
    J["planta" + n] = joint(an, [0, -0.09, 0.1]);
  }
  return fig;
}
const RESET = ["spine", "chest", "neck", "head", "shL", "shR", "elL", "elR", "wrL", "wrR", "hipL", "hipR", "knL", "knR", "anL", "anR"];
const LEN = { arm: [0.29, 0.25], leg: [0.44, 0.43] };

/* ---------- Kinematics ---------- */
const qTmp = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), eul = new THREE.Euler();
const world = (o, p = V()) => o.getWorldPosition(p);
const setRot = (o, x = 0, y = 0, z = 0) => o.quaternion.setFromEuler(eul.set(x * D2R, y * D2R, z * D2R, "XYZ"));
/** Two-bone IK: the end of the chain (wrist or ankle) to target, bending toward pole; leg flips so knees face forward. */
function ik(up, lo, [a, b], target, pole, pierna = false) {
  const par = up.parent;
  par.updateWorldMatrix(true, false);
  const S = up.position.clone(), T = par.worldToLocal(target.clone()), P = par.worldToLocal(pole.clone());
  const dv = T.clone().sub(S);
  const d = THREE.MathUtils.clamp(dv.length(), Math.abs(a - b) + 0.01, (a + b) * 0.999);
  const dir = dv.lengthSq() > 1e-10 ? dv.normalize() : V(0, -1, 0);
  const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pn = P.sub(S); pn.sub(dir.clone().multiplyScalar(pn.dot(dir)));
  if (pn.lengthSq() < 1e-10) pn.set(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z)); // pole on the line: any perpendicular
  pn.normalize();
  const u = dir.clone().multiplyScalar(cosA).addScaledVector(pn, sinA);
  const z = dir.clone().multiplyScalar(sinA).addScaledVector(pn, -cosA).normalize();
  if (pierna) z.negate();
  const y = u.clone().negate(), x = V().crossVectors(y, z);
  up.quaternion.setFromRotationMatrix(mTmp.makeBasis(x, y, z));
  const cosC = THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
  lo.quaternion.setFromAxisAngle(V(1, 0, 0), (pierna ? 1 : -1) * (Math.PI - Math.acos(cosC)));
}
/** Points a foot (ankle joint) along a world direction. */
function pie(an, dirW) {
  an.parent.updateWorldMatrix(true, false);
  an.parent.getWorldQuaternion(qTmp);
  const d = dirW.clone().normalize().applyQuaternion(qTmp.invert());
  an.quaternion.setFromUnitVectors(V(0, 0, 1), d);
}

/* ---------- 2D pose to 3D ---------- */
// Side view: SVG x runs forward (+Z), y down; the near limbs (1) are the right ones. Front view: SVG x runs to the
// figure's left (+X), and limbs 1 are the left ones.
const lado2 = (d) => (d.vista ? { 1: "L", 2: "R" } : { 1: "R", 2: "L" });
// dy lifts everything (figure, weights, props): hanging exercises are drawn smaller in 2D and need a higher bar in 3D.
function mapa(d, dy = 0) {
  return d.vista
    ? (pt, z = 0) => V((pt[0] - 100) * K, (142 - pt[1]) * K + dy, z)
    : (pt, x = 0) => V(x, (142 - pt[1]) * K + dy, (pt[0] - 100) * K);
}
function posar(id, d, e, fig, dy = 0) {
  const j = e.j, m = mapa(d, dy), L = lado2(d), front = !!d.vista;
  for (const k of RESET) J[k].quaternion.identity(); // eslint-disable-line security/detect-object-injection
  fig.position.set(0, 0, 0);
  // Trunk: the pelvis carries the lower half of the curve, the chest the upper half.
  const cv = Math.atan2(2 * (e.pose.cv || 0), 38); // the curve pushes the middle of the trunk forward (+) or back
  const tr = Math.atan2(j.S[0] - j.H[0], j.H[1] - j.S[1]); // radians, 0 = up, + = forward (side) / to the left (front)
  if (front) {
    J.root.quaternion.setFromAxisAngle(V(0, 0, 1), -tr);
  } else {
    J.root.quaternion.setFromAxisAngle(V(1, 0, 0), tr + cv);
    J.spine.quaternion.setFromAxisAngle(V(1, 0, 0), -cv);
    J.chest.quaternion.setFromAxisAngle(V(1, 0, 0), -cv);
  }
  const H = m(j.H);
  J.root.position.copy(H).sub(V(0, -0.08, 0).applyQuaternion(J.root.quaternion));
  // Head
  const hd = Math.atan2(j.head[0] - j.S[0], j.S[1] - j.head[1]);
  const chestW = front ? tr : tr - cv;
  const ax = front ? V(0, 0, 1) : V(1, 0, 0), sg = front ? -1 : 1;
  J.neck.quaternion.setFromAxisAngle(ax, (sg * (hd - chestW)) / 2);
  J.head.quaternion.setFromAxisAngle(ax, (sg * (hd - chestW)) / 2);
  fig.updateMatrixWorld(true);
  // Which way elbows and knees go when the 2D limb is straight.
  const qR = J.root.getWorldQuaternion(new THREE.Quaternion());
  const atras = V(0, -0.5, -1).applyQuaternion(qR), delante = V(0, 0.5, 1).applyQuaternion(qR);
  const juntas = (d.peso || []).some(([t, en]) => en === "manos" && (t === "kb" || t === "manc"));
  const ancho = (d.peso || []).some(([t, en]) => en === "manos" && t === "barra");
  for (const i of [1, 2]) {
    const n = L[i], s = n === "L" ? 1 : -1; // eslint-disable-line security/detect-object-injection
    const W = j["W" + i], E = j["E" + i], A = j["A" + i], Kn = j["K" + i], T = j["T" + i];
    const xa = juntas ? s * 0.06 : ancho ? s * 0.24 : s * 0.19, xl = s * 0.1;
    if (front) {
      // A hand that reaches across the body goes in front of the chest, not through it.
      const dentro = THREE.MathUtils.clamp(1 - (s * (W[0] - 100) * K) / 0.14, 0, 1.6);
      ik(J["sh" + n], J["el" + n], LEN.arm, m(W, 0.04 + 0.2 * dentro), m(E, -0.04 + 0.12 * dentro).addScaledVector(atras, 0.05));
      ik(J["hip" + n], J["kn" + n], LEN.leg, m(A, 0), m(Kn, 0.05).addScaledVector(delante, 0.05), true);
    } else {
      ik(J["sh" + n], J["el" + n], LEN.arm, m(W, xa), m(E, s * 0.24).addScaledVector(atras, 0.05));
      ik(J["hip" + n], J["kn" + n], LEN.leg, m(A, xl), m(Kn, s * 0.11).addScaledVector(delante, 0.05), true);
    }
    fig.updateMatrixWorld(true);
    pie(J["an" + n], front ? V(0, 0, 1) : m(T).sub(m(A)).add(V(0, 0, 1e-4)));
  }
  fig.updateMatrixWorld(true);
}

/* ---------- Movements that need their own 3D pose ---------- */
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, t) => a + (b - a) * t;
function deSuelo(fig) { // rests the lowest sole on the floor
  fig.updateMatrixWorld(true);
  const y = Math.min(world(J.plantaL).y, world(J.plantaR).y, world(J.talonL).y, world(J.talonR).y);
  J.root.position.y -= y;
  fig.updateMatrixWorld(true);
}
const ESPECIAL = {
  // Halo: the grip goes round the head, wide enough to clear it; the handle stays left-right so the arms never cross,
  // and the bell tips from bottom-up in front to hanging behind. Elbows out round the back of the head.
  kb_halo(p, t, fig, w) {
    const phi = p * Math.PI * 2, sn = Math.sin(phi), cs = Math.cos(phi), br = Math.sin((t * 2 * Math.PI) / 4.2);
    J.root.position.set(0, 1.03, 0); J.root.quaternion.identity();
    setRot(J.hipL, -6, -6, 3); setRot(J.hipR, -6, 6, -3);
    setRot(J.knL, 12); setRot(J.knR, 12); setRot(J.anL, -6, 0, -3); setRot(J.anR, -6, 0, 3);
    setRot(J.spine, 1 + br * 0.6, -2 * sn, 1.5 * sn); setRot(J.chest, 1 - br * 0.8, -3 * sn, 1.5 * sn);
    setRot(J.neck, -2, 3 * sn, -1.5 * sn); setRot(J.head, 0, 2 * sn, -1 * sn);
    deSuelo(fig);
    const up = (1 - cs) / 2;
    const P = V(0.26 * sn, 1.3 + 0.4 * up + 0.16 * sn * sn, 0.06 + (cs > 0 ? 0.25 : 0.32) * cs + 0.06 * sn * sn).multiplyScalar(0.97);
    const al = Math.PI * up, b = V(0, Math.cos(al), -Math.sin(al));
    for (const [n, s] of [["L", 1], ["R", -1]]) {
      const tgt = P.clone().add(V(s * 0.085, 0, 0));
      const o = THREE.MathUtils.clamp((tgt.x * s) / 0.4 + 0.5, 0, 1);
      ik(J["sh" + n], J["el" + n], LEN.arm, tgt, world(J["sh" + n]).add(V(s * (0.1 + 0.2 * o), lerp(-0.6, 0.3, up), 0.9 * cs)));
      setRot(J["wr" + n], -35);
    }
    fig.updateMatrixWorld(true);
    const yk = b.clone().negate(), xk = V(1, 0, 0), zk = V().crossVectors(xk, yk);
    w.kb.quaternion.setFromRotationMatrix(mTmp.makeBasis(xk, yk, zk));
    w.kb.position.copy(P).addScaledVector(b, 0.11);
  },
  // Lumbar twist: on the back, arms out, knees bent together; the knees drop to one side, shoulders stay down.
  torsion(p, t, fig) {
    const g = ease(p) * 62;
    J.root.position.set(0, 0.125, 0); setRot(J.root, -90, g, 0);
    setRot(J.spine, 0, -g * 0.45); setRot(J.chest, 0, -g * 0.45);
    setRot(J.neck, -10, -g * 0.15); setRot(J.head, -6, 0, 0);
    setRot(J.shL, 0, 0, 92); setRot(J.shR, 0, 0, -92); setRot(J.elL, -10); setRot(J.elR, -10);
    for (const n of ["L", "R"]) { setRot(J["hip" + n], -80); setRot(J["kn" + n], 95); setRot(J["an" + n], 15); }
    fig.updateMatrixWorld(true);
    J.root.position.y += Math.max(0, 0.03 - Math.min(world(J.knL).y, world(J.knR).y)) + Math.sin(g * D2R) * 0.04;
  },
  // 90/90: sitting, hands behind on the floor, both knees bent 90° swing from one side to the other.
  nov90(p, t, fig) {
    const w = Math.cos(p * Math.PI); // knees to one side (1), through the middle, to the other (-1)
    J.root.position.set(0, 0.17, 0); setRot(J.root, -16, 0, 0);
    setRot(J.spine, 4); setRot(J.chest, 6); setRot(J.neck, 6);
    fig.updateMatrixWorld(true);
    // Feet stay on the floor, wide; each knee swings round its hip-to-ankle line (windscreen wipers).
    for (const [n, s] of [["L", 1], ["R", -1]]) {
      const hip = world(J["hip" + n]);
      ik(J["hip" + n], J["kn" + n], LEN.leg, V(s * 0.36, 0.09, 0.42), hip.add(V(w * 0.9, 0.35 * (1 - Math.abs(w)) + 0.05, 0.25)), true);
      fig.updateMatrixWorld(true);
      pie(J["an" + n], V(s * 0.3 - w * 0.5, -0.2, 0.6));
    }
    fig.updateMatrixWorld(true);
    for (const [n, s] of [["L", 1], ["R", -1]]) {
      const sh = world(J["sh" + n]);
      ik(J["sh" + n], J["el" + n], LEN.arm, V(s * 0.22, 0.04, sh.z - 0.3), sh.clone().add(V(s * 0.3, 0, -0.4)));
      setRot(J["wr" + n], 60);
    }
  },
};

/* ---------- Props and weights ---------- */
function caja(g, a, b, ancho, mat, grosor) { // a box from a to b (side view points), ancho across X
  const L = a.distanceTo(b), o = new THREE.Mesh(new THREE.BoxGeometry(ancho, grosor, Math.max(L, 0.01)), mat);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(V(0, 0, 1), b.clone().sub(a).normalize());
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}
function cilindro(g, a, b, r, mat) {
  const L = a.distanceTo(b), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(L, 0.001), 18), mat);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  o.castShadow = true;
  g.add(o);
  return o;
}
const BARRA_X = new Set(["dominadas", "piernas_colgado"]);
function props(id, d, e1, dy = 0) {
  const g = new THREE.Group(), m = mapa(d, dy), j = e1.j, L = lado2(d);
  for (const o of d.obj || []) {
    if (o[0] === "r") {
      const [, x, y, w, h] = o;
      const a = m([x, y + h / 2]), b = m([x + w, y + h / 2]);
      if (d.vista) { caja(g, V(a.x, a.y, -0.2), V(a.x, a.y, 0.2), w * K, propMat, h * K); continue; }
      if (w <= 8) for (const s of [1, -1]) { const p = m([x + w / 2, y + h / 2], s * 0.16); mesh(new THREE.BoxGeometry(0.05, h * K, w * K), propMat, g, [p.x, p.y, p.z]); }
      else caja(g, a, b, 0.34, h <= 8 ? padMat : propMat, h * K);
    } else if (o[0] === "l") {
      const [, x1, y1, x2, y2, th = 3] = o;
      if (BARRA_X.has(id)) { // a pull-up bar across, on two posts
        const c = m([j.W1[0], y1]); cilindro(g, V(-0.6, c.y, c.z), V(0.6, c.y, c.z), 0.018, steel);
        for (const s of [1, -1]) mesh(new THREE.BoxGeometry(0.06, c.y + 0.05, 0.06), propMat, g, [s * 0.62, (c.y + 0.05) / 2, c.z]);
        continue;
      }
      if (th < 6) { for (const s of [1, -1]) cilindro(g, m([x1, y1], s * 0.26), m([x2, y2], s * 0.26), 0.02, steel); continue; }
      caja(g, m([x1, y1]), m([x2, y2]), 0.34, padMat, th * K);
    } else {
      const [, cx, cy, r] = o, c = m([cx, cy]);
      cilindro(g, V(-0.18, c.y, c.z), V(0.18, c.y, c.z), r * K, padMat);
    }
  }
  if (d.pared) { const z = m(j[d.pared]).z + (d.pared === "T1" ? 9 : 4) * K + 0.05; mesh(new THREE.BoxGeometry(2.4, 2.4, 0.1), wallMat, g, [0, 1.2, z]).castShadow = false; }
  if (d.marco) { const p = m(j[d.marco], -0.27); mesh(new THREE.BoxGeometry(0.08, 2.1, 0.12), propMat, g, [p.x, 1.05, p.z + (d.marco === "E1" ? -0.02 : 0.04)]); }
  if (d.muro) mesh(new THREE.BoxGeometry(2.4, 2.4, 0.1), wallMat, g, [0, 1.2, -0.22]).castShadow = false;
  if (d.cojin === "k2") { const p = m(j.K2, L[2] === "L" ? 0.1 : -0.1); mesh(new THREE.BoxGeometry(0.3, 0.07, 0.3), propMat, g, [p.x, 0.035, p.z]); }
  if (d.cojin === "h") { const p = m(j.H); mesh(new THREE.BoxGeometry(0.4, 0.1, 0.36), propMat, g, [0, 0.05, p.z]); }
  if (d.cable) { const a = m(d.cable); const t = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 24), steel); t.position.copy(a); t.rotation.y = Math.PI / 2; g.add(t); }
  return g;
}
function pesas() {
  const w = { kb: new THREE.Group(), manc: [new THREE.Group(), new THREE.Group()], barra: new THREE.Group(), asa: new THREE.Group(), placa: new THREE.Group(), rodillo: new THREE.Group() };
  mesh(SPH, iron, w.kb, [0, 0, 0], [0.09, 0.085, 0.09]);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 28), iron, w.kb, [0, -0.08, 0]);
  mesh(new THREE.TorusGeometry(0.058, 0.011, 12, 32, Math.PI), iron, w.kb, [0, 0.1, 0]);
  for (const s of [1, -1]) mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.05, 12), iron, w.kb, [s * 0.058, 0.08, 0]);
  for (const g of w.manc) { // handle along local Z
    mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12), steel, g, [0, 0, 0], null, [90, 0, 0]);
    for (const s of [1, -1]) mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 16), iron, g, [0, 0, s * 0.1], null, [90, 0, 0]);
  }
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.9, 12), steel, w.barra, [0, 0, 0], null, [0, 0, 90]);
  for (const s of [1, -1]) mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 32), plate, w.barra, [s * 0.68, 0, 0], null, [0, 0, 90]);
  mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.5, 12), steel, w.asa, [0, 0, 0], null, [0, 0, 90]);
  mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), propMat, w.placa);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 18), padMat, w.rodillo, [0, 0, 0], null, [0, 0, 90]);
  const g = new THREE.Group();
  g.add(w.kb, ...w.manc, w.barra, w.asa, w.placa, w.rodillo);
  w.g = g;
  return w;
}
function colocarPesas(d, e, w, dy = 0) {
  for (const o of [w.kb, ...w.manc, w.barra, w.asa, w.placa, w.rodillo]) o.visible = false;
  const m = mapa(d, dy), L = lado2(d), j = e.j;
  const mano = (i) => world(J["mano" + L[i]]); // eslint-disable-line security/detect-object-injection
  let nm = 0;
  (d.peso || []).forEach(([tipo, en], i) => {
    const c2 = e.pesos[i].c; // eslint-disable-line security/detect-object-injection
    const ref2 = en === "manos" ? [(j.W1[0] + j.W2[0]) / 2, (j.W1[1] + j.W2[1]) / 2] : en === "W2" ? j.W2 : en === "S" ? null : en === "A1" ? j.A1 : j.W1;
    const ref3 = en === "manos" ? mano(1).add(mano(2)).multiplyScalar(0.5) : en === "W2" ? mano(2) : en === "A1" ? world(J["an" + L[1]]) : mano(1);
    const pos = ref2 ? ref3.clone().add(m(c2).sub(m(ref2))) : m(c2);
    if (!d.vista && en !== "manos" && ref2) pos.x = ref3.x;
    if (tipo === "kb") {
      w.kb.visible = true;
      w.kb.position.copy(pos);
      const hacia = (en === "manos" ? mano(1).add(mano(2)).multiplyScalar(0.5) : ref3).sub(pos);
      w.kb.quaternion.setFromUnitVectors(V(0, 1, 0), hacia.lengthSq() > 1e-8 ? hacia.normalize() : V(0, 1, 0));
    } else if (tipo === "manc" && en === "manos") {
      w.asa.visible = true; w.asa.position.copy(ref3);
    } else if (tipo === "manc") {
      const g = w.manc[nm++ % 2]; g.visible = true;
      g.position.copy(world(J["mano" + (en === "W2" ? L[2] : L[1])]));
      J["mano" + (en === "W2" ? L[2] : L[1])].getWorldQuaternion(g.quaternion);
    } else if (tipo === "barra") {
      w.barra.visible = true; w.barra.position.copy(pos); w.barra.position.x = 0;
    } else if (tipo === "placa") {
      w.placa.visible = true; w.placa.position.copy(pos);
      const push = world(J["an" + L[1]]).sub(world(J.hipL).add(world(J.hipR)).multiplyScalar(0.5)).normalize();
      w.placa.quaternion.setFromUnitVectors(V(0, 0, 1), push);
    } else if (tipo === "rodillo") {
      w.rodillo.visible = true; w.rodillo.position.copy(pos); w.rodillo.position.x = 0;
    }
  });
}

/* ---------- Highlights ---------- */
const PIERNA = ["cuadriceps", "isquios", "aductores", "gemelos", "tibial", "gluteos"], BRAZO = ["hombros", "biceps", "triceps", "antebrazo"];
const DOBLES = new Set([...PIERNA, ...BRAZO, "oblicuos", "dorsales"]);
/** Zones to light: the exercise's muscles, on the side(s) its 2D figure lights (th1 = near leg, ua2 = far arm...). */
function zonasDe(d, musc) {
  const L = lado2(d), hl = d.hl || [];
  const lados = (keys) => { const s = new Set(); for (const h of hl) for (const k of keys) if (h === k + "1") s.add(L[1]); else if (h === k + "2") s.add(L[2]); return s.size ? [...s] : ["L", "R"]; };
  const piernas = lados(["th", "sh"]), brazos = lados(["ua", "sho"]);
  const out = [];
  for (const [lista, tipo] of [[musc.p || [], "p"], [musc.s || [], "s"]])
    for (const m of lista) {
      if (!DOBLES.has(m)) { if (Z[m]) out.push([m, tipo]); continue; } // eslint-disable-line security/detect-object-injection
      const ls = PIERNA.includes(m) ? piernas : BRAZO.includes(m) ? brazos : ["L", "R"];
      for (const n of ls) if (Z[m + n]) out.push([m + n, tipo]);
    }
  return out.slice(0, MAXZ);
}
const COLS = { fp: new THREE.Color(0xff5a4e), fs: new THREE.Color(0xf2b33d), xp: new THREE.Color(0x3fd6cc), xs: new THREE.Color(0x2a8c86) };
function luces(zs, fuerza, k) {
  for (let i = 0; i < MAXZ; i++) {
    const z = zs[i]; // eslint-disable-line security/detect-object-injection
    U.uZI.value[i] = z ? (z[1] === "p" ? 1 : 0.6) * k : 0; // eslint-disable-line security/detect-object-injection
    if (!z) continue;
    U.uZM.value[i].copy(Z[z[0]].matrixWorld).invert(); // eslint-disable-line security/detect-object-injection
    const c = COLS[(fuerza ? "f" : "x") + z[1]]; U.uZC.value[i].set(c.r, c.g, c.b); // eslint-disable-line security/detect-object-injection
  }
}

/* ---------- Scene, camera, views ---------- */
let R = null; // { renderer, scene, cam, fig, w, pool, mat }
function iniciar() {
  if (R && !R.sinWebGL) return R;
  const canvas = document.createElement("canvas");
  canvas.className = "f3d-canvas";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  if (!renderer.getContext()) throw new Error("sin WebGL");
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x24282e, 0.55));
  const key = new THREE.DirectionalLight(0xfff1e2, 1.9);
  key.position.set(2.2, 4.5, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.01;
  Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 2.6, bottom: -1.4, near: 0.5, far: 12 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6); rim.position.set(-3, 2.5, -3.5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-2, 1, 3); scene.add(fill);
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g2 = cv.getContext("2d"), gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(60,64,72,.9)"); gr.addColorStop(0.6, "rgba(40,43,50,.5)"); gr.addColorStop(1, "rgba(30,32,38,0)");
  g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.45 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.001; sh.receiveShadow = true; scene.add(sh);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.008, 1.9), matMat);
  mat.receiveShadow = true; scene.add(mat);
  const fig = maniqui(); scene.add(fig);
  const w = pesas(); scene.add(w.g);
  const towel = new THREE.Mesh(new THREE.BufferGeometry(), towelMat); towel.castShadow = true; scene.add(towel);
  const cable = new THREE.Mesh(new THREE.BufferGeometry(), cableMat); scene.add(cable);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  R = { renderer, canvas, scene, cam, fig, w, pool, mat, towel, cable, props: null };
  return R;
}

/** Puts the figure in the pose of exercise id at progress p, time t. */
function pose(st, p, t) {
  const { fig, w } = R, d = st.d;
  const e = estado(st.id, p, t);
  if (ESPECIAL[st.id]) {  
    for (const k of RESET) J[k].quaternion.identity(); // eslint-disable-line security/detect-object-injection
    for (const o of [w.kb, ...w.manc, w.barra, w.asa, w.placa, w.rodillo]) o.visible = false;
    if (st.id === "kb_halo") w.kb.visible = true;
    ESPECIAL[st.id](p, t, fig, w);  
    fig.updateMatrixWorld(true);
  } else {
    posar(st.id, d, e, fig, st.dy);
    // 3D feet and hips are a little bigger than the 2D figure's: lift a pose that sinks into the floor.
    if (!d.sinSuelo && (!d.fijo || ["A1", "T1"].includes(d.fijo[0]))) {
      const bajo = Math.min(...["plantaL", "plantaR", "talonL", "talonR", "toeL", "toeR", "knL", "knR", "manoL", "manoR", "head"].map((k) => world(J[k]).y)); // eslint-disable-line security/detect-object-injection
      st.lift = Math.max(0, -bajo);
      if (bajo < 0) { J.root.position.y -= bajo; fig.updateMatrixWorld(true); }
    }
    colocarPesas(d, e, w, st.dy);
  }
  // Towel (round the near sole, or between the hands) and pulley cable.
  const L = lado2(d);
  R.towel.visible = !!(d.toalla || d.toalla2);
  if (R.towel.visible) {
    const a = world(J["mano" + L[1]]), b = world(J["mano" + L[2]]);
    let pts;
    if (d.toalla) {
      const n = L[1], S = world(J["planta" + n]), toe = world(J["toe" + n]), mid = S.clone().lerp(toe, 0.4), x = V(1, 0, 0);
      pts = [a, a.clone().lerp(S, 0.5).addScaledVector(x, 0.012), S.clone().addScaledVector(x, 0.05), mid.clone().addScaledVector(x, 0.02), mid.clone().addScaledVector(x, -0.02), S.clone().addScaledVector(x, -0.05), b.clone().lerp(S, 0.5).addScaledVector(x, -0.012), b];
    } else pts = [a, a.clone().lerp(b, 0.5).add(V(0, -0.03, 0)), b];
    R.towel.geometry.dispose();
    R.towel.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 6, false);
  }
  R.cable.visible = !!d.cable;
  if (d.cable) {
    const m = mapa(d, st.dy), a = m(d.cable), b = d.cable[2] === "manos" ? world(J.manoL).add(world(J.manoR)).multiplyScalar(0.5) : world(J["mano" + L[1]]);
    R.cable.geometry.dispose();
    R.cable.geometry = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, 0.004, 5, false);
  }
  luces(st.zonas, d.fuerza, d.fuerza ? 1 : 0.35 + 0.65 * (e ? e.brillo : 1));
}

// Frames the camera on the figure and its props over the whole movement.
function encuadre(st) {
  const box = new THREE.Box3();
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    pose(st, p, 0);
    for (const k of ["head", "manoL", "manoR", "toeL", "toeR", "talonL", "talonR", "knL", "knR", "root", "elL", "elR"]) box.expandByPoint(world(J[k])); // eslint-disable-line security/detect-object-injection
    box.expandByPoint(J.head.localToWorld(V(0, 0.2, 0)));
  }
  if (R.props) { const pb = new THREE.Box3().setFromObject(R.props); if (!pb.isEmpty()) box.union(pb); }
  box.expandByPoint(V(box.min.x, 0, box.min.z));
  const c = box.getCenter(V()), size = box.getSize(V());
  st.target = c;
  st.radio = Math.max(size.x, size.y, size.z) / 2 + 0.12;
}

const VISTAS = { lado: [["Lado", -90, 8], ["¾", -45, 14], ["Frente", 0, 8], ["Espalda", 180, 8], ["Arriba", -90, 72]], frente: [["Frente", 0, 8], ["¾", -40, 12], ["Lado", -90, 8], ["Espalda", 180, 8], ["Arriba", 0, 72]] };
const TUMBADO = new Set(["torsion"]);
let actual = null, corriendo = false;

/** Shows exercise id in 3D inside host (replacing its content). opts: musculos {p, s}, ctl(t) → {p, t} to drive it
 * (the player), compacto (no view buttons). Returns false if 3D can't run here, so the caller keeps the SVG. */
// Sets the scene up for exercise id: props, mat, lit muscles, height (hanging) and framing.
const DE_PIE = new Set(["sentadilla", "gemelo", "tobillo_pared", "cuad_pie", "pecho_puerta", "hombro_cruz", "angeles", "cuello", "pinza_pie", "paso_toalla"]);
function preparar(id, musculos = {}) {
  const d = estado(id, 0, 0).d;
  const st = { id, d, zonas: zonasDe(d, musculos), dy: 0 };
  if (d.sinSuelo) { // hang high enough that the feet clear the floor
    let bajo = 9;
    for (const p of [0, 0.5, 1]) { pose(st, p, 0); bajo = Math.min(bajo, ...["toeL", "toeR", "talonL", "talonR"].map((k) => world(J[k]).y)); } // eslint-disable-line security/detect-object-injection
    st.dy = Math.max(0, 0.06 - bajo);
  }
  R.scene.remove(R.props || new THREE.Object3D());
  R.props = props(id, d, estado(id, 1, 0), st.dy); R.scene.add(R.props);
  R.mat.visible = !d.fuerza && !DE_PIE.has(id);
  encuadre(st);
  R.mat.position.set(0, 0.004, st.target.z);
  R.mat.rotation.y = d.vista && !TUMBADO.has(id) ? Math.PI / 2 : 0;
  st.vistas = (ESPECIAL[id] && id !== "kb_halo") || !d.vista ? VISTAS.lado : VISTAS.frente; // eslint-disable-line security/detect-object-injection
  // The bar of a hanging exercise runs across the view from the side: start at ¾ so it shows.
  if (BARRA_X.has(id)) st.vistas = [VISTAS.lado[1], VISTAS.lado[0], ...VISTAS.lado.slice(2)];
  return st;
}

export function montar(host, id, opts = {}) {
  if (!estado(id, 0, 0)) return false;
  try { iniciar(); } catch { return false; }
  if (actual && actual.host !== host && actual.host.isConnected) devolver(actual);
  const st = Object.assign(preparar(id, opts.musculos), { host, ctl: opts.ctl, off: Math.random() * 6 });
  const vistas = st.vistas;
  st.az = st.azT = vistas[0][1]; st.el = st.elT = vistas[0][2];
  // Markup: the canvas, and the angle buttons under it.
  host.replaceChildren();
  host.classList.add("f3d");
  const caja = document.createElement("div"); caja.className = "f3d-lienzo";
  caja.append(R.canvas);
  host.append(caja);
  if (!opts.compacto) {
    const bar = document.createElement("div"); bar.className = "f3d-vistas"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Ángulo de cámara");
    vistas.forEach(([n, az, el], i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = n; b.setAttribute("aria-pressed", String(i === 0));
      b.addEventListener("click", () => { st.azT = az; st.elT = el; bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
      bar.append(b);
    });
    host.append(bar);
  }
  R.canvas.onpointerdown = (ev) => { st.drag = [ev.clientX, ev.clientY]; R.canvas.setPointerCapture?.(ev.pointerId); };
  R.canvas.onpointermove = (ev) => {
    if (!st.drag) return;
    st.azT -= (ev.clientX - st.drag[0]) * 0.4; st.elT = THREE.MathUtils.clamp(st.elT + (ev.clientY - st.drag[1]) * 0.25, -5, 80);
    st.drag = [ev.clientX, ev.clientY];
    host.querySelectorAll(".f3d-vistas button").forEach((x) => x.setAttribute("aria-pressed", "false"));
  };
  R.canvas.onpointerup = R.canvas.onpointercancel = () => (st.drag = null);
  actual = st;
  arrancar();
  return true;
}
// The sheet the canvas leaves gets its SVG figure back.
function devolver(st) {
  st.host.classList.remove("f3d");
  st.host.innerHTML = html`${figura(st.id, { clase: "grande" })}`;
  animar(st.host);
}
/** Stops drawing the figure in host (if it is there). */
export function soltar(host) {
  if (actual && (!host || actual.host === host)) { actual = null; }
}

const reduce = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function arrancar() {
  if (corriendo) return;
  corriendo = true;
  const frame = (ms) => {
    const st = actual;
    if (!st || !st.host.isConnected) { corriendo = false; actual = st && st.host.isConnected ? st : null; return; }
    if (st.host.getClientRects().length && !document.hidden) dibujar3d(st, ms / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function dibujar3d(st, t) {
  const { renderer, cam, canvas } = R;
  const box = canvas.parentElement, w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  const dt = Math.min(0.05, st.last ? t - st.last : 0); st.last = t;
  const da = ((st.azT - st.az + 540) % 360) - 180;
  st.az += da * Math.min(1, dt * 5); st.el += (st.elT - st.el) * Math.min(1, dt * 5);
  const c = st.ctl ? st.ctl(t) : { p: reduce() ? 1 : bucle(st.id, t + st.off), t };
  pose(st, c.p, c.t);
  // Distance that fits the movement's bounding sphere in both directions of the view.
  const fov = cam.fov * D2R, fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * cam.aspect));
  const dist = st.radio / Math.sin(fit / 2);
  const A = st.az * D2R, E = st.el * D2R, T = st.target;
  cam.position.set(T.x + dist * Math.sin(A) * Math.cos(E), T.y + dist * Math.sin(E), T.z + dist * Math.cos(A) * Math.cos(E));
  cam.lookAt(T);
  R.pool.position.set(T.x, 0, T.z);
  renderer.render(R.scene, cam);
}

/** For tests: poses every frame of figure id and reports problems (non-finite numbers, limbs that can't reach their
 * 2D target, the body sinking into the floor). Works without WebGL. */
export function revisar(id) {
  if (!R) {
    const fig = maniqui(), w = pesas(), scene = new THREE.Scene(); scene.add(fig, w.g);
    R = { fig, w, scene, towel: new THREE.Mesh(), cable: new THREE.Mesh(), mat: new THREE.Mesh(), props: null, sinWebGL: true };
  }
  const st = preparar(id), malos = [];
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    pose(st, p, 0);
    const pts = ["head", "manoL", "manoR", "toeL", "toeR", "talonL", "talonR", "knL", "knR", "root", "elL", "elR"].map((k) => [k, world(J[k])]); // eslint-disable-line security/detect-object-injection
    for (const [k, v] of pts) if (![v.x, v.y, v.z].every(Number.isFinite)) malos.push(`${k} NaN en p=${p}`);
    const bajo = Math.min(...pts.map(([, v]) => v.y));
    if (bajo < -0.06) malos.push(`bajo el suelo ${bajo.toFixed(2)} m en p=${p}`);
    if (!ESPECIAL[id] && !st.lift) { // eslint-disable-line security/detect-object-injection
      const e = estado(id, p, 0), m = mapa(e.d, st.dy), L = lado2(e.d);
      for (const i2 of [1, 2]) {
        const n = L[i2]; // eslint-disable-line security/detect-object-injection
        const wr = world(J["wr" + n]), tgt = m(e.j["W" + i2], e.d.vista ? 0.04 : wr.x);
        if (e.d.vista ? false : Math.hypot(wr.y - tgt.y, wr.z - tgt.z) > 0.08) malos.push(`mano ${n} lejos de su sitio (${Math.hypot(wr.y - tgt.y, wr.z - tgt.z).toFixed(2)} m) en p=${p}`);
      }
    }
  }
  return [...new Set(malos)];
}

/** For reviewing the figures: one still of figure id at progress p, as a PNG data URL (needs WebGL). */
export function foto(id, p, { w = 320, h = 320, az = null, el = 8, musculos = {} } = {}) {
  iniciar();
  const st = preparar(id, musculos);
  R.renderer.setSize(w, h, false);
  R.cam.aspect = w / h; R.cam.updateProjectionMatrix();
  pose(st, p, 0);
  const a = (az ?? st.vistas[0][1]) * D2R, E = el * D2R, T = st.target;
  const fit = Math.min(R.cam.fov * D2R, 2 * Math.atan(Math.tan((R.cam.fov * D2R) / 2) * R.cam.aspect)), dist = (st.radio / Math.sin(fit / 2)) * 0.92;
  R.cam.position.set(T.x + dist * Math.sin(a) * Math.cos(E), T.y + dist * Math.sin(E), T.z + dist * Math.cos(a) * Math.cos(E));
  R.cam.lookAt(T);
  R.renderer.render(R.scene, R.cam);
  return R.canvas.toDataURL("image/png");
}

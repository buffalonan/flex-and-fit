// The body mannequin, front and back, in the style of the Coros app (design guide): grey silhouettes,
// worked muscles coloured. Strength: primary red, secondary amber. Flexibility: teal, brighter with more minutes.
// Shapes are the left half of each figure, mirrored for the right half.
import { html } from "./html.js";

const F = {
  head: "E50,15,8.5,10.5", cuello: "M45 24 L55 24 L56 32 L44 32Z",
  pecho: "M40 34 C45 33 49 34 49.5 35 L49.5 51 C44 54 37 53 32.5 48 C33 41 35 36 40 34Z",
  hombros: "M38 33 C30 33 24 38 24 46 L31.5 47.5 C32 41 34 36 40 34Z",
  biceps: "M24 47 L31.5 48 C31 56 30 63 28 68 L22 67 C21 60 22 53 24 47Z",
  antebrazo: "M22 68 L28 69 C27 78 25 86 23 92 L18 91 C18 83 19 75 22 68Z",
  hand: "E20.5,96,3,4.8",
  abdominales: "M43.5 55 L49.3 55 L49.3 97 L43.5 97Z",
  oblicuos: "M34 54 C38 56 40 56 42.3 56 L42.3 97 C39 97 36 95 35 90 C34 78 33 64 34 54Z",
  cuadriceps: "M35 102 C40 99 46 101 49 105 L48 150 C45 156 40 156 37 150 C34 135 33 115 35 102Z",
  aductores: "M45.5 104 C47.5 103 49 104 49.5 106 L49 140 C47.5 137 46.2 131 45.6 125Z",
  tibial: "M37 158 C41 156 46 157 47 160 L46 196 C44 200 41 200 40 196 C37 185 36 170 37 158Z",
  foot: "E43,203,4.5,3",
};
const B = {
  head: "E50,15,8.5,10.5", cuello: "M45 24 L55 24 L56 30 L44 30Z",
  trapecio: "M44 26 L50 26 L50 58 L42 41 L34 34Z",
  hombros: "M36 33 C29 34 24 38 24 46 L31.5 47.5 C32 41 34 37 37 35Z",
  dorsales: "M34 37 L42 42 L49.5 60 L49.5 80 C44 79 38 73 33.5 62 C32.5 52 32.5 44 34 37Z",
  triceps: "M24 47 L31.5 48 C31 56 30 63 28 68 L22 67 C21 60 22 53 24 47Z",
  antebrazo: "M22 68 L28 69 C27 78 25 86 23 92 L18 91 C18 83 19 75 22 68Z",
  hand: "E20.5,96,3,4.8",
  lumbar: "M36 72 C41 78 46 81 49.5 82 L49.5 99 L36.5 99 C35.5 90 35.5 80 36 72Z",
  gluteos: "M35 101 L49.5 101 L49.5 122 C44 126 38 126 35 120 C34 113 34 107 35 101Z",
  isquios: "M35 124 C40 127 45 127 48.5 124 L48 151 C45 156 40 156 37 150 C35 140 34 132 35 124Z",
  gemelos: "M37 158 C42 155 46 157 47 162 L46 190 C44 196 41 196 40 192 C37 182 36 170 37 158Z",
  foot: "E43,203,4.5,3",
};
const NEUTRAL = new Set(["head", "hand", "foot"]);
// Where a label's leader line starts: [view, x, y] on the left half (front labels go left, back labels right).
const ANCLA = {
  pecho: ["F", 42, 43], biceps: ["F", 27, 57], abdominales: ["F", 46, 72], oblicuos: ["F", 38, 80], cuadriceps: ["F", 40, 125],
  aductores: ["F", 47, 118], tibial: ["F", 41, 178], hombros: ["F", 30, 40], antebrazo: ["F", 23, 80], cuello: ["F", 50, 28],
  trapecio: ["B", 44, 38], dorsales: ["B", 40, 60], triceps: ["B", 27, 57], lumbar: ["B", 43, 90], gluteos: ["B", 42, 112],
  isquios: ["B", 41, 138], gemelos: ["B", 41, 174],
};
export const NOMBRES = {
  pecho: "Pecho", hombros: "Hombros", biceps: "Bíceps", triceps: "Tríceps", antebrazo: "Antebrazo", abdominales: "Abdominales",
  oblicuos: "Oblicuos", cuadriceps: "Cuádriceps", aductores: "Aductores", tibial: "Tibial", trapecio: "Trapecio", dorsales: "Dorsales",
  lumbar: "Lumbar", gluteos: "Glúteos", isquios: "Isquios", gemelos: "Gemelos", cuello: "Cuello",
};

/** Colour of a region. modo "f": strength {p, s}; modo "x": flexibility, minutes. */
function color(m, d, modo) {
  if (modo === "f") return d.p[m] ? "var(--prim)" : d.s[m] ? "var(--sec)" : null; // eslint-disable-line security/detect-object-injection -- m is a region name
  const v = d[m]; // eslint-disable-line security/detect-object-injection -- m is a region name from F/B
  if (!v) return null;
  return v < 1 ? "var(--flex1)" : v < 3 ? "var(--flex2)" : "var(--flex3)";
}

function figura(map, d, modo, dx) {
  const half = Object.entries(map).map(([k, s]) => {
    const fill = NEUTRAL.has(k) ? "var(--body-n)" : color(k, d, modo) || (k === "cuello" ? "var(--body-n)" : "var(--body)");
    if (s[0] === "E") {
      const [cx, cy, rx, ry] = s.slice(1).split(",");
      return html`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
    }
    return html`<path d="${s}" fill="${fill}" data-m="${k}" stroke="var(--app-bg)" stroke-width=".8" stroke-linejoin="round"/>`;
  });
  return html`<g transform="translate(${dx},0)">${half}<g transform="translate(100,0) scale(-1,1)">${half}</g></g>`;
}

/**
 * The mannequin as SVG markup.
 * datos: for "f" { p: {musculo: series}, s: {...} }; for "x" { musculo: minutos }.
 * etiquetas: [{ m, t }] labels with dotted leaders, at most three per side.
 */
export function maniqui(datos, modo, { etiquetas = [], titulo = "Maniquí con los músculos trabajados" } = {}) {
  const con = etiquetas.length > 0;
  const lados = { F: [], B: [] };
  for (const e of etiquetas) {
    const a = ANCLA[e.m];
    if (a && lados[a[0]].length < 3) lados[a[0]].push({ ...e, x: a[0] === "B" ? 210 - a[1] : a[1], y: a[2] });
  }
  const lineas = [];
  for (const [v, ls] of Object.entries(lados)) {
    ls.sort((a, b) => a.y - b.y);
    let prev = -99;
    for (const l of ls) {
      const ty = Math.max(l.y, prev + 16);
      prev = ty;
      const tx = v === "F" ? -44 : 254;
      const ex = v === "F" ? -8 : 218;
      lineas.push(html`<polyline points="${l.x},${l.y} ${ex},${ty} ${tx},${ty}" fill="none" stroke="var(--app-muted)" stroke-width=".7" stroke-dasharray="1.6 1.6"/>
        <text x="${tx}" y="${ty - 3}" text-anchor="${v === "F" ? "start" : "end"}" class="man-l">${l.t}</text>`);
    }
  }
  const vb = con ? "-46 0 302 212" : "0 0 210 212";
  return html`<svg class="maniqui" viewBox="${vb}" role="img" aria-label="${titulo}">${figura(F, datos, modo, 0)}${figura(B, datos, modo, 110)}${lineas}</svg>`;
}

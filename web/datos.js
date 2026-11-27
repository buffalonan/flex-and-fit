// What the app trains: the 6-month flexibility plan (from its artifact) and Ferran's four gym workouts (from Coros).
// Muscles use the mannequin's region names (maniqui.js): p = primary, s = secondary.
/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex -- keys and doses come from the fixed data in this file */

import { t } from "./i18n.js";

/* ---------- Stretches ---------- */
export const EX = {
  resp: { n: "Respiración boca arriba", z: "Abdomen y diafragma", p: ["abdominales"], s: [], c: ["Rodillas flexionadas, pies en el suelo", "Inhala 4 s inflando la barriga, exhala 6 s", "Suelta hombros y mandíbula"] },
  gato: { n: "Gato-camello", z: "Toda la espalda", p: ["lumbar", "dorsales"], s: ["trapecio", "abdominales"], ritmo: 6, c: ["A cuatro patas: manos bajo hombros, rodillas bajo caderas", "Exhala y redondea la espalda mirando al ombligo", "Inhala y hunde la espalda mirando al frente, despacio"] },
  rodpecho: { n: "Rodillas al pecho", z: "Zona lumbar y glúteos", p: ["lumbar", "gluteos"], s: [], c: ["Boca arriba, abraza las rodillas", "Acércalas al pecho sin despegar la cabeza", "Puedes mecerte suave de lado a lado"] },
  isquio_toalla: { n: "Isquios con toalla", z: "Parte de atrás del muslo", p: ["isquios"], s: ["gemelos"], c: ["Boca arriba, toalla o cinturón en la planta del pie", "Sube la pierna hasta notar tensión; la rodilla puede ir algo doblada", "La otra pierna estirada en el suelo (o doblada si molesta la espalda)"] },
  flex_cadera: { n: "Flexor de cadera de rodillas", z: "Delante de la cadera, pierna de atrás", p: ["cuadriceps"], s: ["abdominales"], c: ["Rodilla de atrás sobre un cojín", "Aprieta el glúteo de atrás y mete un poco la pelvis", "Lleva la cadera hacia delante solo un par de cm; tronco recto"] },
  fig4: { n: "Figura 4 boca arriba", z: "Glúteo de la pierna cruzada", p: ["gluteos"], s: [], c: ["Cruza el tobillo sobre la rodilla contraria", "Tira del muslo de abajo hacia el pecho", "Si es fácil, empuja suave la rodilla cruzada hacia fuera"] },
  mariposa: { n: "Mariposa sentado", z: "Cara interna de los muslos", p: ["aductores"], s: [], c: ["Sentado, plantas de los pies juntas", "Espalda larga (siéntate sobre un cojín si te encorvas)", "Deja caer las rodillas; no las empujes con las manos"] },
  nino: { n: "Postura del niño", z: "Espalda baja y dorsales", p: ["lumbar", "dorsales"], s: ["gluteos"], c: ["De rodillas, siéntate hacia los talones", "Brazos estirados delante, frente al suelo o a un cojín", "Separa las rodillas si la barriga choca"] },
  torsion: { n: "Torsión tumbado", z: "Lateral de espalda y glúteo", p: ["lumbar", "oblicuos"], s: ["gluteos", "pecho"], c: ["Boca arriba, brazos en cruz", "Deja caer las dos rodillas juntas hacia un lado", "Mantén los dos hombros en el suelo; mira al lado contrario"] },
  gemelo: { n: "Gemelo en la pared", z: "Pantorrilla de la pierna de atrás", p: ["gemelos"], s: [], c: ["Manos en la pared, una pierna atrás bien estirada", "Talón de atrás clavado en el suelo, pie apuntando recto", "Inclínate hacia la pared hasta notar la pantorrilla"] },
  tobillo_pared: { n: "Rodilla a la pared", z: "Tobillo y pantorrilla", p: ["gemelos"], s: ["tibial"], ritmo: 4, c: ["Medio arrodillado frente a la pared", "Lleva la rodilla de delante hacia la pared sin levantar el talón", "Ida y vuelta lenta, 2 s en la pared"] },
  cuad_pie: { n: "Cuádriceps de pie", z: "Parte delantera del muslo", p: ["cuadriceps"], s: [], c: ["Apóyate en la pared y coge el tobillo por detrás", "Rodillas juntas, glúteo apretado", "Si no llegas al pie, usa una toalla"] },
  pecho_puerta: { n: "Pecho en el marco", z: "Pecho y parte delantera del hombro", p: ["pecho", "hombros"], s: ["biceps"], c: ["Antebrazo en el marco, codo a la altura del hombro", "Da un paso adelante hasta notar el pecho", "Prueba también con el codo más alto"] },
  hombro_cruz: { n: "Hombro cruzado", z: "Parte trasera del hombro", p: ["hombros"], s: ["trapecio"], c: ["Lleva un brazo recto cruzando el pecho", "Sujétalo por encima del codo con la otra mano", "Hombro bajo, lejos de la oreja"] },
  angeles: { n: "Ángeles en la pared", z: "Espalda alta y hombros", p: ["trapecio", "hombros"], s: ["pecho"], ritmo: 5, c: ["Espalda, cabeza y glúteos tocando la pared", "Brazos en forma de W, dorso de las manos hacia la pared", "Sube y baja despacio sin despegar la zona lumbar"] },
  cuello: { n: "Cuello lateral", z: "Lado del cuello y trapecio", p: ["cuello", "trapecio"], s: [], c: ["Inclina la oreja hacia el hombro", "Deja caer el hombro contrario hacia el suelo", "La mano solo pesa sobre la cabeza, no tira"] },
  esfinge: { n: "Esfinge", z: "Zona lumbar y abdomen", p: ["abdominales"], s: ["lumbar"], c: ["Boca abajo, apoyado en los antebrazos", "Codos bajo los hombros, pubis en el suelo", "Relaja glúteos y espalda; no empujes"] },
  sentadilla: { n: "Sentadilla profunda con apoyo", z: "Tobillos, caderas y espalda baja", p: ["gluteos", "aductores", "gemelos"], s: ["lumbar"], c: ["Agárrate a un marco o una mesa pesada", "Baja lo que puedas con los talones en el suelo", "Si los talones suben, ponles un libro debajo"] },
  nov90: { n: "90/90 de cadera", z: "Rotación de cadera, ambos lados", p: ["gluteos"], s: ["aductores"], c: ["Sentado: una pierna delante y otra al lado, ambas rodillas a 90°", "Manos detrás para apoyarte y espalda recta", "Gira las dos rodillas al otro lado para cambiar"] },
  paloma: { n: "Paloma con cojín", z: "Glúteo de la pierna de delante", p: ["gluteos"], s: ["cuadriceps"], c: ["Pierna de delante doblada, la de atrás estirada", "Pon un cojín bajo la cadera de delante si no llega al suelo", "Primero tronco erguido; más adelante inclínate hacia delante"] },
  pinza_pie: { n: "Pinza de pie, rodillas sueltas", z: "Isquios y espalda baja", p: ["isquios"], s: ["lumbar", "gemelos"], c: ["Pies a la anchura de las caderas, rodillas algo dobladas", "Cuelga desde la cadera, cabeza y brazos sueltos", "Sube enrollando la espalda vértebra a vértebra"] },
  estocada_rot: { n: "Zancada con giro", z: "Cadera, ingle y espalda alta", p: ["cuadriceps", "aductores"], s: ["trapecio", "oblicuos"], ritmo: 6, c: ["Zancada larga, mano del lado de dentro en el suelo", "Abre el otro brazo hacia el techo y síguelo con la vista", "3 s arriba y vuelve; pierna de atrás activa"] },
  pinza_sentado: { n: "Pinza sentado", z: "Isquios y pantorrillas", p: ["isquios"], s: ["gemelos", "lumbar"], c: ["Sentado con piernas estiradas (rodillas algo flojas vale)", "Inclínate desde la cadera con el pecho hacia los pies", "Siéntate sobre un cojín si te vas hacia atrás"] },
  aductor: { n: "Aductor arrodillado", z: "Cara interna del muslo estirado", p: ["aductores"], s: ["isquios"], c: ["Una rodilla en el suelo, la otra pierna estirada al lado", "Pie de la pierna estirada apoyado entero", "Lleva la cadera hacia atrás y vuelve, despacio"] },
  paso_toalla: { n: "Paso de hombros con toalla", z: "Hombros y pecho", p: ["hombros", "pecho"], s: ["biceps"], ritmo: 5, c: ["Toalla bien estirada, agarre muy ancho", "Sube los brazos rectos por delante y llévalos hacia atrás", "Si no pasan, abre más el agarre; cierra un poco cada semana"] },
  slr_activa: { n: "Elevación activa de pierna", z: "Isquios (y fuerza del muslo)", p: ["isquios"], s: ["cuadriceps", "abdominales"], ritmo: 6, c: ["Boca arriba, sube una pierna recta sin ayuda", "Pausa 2 s arriba y baja en 3 s", "La otra pierna se queda pegada al suelo"] },
  aguja: { n: "Enhebrar la aguja", z: "Espalda alta y hombro", p: ["trapecio", "hombros"], s: ["dorsales"], ritmo: 6, c: ["A cuatro patas, pasa un brazo por debajo del otro", "Apoya hombro y sien en el suelo", "Respira hacia la espalda alta; cambia de lado"] },
  puente: { n: "Puente de glúteo", z: "Glúteos (activa) y delante de la cadera", p: ["gluteos"], s: ["isquios", "cuadriceps"], ritmo: 5, c: ["Boca arriba, pies apoyados", "Aprieta glúteos y sube la cadera hasta alinear rodilla, cadera y hombro", "2 s arriba, baja lento"] },
  cobra: { n: "Cobra suave", z: "Abdomen y zona lumbar", p: ["abdominales"], s: ["lumbar"], c: ["Boca abajo, manos bajo los hombros", "Estira los brazos solo hasta donde la espalda esté cómoda", "Pubis en el suelo y glúteos relajados"] },
};

export const PH = [
  { n: 1, name: "Despertar", weeks: [1, 4], int: "3–4 / 10", hold: "2 × 20–30 s",
    goal: "Crear el hábito y que el cuerpo pierda el miedo a estirar. Casi todo es tumbado, sin posturas difíciles.",
    items: [["resp", "2 min"], ["gato", "2 × 8 lentas"], ["puente", "2 × 10", "Activa glúteos antes de estirar caderas"], ["rodpecho", "1 × 60 s"], ["esfinge", "1 × 45 s"], ["isquio_toalla", "1 × 60 s /lado", "Rodilla doblada todo lo que necesites"], ["fig4", "1 × 60 s /lado"], ["torsion", "1 × 60 s /lado"], ["flex_cadera", "1 × 60 s /lado"], ["mariposa", "1 × 60 s"], ["gemelo", "1 × 60 s /lado"], ["cuad_pie", "1 × 45 s /lado"], ["pecho_puerta", "1 × 60 s"], ["hombro_cruz", "1 × 45 s /lado"], ["angeles", "2 × 8"], ["cuello", "1 × 30 s /lado"], ["nino", "1 × 90 s"]],
    adv: ["Has hecho al menos 20 sesiones en el mes", "Puedes mantener cada postura respirando tranquilo", "Al día siguiente no hay agujetas ni molestias en articulaciones"] },
  { n: 2, name: "Ampliar", weeks: [5, 8], int: "4–5 / 10", hold: "2 × 30–45 s",
    goal: "Alargar los tiempos y sumar caderas, tobillos y hombros. Aparecen los primeros ejercicios de pie.",
    items: [["resp", "1 min"], ["gato", "2 × 10"], ["puente", "2 × 10", "Activa glúteos antes de estirar caderas"], ["isquio_toalla", "2 × 40 s /lado"], ["flex_cadera", "2 × 40 s /lado", "Sube el brazo del lado de atrás"], ["fig4", "2 × 40 s /lado"], ["mariposa", "2 × 40 s"], ["tobillo_pared", "2 × 10 /lado"], ["cuad_pie", "1 × 60 s /lado"], ["hombro_cruz", "1 × 60 s /lado"], ["angeles", "2 × 8"], ["cuello", "1 × 30 s /lado"], ["torsion", "1 × 45 s /lado"], ["nino", "1 × 60 s"]],
    adv: ["20 o más sesiones en el mes", "Con la toalla, la pierna sube unos 10° más que en la semana 1", "Haces los ángeles sin despegar la zona lumbar"] },
  { n: 3, name: "Integrar", weeks: [9, 13], int: "5 / 10", hold: "2–3 × 45 s",
    goal: "Introducir la técnica contrae-relaja y posturas que mueven varias zonas a la vez, como la sentadilla profunda.",
    items: [["resp", "1 min"], ["gato", "1 × 10"], ["puente", "2 × 10"], ["aguja", "2 × 6 /lado"], ["esfinge", "1 × 60 s"], ["isquio_toalla", "3 ciclos /lado", "Contrae-relaja: empuja la toalla 5 s al 20 % de fuerza, suelta, respira y gana rango. Repite 3 veces"], ["pinza_pie", "1 × 60 s"], ["flex_cadera", "2 × 45 s /lado"], ["nov90", "5 cambios + 30 s /lado"], ["sentadilla", "3 × 30 s"], ["tobillo_pared", "2 × 12 /lado"], ["pecho_puerta", "2 × 45 s", "Una con el codo a la altura del hombro y otra más alto"], ["cuello", "1 × 30 s /lado"], ["torsion", "1 × 60 s /lado"], ["nino", "1 × 60 s"]],
    adv: ["Llegas al menos 5 cm más cerca del suelo que en el primer test", "Aguantas 30 s en la sentadilla con apoyo", "Los cambios del 90/90 salen fluidos con manos atrás"] },
  { n: 4, name: "Fuerza en rango", weeks: [14, 17], int: "5–6 / 10", hold: "2 × 45 s",
    goal: "Ser fuerte en las posiciones nuevas para que el rango se quede. Se suman ejercicios activos (sin ayuda) y la paloma.",
    items: [["gato", "1 × 10"], ["estocada_rot", "2 × 5 /lado"], ["slr_activa", "2 × 8 /lado"], ["isquio_toalla", "3 ciclos /lado", "Contrae-relaja"], ["paloma", "2 × 45 s /lado"], ["aductor", "8 balanceos + 30 s /lado"], ["sentadilla", "3 × 45 s", "Talones en el suelo si puedes"], ["cuad_pie", "2 × 45 s /lado"], ["paso_toalla", "2 × 8"], ["angeles", "2 × 10"], ["torsion", "1 × 60 s /lado"], ["nino", "1 × 60 s"]],
    adv: ["La pierna activa sube al menos hasta 60°", "Paloma con el tronco erguido sin dolor en la rodilla", "Paso de toalla completo con agarre ancho"] },
  { n: 5, name: "Profundizar", weeks: [18, 22], int: "5–6 / 10", hold: "2 × 60 s",
    goal: "Mantener más tiempo y profundizar en las zonas más rígidas: isquios, caderas y hombros.",
    items: [["gato", "1 × 10"], ["estocada_rot", "2 × 5 /lado"], ["cobra", "1 × 60 s"], ["pinza_sentado", "2 × 60 s"], ["isquio_toalla", "3 ciclos /lado", "Contrae-relaja, rodilla más recta"], ["paloma", "2 × 60 s /lado", "Inclínate hacia delante"], ["nov90", "8 cambios sin manos"], ["aductor", "2 × 45 s /lado"], ["sentadilla", "3 × 60 s"], ["tobillo_pared", "2 × 12 /lado"], ["paso_toalla", "2 × 10", "Agarre un poco más estrecho"], ["pecho_puerta", "2 × 60 s"], ["torsion", "1 × 60 s /lado"]],
    adv: ["Tocas o casi tocas los tobillos en la pinza de pie", "Sentadilla de 60 s con talones abajo", "Test de rodilla a pared mejor que el del mes 3 en ambos lados"] },
  { n: 6, name: "Consolidar", weeks: [23, 26], int: "6 / 10", hold: "2 × 60–90 s",
    goal: "Unir todo en una sesión completa y dejar listo un plan de mantenimiento para después.",
    items: [["resp", "1 min"], ["gato", "1 × 10"], ["aguja", "1 × 6 /lado"], ["estocada_rot", "3 × 5 /lado"], ["slr_activa", "2 × 10 /lado"], ["pinza_pie", "2 × 60 s", "Rodillas rectas si puedes"], ["pinza_sentado", "2 × 90 s"], ["paloma", "2 × 90 s /lado"], ["nov90", "10 cambios sin manos"], ["sentadilla", "2 × 90 s"], ["aductor", "2 × 60 s /lado"], ["paso_toalla", "2 × 10"], ["angeles", "2 × 12"], ["cobra", "1 × 60 s"], ["nino", "1 × 60 s"]],
    adv: ["Test final: compara con el de la fase 1", "Mantenimiento: esta rutina 3–4 días por semana más la de domingo", "Si quieres seguir mejorando, elige 2 zonas y dales 10 min extra al día"] },
];

export const SUAVE = { n: 0, name: "Domingo suave", int: "3 / 10", goal: "Respiración y tus estiramientos favoritos, sin prisa.",
  items: [["resp", "1 min"], ["gato", "1 × 10"], ["rodpecho", "1 × 45 s"], ["isquio_toalla", "1 × 45 s /lado"], ["fig4", "1 × 45 s /lado"], ["torsion", "1 × 45 s /lado"], ["nino", "1 × 45 s"]] };

export const TESTS = [
  ["dedosSueloCm", "Dedos al suelo", "cm"], ["rodillaParedIzqCm", "Rodilla a pared izq.", "cm"], ["rodillaParedDerCm", "Rodilla a pared der.", "cm"],
  ["manosEspaldaIzqCm", "Manos a la espalda izq.", "cm"], ["manosEspaldaDerCm", "Manos a la espalda der.", "cm"],
  ["sentadillaSeg", "Sentadilla profunda", "s"], ["piernaRectaGrados", "Pierna recta tumbado", "°"],
];

/** Seconds of the pause the player puts before each step: get ready, change side, breathe between sets. */
export const PREP_SEG = 10;

/** The plan's routines as workouts: ids F1–F6 and "suave". `min` is how long the player takes, pauses included. */
export const RUTINAS_FLEX = [...PH.map((p) => ({ ...p, id: `F${p.n}` })), { ...SUAVE, id: "suave" }].map((r) => ({ ...r, min: `${duracionMin(r)} min` }));

/** Minutes the player takes for a routine: every step plus its pause before it. */
export function duracionMin(r) {
  const ps = r.items.flatMap((it, i) => pasos(it, i));
  return Math.round(ps.reduce((a, p) => a + p.seg + PREP_SEG, 0) / 60);
}

/* ---------- Turning a dose into timed steps ---------- */
// "2 × 30 s /lado" → izq 30, der 30, izq 30, der 30. Reps are timed at the exercise's pace (s per rep).
// Each step: { ex, i (item index), lado, seg, reps, texto }.
export function pasos(item, i) {
  const [ex, dosis] = item;
  const ritmo = EX[ex]?.ritmo || 5;
  const lados = /\/lado/.test(dosis) ? ["izq", "der"] : [null];
  const out = [];
  const push = (seg, texto, lado, reps = null) => out.push({ ex, i, lado, seg: Math.round(seg), reps, texto });
  let m;
  if ((m = dosis.match(/(\d+)\s*×\s*(\d+)(?:–(\d+))?\s*s\b/))) {
    for (let s = 0; s < +m[1]; s++) for (const l of lados) push(+(m[3] || m[2]), t("Serie {s} de {n}", { s: s + 1, n: m[1] }), l);
  } else if ((m = dosis.match(/(\d+)\s*min/))) {
    push(+m[1] * 60, "", null);
  } else if ((m = dosis.match(/(\d+)\s*ciclos/))) {
    for (const l of lados) push(+m[1] * 30, t("{n} ciclos: empuja 5 s, suelta y gana rango", { n: m[1] }), l);
  } else if ((m = dosis.match(/(\d+)\s*cambios/))) {
    push(+m[1] * 6, t("{n} cambios de lado, despacio", { n: m[1] }), null);
    const h = dosis.match(/\+\s*(\d+)\s*s/);
    if (h) for (const l of lados) push(+h[1], t("Quieto en la postura"), l);
  } else if ((m = dosis.match(/(\d+)\s*balanceos(?:\s*\+\s*(\d+)\s*s)?/))) {
    for (const l of lados) { push(+m[1] * 5, t("{n} balanceos lentos", { n: m[1] }), l, +m[1]); if (m[2]) push(+m[2], t("Quieto en la postura"), l); }
  } else if ((m = dosis.match(/(\d+)\s*×\s*(\d+)/))) {
    for (let s = 0; s < +m[1]; s++) for (const l of lados) push(+m[2] * ritmo, t("Serie {s} de {n}", { s: s + 1, n: m[1] }), l, +m[2]);
  } else {
    push(45, "", null);
  }
  return out;
}

/** Seconds of work in a routine, and minutes per muscle (primary full, secondary half) for the mannequin. */
export function resumenFlex(rutina) {
  let seg = 0;
  const musc = {};
  for (const [k, it] of rutina.items.entries()) {
    const s = pasos(it, k).reduce((a, p) => a + p.seg, 0);
    seg += s;
    const e = EX[it[0]];
    for (const m of e.p) musc[m] = (musc[m] || 0) + s / 60;
    for (const m of e.s) musc[m] = (musc[m] || 0) + s / 120;
  }
  return { seg, musc };
}

/* ---------- Where in the plan a date falls ---------- */
const parse = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
export function enPlan(inicio, fecha) {
  const semana = inicio ? Math.floor(Math.round((parse(fecha) - parse(inicio)) / 864e5) / 7) + 1 : 1;
  const w = Math.max(1, semana);
  const fase = PH.find((p) => w >= p.weeks[0] && w <= p.weeks[1]) || PH[5];
  const domingo = parse(fecha).getDay() === 0;
  return { semana: w, fase, domingo, test: domingo && w === fase.weeks[1], rutina: domingo ? "suave" : `F${fase.n}`, antes: semana < 1, despues: semana > 26 };
}

/* ---------- Gym workouts (Ferran's, from Coros) ---------- */
// kg null = bodyweight. seg instead of reps for timed holds. porLado: reps per arm/side. c: how to do it (optional). bloque: exercises done as a circuit, `rondas` times.
export const GYM = [
  { id: "g1", n: "Tren superior · Empuje", sub: "Pecho, hombros y tríceps", maquinas: "Barra, mancuernas, máquinas y cuerda",
    notas: ["Elevaciones laterales en polea", "Tríceps con cuerda en polea"],
    ej: [
      { n: "Press de banca", series: 5, reps: 8, kg: 40, desc: 90, p: ["pecho"], s: ["hombros", "triceps"] },
      { n: "Press inclinado", series: 3, reps: 10, kg: 24, desc: 90, p: ["pecho", "hombros"], s: ["triceps"] },
      { n: "Press de hombro sentado con mancuernas", series: 4, reps: 8, kg: 18, desc: 90, p: ["hombros"], s: ["triceps", "trapecio"] },
      { n: "Elevaciones laterales", series: 4, reps: 12, kg: 15, desc: 90, p: ["hombros"], s: ["trapecio"] },
      { n: "Fondos en paralelas", series: 3, reps: 8, kg: null, desc: 90, p: ["triceps", "pecho"], s: ["hombros"] },
      { n: "Extensión de tríceps en polea", series: 4, reps: 10, kg: 25, desc: 90, p: ["triceps"], s: [] },
    ] },
  { id: "g2", n: "Tren inferior · Cuádriceps", sub: "Cuádriceps, isquios y glúteos", maquinas: "Barra, peso corporal y máquinas",
    notas: [],
    ej: [
      { n: "Sentadilla", series: 4, reps: 8, kg: 40, desc: 120, p: ["cuadriceps"], s: ["gluteos", "aductores"] },
      { n: "Peso muerto rumano", series: 3, reps: 10, kg: 45, desc: 120, p: ["isquios"], s: ["gluteos", "lumbar"] },
      { n: "Sentadilla búlgara", series: 3, reps: 8, kg: null, desc: 120, p: ["cuadriceps"], s: ["gluteos", "aductores"] },
      { n: "Prensa inclinada", series: 3, reps: 12, kg: 67, desc: 120, p: ["cuadriceps"], s: ["gluteos"] },
      { n: "Curl femoral tumbado", series: 3, reps: 12, kg: 60, desc: 90, p: ["isquios"], s: [] },
      { n: "Elevación de talones de pie", series: 4, reps: 10, kg: null, desc: 90, p: ["gemelos", "tibial"], s: [] },
    ] },
  { id: "g3", n: "Tren superior · Tirón", sub: "Espalda y bíceps", maquinas: "Barra, máquinas y mancuernas",
    notas: ["Remo con mancuerna: a una mano, apoyado en el banco", "Curl con mancuerna: banco algo inclinado, a una mano"],
    ej: [
      { n: "Peso muerto", series: 4, reps: 5, kg: 50, desc: 120, p: ["isquios", "gluteos", "lumbar"], s: ["trapecio", "antebrazo", "cuadriceps"] },
      { n: "Dominadas", series: 4, reps: 8, kg: null, desc: 120, p: ["dorsales", "biceps"], s: ["antebrazo", "hombros"] },
      { n: "Remo con barra", series: 4, reps: 10, kg: 40, desc: 120, p: ["dorsales", "trapecio"], s: ["biceps", "lumbar"] },
      { n: "Remo con mancuerna", series: 3, reps: 10, kg: 24, desc: 90, p: ["dorsales"], s: ["biceps", "trapecio"] },
      { n: "Face pull en polea", series: 3, reps: 12, kg: 15, desc: 60, p: ["hombros", "trapecio"], s: [] },
      { n: "Curl de bíceps con mancuerna", series: 3, reps: 10, kg: 14, desc: 90, p: ["biceps"], s: ["antebrazo"] },
    ] },
  { id: "g4", n: "Tren inferior · Glúteo y core", sub: "Glúteos, isquios y core", maquinas: "Barra, máquinas, mancuernas, kettlebell y peso corporal",
    notas: ["Peso muerto: sumo o convencional"],
    ej: [
      { n: "Peso muerto", series: 4, reps: 6, kg: 50, desc: 120, p: ["isquios", "gluteos", "lumbar"], s: ["trapecio", "antebrazo", "cuadriceps"] },
      { n: "Hip thrust", series: 4, reps: 10, kg: null, desc: 90, p: ["gluteos"], s: ["isquios"] },
      { n: "Zancadas con mancuernas", series: 3, reps: 10, kg: 10, desc: 90, p: ["cuadriceps", "gluteos"], s: ["isquios", "aductores"] },
      { n: "Swing con kettlebell a dos manos", series: 3, reps: 15, kg: 10, desc: 90, p: ["gluteos", "isquios"], s: ["lumbar", "hombros"] },
      { n: "Elevación de piernas colgado", series: 3, reps: 12, kg: null, desc: 90, p: ["abdominales"], s: ["oblicuos", "antebrazo"] },
      { n: "Plancha", series: 1, seg: 80, kg: null, desc: 30, bloque: "core", p: ["abdominales"], s: ["hombros", "oblicuos"] },
      { n: "Plancha lateral", series: 1, seg: 45, kg: null, desc: 30, bloque: "core", lado: "izq", p: ["oblicuos"], s: ["hombros", "gluteos"] },
      { n: "Plancha lateral", series: 1, seg: 45, kg: null, desc: 90, bloque: "core", lado: "der", p: ["oblicuos"], s: ["hombros", "gluteos"] },
    ], bloques: { core: { rondas: 3 } } },
  { id: "kb", n: "Kettlebell · cuerpo completo", sub: "Halo, swings, press a una mano y más", maquinas: "Kettlebells (unos 8, 12 y 16 kg)",
    notas: [
      "Calienta 5 min antes y haz la primera serie de cada ejercicio con una kettlebell ligera",
      "Los ejercicios /lado son repeticiones por brazo o por lado: haz todas las de un lado y luego el otro",
      "Swings y cargada: la fuerza sale de la cadera, no de los brazos ni de la espalda. Espalda neutra siempre",
      "Progresión: cuando completes todas las series con buena técnica dos sesiones seguidas, sube a la siguiente kettlebell",
    ],
    ej: [
      { n: "Halo", series: 3, reps: 10, kg: 8, desc: 60, p: ["hombros"], s: ["trapecio", "triceps", "abdominales"],
        c: ["Sujeta la kettlebell por los cuernos, boca abajo, delante del pecho", "Pásala alrededor de la cabeza, cerca del cuello, rodeándola entera", "5 vueltas en un sentido y 5 en el otro", "Glúteos y abdomen apretados: el tronco no se mueve, solo los brazos"] },
      { n: "Peso muerto con kettlebell", series: 3, reps: 10, kg: 16, desc: 90, p: ["isquios", "gluteos"], s: ["lumbar", "antebrazo", "cuadriceps"],
        c: ["Pies a la anchura de la cadera, kettlebell entre los pies", "Lleva la cadera atrás con la espalda recta y agárrala con las dos manos", "Empuja el suelo y sube apretando glúteos, sin echarte hacia atrás arriba"] },
      { n: "Swing a dos manos", series: 4, reps: 15, kg: 12, desc: 90, p: ["gluteos", "isquios"], s: ["lumbar", "hombros", "antebrazo"],
        c: ["Kettlebell un palmo por delante de los pies; inclínate con la espalda recta y agárrala", "Pásala hacia atrás entre las piernas, cerca de la ingle, como un pase de fútbol americano", "Extiende la cadera de golpe: la kettlebell sube hasta el pecho por inercia, los brazos solo la guían", "Arriba: de pie, recto, glúteos y abdomen apretados. Deja que caiga y vuelve a cargar la cadera"] },
      { n: "Sentadilla goblet", series: 3, reps: 10, kg: 16, desc: 90, p: ["cuadriceps", "gluteos"], s: ["aductores", "abdominales"],
        c: ["Sujeta la kettlebell por los cuernos, pegada al pecho, codos abajo", "Baja entre las rodillas con el pecho alto y los talones en el suelo", "Rodillas en la dirección de los pies; sube empujando el suelo"] },
      { n: "Press de hombro a una mano", series: 3, reps: 8, porLado: true, kg: 12, desc: 90, p: ["hombros"], s: ["triceps", "trapecio", "oblicuos"],
        c: ["Kettlebell en posición de rack: apoyada en el antebrazo, muñeca recta y codo pegado al cuerpo", "Aprieta glúteos y abdomen y empuja hacia arriba hasta estirar el brazo, bíceps junto a la oreja", "Baja controlando hasta el rack, sin arquear la espalda ni inclinarte hacia un lado"] },
      { n: "Remo a una mano", series: 3, reps: 10, porLado: true, kg: 16, desc: 90, p: ["dorsales"], s: ["biceps", "trapecio"],
        c: ["Mano libre apoyada en un banco o en el muslo, espalda recta casi paralela al suelo", "Tira de la kettlebell hacia la cadera llevando el codo atrás, pegado al cuerpo", "Baja despacio sin girar el tronco"] },
      { n: "Swing a una mano", series: 3, reps: 10, porLado: true, kg: 10, desc: 90, p: ["gluteos", "isquios"], s: ["oblicuos", "antebrazo", "hombros"],
        c: ["Como el swing a dos manos, con una sola mano en el asa", "El hombro bien colocado atrás y abajo; no dejes que la kettlebell te gire el tronco", "La fuerza sale de la cadera; arriba, de pie y recto"] },
      { n: "Cargada a una mano", series: 3, reps: 6, porLado: true, kg: 10, desc: 90, p: ["gluteos", "isquios"], s: ["trapecio", "antebrazo", "abdominales"],
        c: ["Empieza como un swing a una mano, pero lleva la kettlebell cerca del cuerpo", "Al extender la cadera, mete el codo y deja que la kettlebell rote y se apoye suave en el antebrazo (rack)", "Si te golpea la muñeca o el antebrazo, acércala más al cuerpo y gira la mano antes"] },
      { n: "Molino", series: 2, reps: 5, porLado: true, kg: 8, desc: 60, p: ["oblicuos"], s: ["hombros", "isquios", "gluteos"],
        c: ["Kettlebell arriba, brazo estirado; pies girados unos 45° hacia el lado contrario", "Mira la kettlebell todo el rato y lleva la cadera hacia el lado del brazo de arriba", "Baja la otra mano por la pierna solo hasta donde llegues sin perder la espalda recta", "Si es la primera vez, hazlo sin peso"] },
      { n: "Levantamiento turco", series: 2, reps: 2, porLado: true, kg: 8, desc: 90, p: ["hombros", "abdominales"], s: ["gluteos", "triceps", "oblicuos"],
        c: ["Tumbado, kettlebell arriba con el brazo estirado y la rodilla de ese lado doblada", "Sube por pasos: al codo, a la mano, cadera arriba, pasa la pierna atrás, rodilla en el suelo y ponte de pie", "Baja por los mismos pasos al revés; el brazo siempre vertical y los ojos en la kettlebell", "Lento y controlado; aprende los pasos primero con un zapato o sin peso"] },
    ] },

  // Professional templates: only the structure (exercises, sets, reps, rest, progression), with the source.
  { id: "sl-a", n: "StrongLifts 5×5 · A", sub: "Sentadilla, banca y remo", maquinas: "Barra olímpica, discos, banco y rack",
    fuente: { n: "StrongLifts 5×5 (stronglifts.com)", url: "https://stronglifts.com/5x5/" },
    notas: [
      "Alterna A y B tres días por semana, con un día de descanso entre sesiones (A-B-A, luego B-A-B)",
      "Progresión: si completas las 5 series de 5, añade 2,5 kg la próxima vez (5 kg en peso muerto)",
      "Si fallas el mismo peso tres sesiones seguidas, baja un 10 % y vuelve a subir",
      "Descanso: 1:30 si la última serie fue fácil, 3 min si costó, 5 min si fallaste una repetición",
      "Pesos de inicio del programa: barra vacía (20 kg), remo 30 kg. Si ya entrenas, empieza con la mitad de tu peso para 5 repeticiones",
    ],
    ej: [
      { n: "Sentadilla", series: 5, reps: 5, kg: 20, desc: 180, p: ["cuadriceps", "gluteos"], s: ["aductores", "isquios", "lumbar"] },
      { n: "Press de banca", series: 5, reps: 5, kg: 20, desc: 180, p: ["pecho"], s: ["hombros", "triceps"] },
      { n: "Remo con barra", series: 5, reps: 5, kg: 30, desc: 180, p: ["dorsales", "trapecio"], s: ["biceps", "lumbar", "antebrazo"] },
    ] },
  { id: "sl-b", n: "StrongLifts 5×5 · B", sub: "Sentadilla, press militar y peso muerto", maquinas: "Barra olímpica, discos y rack",
    fuente: { n: "StrongLifts 5×5 (stronglifts.com)", url: "https://stronglifts.com/5x5/" },
    notas: [
      "Alterna A y B tres días por semana, con un día de descanso entre sesiones",
      "Progresión: si completas todas las series, añade 2,5 kg la próxima vez (5 kg en peso muerto)",
      "Si fallas el mismo peso tres sesiones seguidas, baja un 10 % y vuelve a subir",
      "Peso muerto: una sola serie de 5, porque ya cargas la espalda en la sentadilla. Empieza con 40 kg",
    ],
    ej: [
      { n: "Sentadilla", series: 5, reps: 5, kg: 20, desc: 180, p: ["cuadriceps", "gluteos"], s: ["aductores", "isquios", "lumbar"] },
      { n: "Press militar", series: 5, reps: 5, kg: 20, desc: 180, p: ["hombros"], s: ["triceps", "trapecio"] },
      { n: "Peso muerto", series: 1, reps: 5, kg: 40, desc: 180, p: ["isquios", "gluteos", "lumbar"], s: ["trapecio", "antebrazo", "cuadriceps"] },
    ] },
  { id: "acsm", n: "Cuerpo completo · principiante (ACSM)", sub: "Los grandes grupos musculares, en máquinas", maquinas: "Máquinas, polea, mancuernas y suelo",
    fuente: { n: "ACSM: Progression Models in Resistance Training for Healthy Adults (2009)", url: "https://pubmed.ncbi.nlm.nih.gov/19204579/" },
    notas: [
      "Pauta del American College of Sports Medicine para principiantes: 2–3 días por semana, cuerpo completo, 1–3 series de 8–12 repeticiones",
      "Elige un peso con el que las últimas repeticiones cuesten pero salgan con buena técnica",
      "Progresión: cuando hagas 1–2 repeticiones más de las indicadas en dos sesiones seguidas, sube el peso entre un 2 y un 10 %",
      "Descanso: 2–3 min en los ejercicios grandes (prensa, pecho, espalda), 1–2 min en el resto",
      "La pauta es del ACSM; la elección de ejercicios para cubrir cada grupo muscular es nuestra",
    ],
    ej: [
      { n: "Prensa de piernas", series: 2, reps: 10, kg: null, elige: true, desc: 120, p: ["cuadriceps", "gluteos"], s: ["isquios", "aductores"] },
      { n: "Press de pecho en máquina", series: 2, reps: 10, kg: null, elige: true, desc: 120, p: ["pecho"], s: ["hombros", "triceps"] },
      { n: "Jalón al pecho", series: 2, reps: 10, kg: null, elige: true, desc: 120, p: ["dorsales"], s: ["biceps", "antebrazo"] },
      { n: "Press de hombro con mancuernas", series: 2, reps: 10, kg: null, elige: true, desc: 90, p: ["hombros"], s: ["triceps", "trapecio"] },
      { n: "Remo sentado en polea", series: 2, reps: 10, kg: null, elige: true, desc: 120, p: ["dorsales", "trapecio"], s: ["biceps", "lumbar"] },
      { n: "Curl femoral", series: 2, reps: 10, kg: null, elige: true, desc: 90, p: ["isquios"], s: ["gemelos"] },
      { n: "Extensión de cuádriceps", series: 2, reps: 10, kg: null, elige: true, desc: 90, p: ["cuadriceps"], s: [] },
      { n: "Elevación de talones", series: 2, reps: 12, kg: null, elige: true, desc: 60, p: ["gemelos"], s: [] },
      { n: "Extensión lumbar", series: 2, reps: 12, kg: null, desc: 60, p: ["lumbar"], s: ["gluteos", "isquios"] },
      { n: "Plancha", series: 2, seg: 30, kg: null, desc: 60, p: ["abdominales"], s: ["oblicuos", "hombros"] },
    ] },
];

// The animated figure (figura.js) of each strength exercise, by its name.
export const FIG_FUERZA = {
  "Press de banca": "banca", "Press inclinado": "inclinado", "Press de hombro sentado con mancuernas": "press_hombro",
  "Press de hombro con mancuernas": "press_hombro", "Elevaciones laterales": "laterales", "Fondos en paralelas": "fondos",
  "Extensión de tríceps en polea": "triceps_polea", "Sentadilla": "sentadilla_barra", "Peso muerto rumano": "rumano",
  "Sentadilla búlgara": "bulgara", "Prensa inclinada": "prensa", "Prensa de piernas": "prensa", "Curl femoral tumbado": "curl_femoral",
  "Curl femoral": "curl_femoral", "Elevación de talones de pie": "talones", "Elevación de talones": "talones", "Peso muerto": "peso_muerto",
  "Dominadas": "dominadas", "Remo con barra": "remo_barra", "Remo con mancuerna": "remo_manc", "Face pull en polea": "face_pull",
  "Curl de bíceps con mancuerna": "curl", "Hip thrust": "hip_thrust", "Zancadas con mancuernas": "zancadas",
  "Swing con kettlebell a dos manos": "kb_swing", "Elevación de piernas colgado": "piernas_colgado", "Plancha": "plancha",
  "Plancha lateral": "plancha_lateral", "Press militar": "press_militar", "Press de pecho en máquina": "press_pecho",
  "Jalón al pecho": "jalon", "Remo sentado en polea": "remo_polea", "Extensión de cuádriceps": "ext_cuadriceps",
  "Extensión lumbar": "ext_lumbar", "Halo": "kb_halo", "Peso muerto con kettlebell": "kb_pm", "Swing a dos manos": "kb_swing",
  "Sentadilla goblet": "kb_goblet", "Press de hombro a una mano": "kb_press", "Remo a una mano": "kb_remo",
  "Swing a una mano": "kb_swing1", "Cargada a una mano": "kb_cargada", "Molino": "kb_molino", "Levantamiento turco": "kb_turco",
};

/** Total sets of a gym workout (a circuit counts once per round), and sets per muscle. */
export function resumenGym(w) {
  let series = 0;
  const p = {}, s = {};
  for (const e of w.ej) {
    const n = e.series * (e.bloque ? w.bloques[e.bloque].rondas : 1);
    series += n;
    for (const m of e.p) p[m] = (p[m] || 0) + n;
    for (const m of e.s) s[m] = (s[m] || 0) + n;
  }
  return { series, p, s };
}

/* ---------- Cardio ---------- */
// Cardio machines, logged on the fly before or after the weights of a gym session. Each one asks only for what its
// display shows; everything but the minutes is optional. Kept apart from the sets: never in the volume, the records,
// the progression or the sets per muscle. Saved on the session as `cardio: [{ tipo, momento, min, km, kmh, incl,
// nivel, kcal }]` (momento "antes" | "despues"). A new machine only needs a line here and its name in the dictionaries.
export const CAMPOS_CARDIO = {
  km: { l: "Distancia", u: "km", step: 0.01, max: 200 },
  kmh: { l: "Velocidad", u: "km/h", step: 0.1, max: 40 },
  incl: { l: "Inclinación", u: "%", step: 0.5, max: 40 },
  nivel: { l: "Nivel", u: "", step: 1, max: 40 },
  kcal: { l: "Calorías", u: "kcal", step: 1, max: 5000 },
};
export const CARDIO = [
  { id: "eliptica", n: "Elíptica", campos: ["km", "nivel", "kcal"] },
  { id: "cinta", n: "Cinta", campos: ["km", "kmh", "incl", "kcal"] },
  { id: "bici", n: "Bici estática", campos: ["km", "nivel", "kcal"] },
  { id: "remo", n: "Remo", campos: ["km", "nivel", "kcal"] },
  { id: "escaladora", n: "Escaladora", campos: ["nivel", "kcal"] },
  { id: "otro", n: "Otro cardio", campos: ["km", "kcal"] },
];

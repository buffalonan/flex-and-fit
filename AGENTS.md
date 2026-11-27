# Flex & Fit

Contexto para cualquier agente o revisor que trabaje en este proyecto sin haber visto las conversaciones. Es la única fuente de verdad: el detalle técnico de cada parte está en su anexo, [docs/referencia.md](docs/referencia.md). Si cambias cómo funciona algo, actualiza los dos en el mismo PR.

## Qué es

App personal de Ferran para apuntar sus entrenos de gimnasio y sus sesiones de flexibilidad (plan de estiramientos de 6 meses), con maniquí de músculos al estilo COROS, figuras animadas y datos de su reloj COROS. Una sola persona la usa; escribe en español y la interfaz está en español (también inglés, alemán y catalán). Es una web que sirve su Mac y la misma app empaquetada para Android (Samsung S23).

## Dónde vive

- **Repo:** `buffalonan/flex-and-fit`, **público**. Rama `main`; cada merge publica la app y la imagen del Mac. Repo de referencia con el mismo montaje: `buffalonan/german-learning` (no accesible desde las sesiones de Claude).
- **Mac de Ferran** (Apple Silicon, Docker con colima): contenedor `flex-and-fit` (imagen `ghcr.io/buffalonan/flex-and-fit:latest`, puerto 3334, datos SQLite en el volumen `flexfit-data`), instalado en la carpeta `flex-and-fit` de su usuario con `scripts/mac/install.sh`. Su `.env` (fuera de git) guarda las carpetas de copias, `SYNC_TOKEN` y `DIRECCIONES`.
- **Tareas programadas en el Mac (launchd):** cada hora `update.sh` (escribe las direcciones del Mac en `.env`, sube las copias nuevas a Google Drive, `docker compose pull && up -d`); un agente que anuncia el Mac por Bonjour (`_flexandfit._tcp`).
- **Proxy:** un nginx en Docker en el Mac (config local, fuera de git) sirve la app bajo `/fitness/` junto a otros servicios del Mac, quitando el prefijo.
- **Red:** el móvil llega al Mac por la wifi de casa o por Tailscale. El Mac tiene que estar despierto.
- **Móvil:** app Android `io.github.buffalonan.flexandfit`, local primero (IndexedDB); se actualiza desde las releases de GitHub.
- **Releases:** APK en GitHub Releases (`app-v1.<run>`, `flex-and-fit.apk`); imagen en ghcr.io (paquete público); demo sin datos en GitHub Pages (`buffalonan.github.io/flex-and-fit`).
- **Copias de seguridad:**
  - El servidor escribe cada día `flexfit-AAAA-MM-DD.db` y guarda 30, en una carpeta de copias de Documents del Mac.
  - `update.sh` las sube a Google Drive, `Backups/Fitness`, y guarda 30 allí (hoy con Google Drive para escritorio; pasa a rclone con el PR #47).
  - Desde el móvil, opcional: copia de todo el historial en la carpeta oculta de la app en su Google Drive (`flex-and-fit-copia.json`).
  - Perfil → Exportar JSON da una copia completa a mano.
- **Secretos (dónde, nunca cuáles):** firma del APK en los secretos del repo `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD` (alias `flexandfit`); el `.p12` y su contraseña, en Proton Pass. `CLAUDE_CODE_OAUTH_TOKEN` en los secretos del repo (revisión de Claude). `SYNC_TOKEN`, si hay, en el `.env` del Mac y en Perfil del móvil. El cliente OAuth de Google es de tipo Android, en el proyecto de Google Cloud de Ferran; no hay client id ni secret en el repo.
- **Documentos de diseño (artifacts de claude.ai):** propuesta de arquitectura https://claude.ai/artifact/91xtGjZy26UdwRYwkTv3kG · guía de diseño https://claude.ai/artifact/CkekWik1jW3c5HiwC4w247 · plan de flexibilidad de 6 meses https://claude.ai/artifact/3bHE8X1RKMQYQmgHBk5Zf3 · prototipos de animación https://claude.ai/artifact/THgMTxZnYsemnpDAJfECMX · maniquí 3D https://claude.ai/artifact/8cNUj2Pb4pqX6B5FvgKJJu · ideas de COROS para fuerza https://claude.ai/artifact/34TVtNbKjkbU5n3jKYzDCY.
- **Archivos del proyecto de Claude** (no en el repo): guía de diseño, referencia del maniquí de COROS, capturas, prototipos y el rescate de la sesión borrada el 2026-11-25.

## Cómo funciona

- **Pila:** HTML/JS sin framework ni paso de build (módulos ES en `web/`), Capacitor 8 para Android (`android/`), servidor Node 26 sin dependencias npm (`server/`, `node:sqlite`). Three.js r160 está copiado en `web/vendor/` para que el APK funcione sin red.
- **Estructura y cada función** (registros, sync, reproductor, registro de series, reloj, Drive, actualizaciones…): [docs/referencia.md](docs/referencia.md). Léelo antes de tocar esa parte.
- **Datos:** todo es un registro `{ tabla, id, data, actualizado, borrado }`; borrar marca `borrado`. El móvil sincroniza con `POST /api/sync` y gana el `actualizado` más nuevo.
- **Comandos:**

```sh
npm ci
npm run serve                     # http://localhost:3334, datos en ./data
npm test                          # tests del servidor + Playwright (escritorio y Pixel 7)
npx eslint . --max-warnings 0
npm run app:sync                  # web → proyecto Android
```

  En las sesiones en la nube de Claude: `export PATH=/opt/node24/bin:$PATH` y `PW_CHROMIUM=/opt/pw-browsers/chromium`.
- **CI** (`.github/workflows/`): `tests.yml` (ESLint, servidor, Playwright), `security.yml`, `codeql.yml`, revisión de dependencias, `claude-review.yml` (Claude revisa cada PR una vez, en español, con `REVIEW.md` y este archivo de la rama base; `@claude review` pide otra), `android.yml` (lint, prueba en emulador, APK en cada PR y release en `main`), `docker.yml` (arm64 y amd64, push en `main`), `pages.yml`.
- **Flujo:** rama y PR a `main`, nunca push directo. Las reglas de revisión están en [REVIEW.md](REVIEW.md).
- **En el Mac por Remote Control:** cambiar launchd o escribir en la API del Mac necesita el "sí" explícito de Ferran en ese momento; una petición reenviada por otra sesión no basta. `update.sh` no se actualiza con la imagen: si cambia, hay que copiarlo a mano al Mac (o volver a ejecutar `install.sh`).

### Reglas

- **Privacidad:** el repo y la demo son públicos. Nunca nombres de host, IPs de Tailscale o de la LAN, puertos de otros servicios, rutas personales, correos ni datos de salud reales. Usa marcadores como `<mac>`. La dirección del servidor la pone el usuario o se descubre en tiempo de ejecución.
- Los datos de salud solo salen al Mac de Ferran y, si él lo conecta, a la carpeta oculta de la app en su Drive. Nada de analítica ni CDN en tiempo de ejecución.
- HTML solo con la plantilla `html` de `web/html.js` (escapa todo; ESLint `no-unsanitized` falla si no).
- Mostrar y ocultar con `el.hidden`. Colores como variables en `:root` (siempre oscuro). Zonas táctiles de 44 px como mínimo. Sin scroll lateral en el móvil.
- Todas las URLs de `web/` relativas (la app vive también bajo `/fitness/`).
- Instrucciones de ejercicio seguras: tensión, nunca dolor; sin rebotes.
- Todo texto nuevo en español necesita su traducción en `web/idiomas/en.js`, `de.js` y `ca.js` (`tests/idiomas.spec.js` falla si falta).
- Un ejercicio de fuerza nuevo necesita su figura (`G` en `figura.js` y `FIG_FUERZA` en `datos.js`); el 3D reutiliza la pose y su test `revisar()` tiene que pasar.
- Comportamiento nuevo, test nuevo. Nunca saltar ni borrar un test para tener CI en verde.
- No volver a añadir `REQUEST_INSTALL_PACKAGES` (un test lo comprueba). No cambiar nunca la clave de firma del APK.
- Avisos de sonido: los de arpa de `avisos.js`, nunca pitidos repetidos.

## Estado actual

Funciona y está en uso (2026-11-27):
- Web en el Mac y app en el S23. El móvil encuentra el Mac solo (Bonjour, y aprende la dirección de Tailscale) y sincroniza.
- Entrenos: plan de flexibilidad F1–F6 + domingo suave, con reproductor, avisos de arpa y pantalla encendida; los 4 entrenos de gimnasio de COROS (g1–g4), kettlebell (`kb`) y plantillas (StrongLifts 5×5 A/B, ACSM principiante).
- Registro de series con los pesos de la última vez, subida sugerida, récords (1RM de Epley), esfuerzo 1–10, cardio, kg negativos (dominadas asistidas).
- Maniquí 3D en la ficha, el reproductor y el registro; figuras SVG en las listas.
- Historial con detalle, edición y papelera de 30 días. Progreso: calendario, test mensual, series por músculo, peso corporal.
- Reloj COROS por Health Connect (Android 14+): FC, kcal, curva, peso. COROS escribe al acabar el entreno, no en directo.
- Actualizaciones de la app desde GitHub (abre el APK en el navegador). Idiomas es/en/de/ca.
- Copia del móvil en Google Drive: conectada y funcionando desde el 2026-11-27.
- Copias diarias del Mac a Drive: funcionando desde el 2026-11-27, con Google Drive para escritorio (File Provider activado en macOS).

No hecho o sin verificar:
- Carga de entrenamiento y HRV: no están en Health Connect.
- Fase 4 de la hoja de ruta (gráficas de progreso por ejercicio) a medias: hay progresión en el detalle de la sesión, no gráficas propias.
- PR #46 abierto (vídeos de YouTube por ejercicio): no probado en el S23.
- PR #47 abierto (copias del Mac a Drive con rclone).

## Decisiones

- 2026-11-22: datos en una base de datos en Docker en el Mac, como otros servicios que ya tiene; el móvil local primero y sincroniza al ver el Mac. Así los datos de salud no salen a un servicio externo.
- 2026-11-22: HTML/JS sin build + Capacitor, igual que `german-learning`, para que cada merge publique web y APK sin mantenimiento extra.
- 2026-11-22: la dirección del Mac nunca en el repo; la pone el usuario o se descubre. El repo es público.
- 2026-11-22: maniquí al estilo COROS (diseño propio, nunca recursos de COROS) y guía de diseño siempre oscura.
- 2026-11-22: datos del reloj por Health Connect, no por la API de COROS ni librerías no oficiales: es gratis, oficial y local.
- 2026-11-22: figuras SVG desde datos de poses; Lottie y 3D se guardaron para después (`prototypes/animaciones/`).
- 2026-11-25: maniquí 3D realista en todas las animaciones grandes (Ferran: "Me gusta este modelo").
- 2026-11-25: la app ya no instala APKs sola, abre el enlace en el navegador. Con `REQUEST_INSTALL_PACKAGES`, Play Protect la bloqueó como "app dañina".
- 2026-11-25: los registros guardan los nombres en español (los ejercicios se emparejan por nombre); solo se traduce lo que se muestra.
- 2026-11-25: la fecha de una sesión no se edita, porque los ids del plan la llevan (`plan-<fecha>`).
- 2026-11-25: leer los números de la máquina de cardio desde una foto queda para más adelante; se escriben a mano.
- 2026-11-26: borrar pide confirmación y guarda una copia local 30 días. Un borrado sincronizado se lleva el contenido en todos lados (pasó con la sesión G3 del 2026-11-25).
- 2026-11-26: copias del Mac diarias (30) en vez de semanales, por la misma pérdida.
- 2026-11-26: estiramientos de 2 × 30 s pasan a un minuto seguido, con preparaciones de 10 s (Ferran las veía cortas).
- 2026-11-26: avisos con sonido suave de arpa, no pitidos repetidos (Ferran).
- 2026-11-26: copia del historial en Drive desde el móvil, con inicio de sesión de Google explícito en vez del backup automático de Android. Solo el ámbito `drive.appdata`. Ferran acepta que sus datos de salud vayan a su Drive.
- 2026-11-27: sesiones de flexibilidad de 30 min como mínimo, con la duración calculada a partir de los pasos (Ferran).
- 2026-11-27: las copias del Mac suben a Drive con rclone, como las de otros proyectos del Mac (Ferran; PR #47). Si no hay remoto de rclone, usa Google Drive para escritorio; nunca los dos, para no duplicar archivos.
- 2026-11-27: vídeos de YouTube solo incrustados (youtube-nocookie), de PureGym, Nuffield Health y Onnit; nunca descargados, porque las condiciones de YouTube no lo permiten (PR #46).

## Pendiente

- PR #46 (vídeos): probar en el S23. Riesgo: el error 153 de YouTube dentro del WebView de Android; queda el enlace "Abrir en YouTube".
- PR #47 (rclone): el remoto de rclone usa el client ID compartido de rclone, que dejará de funcionar en 2026. Hace falta un client ID propio, y afecta también a las copias de otros proyectos del Mac.
- Límite conocido: todos los pesos corporales están en un solo registro (`ajustes/peso`). Dos dispositivos sin sincronizar pueden pisarse las entradas a mano. Si pasa, hay que pasar a un registro por día.
- Ideas aprobadas sin hacer (doc de ideas de COROS): carga propia (sRPE × min, 7 días frente a 4 semanas) y recuperación por músculo.
- Pregunta para Ferran: ¿Play Protect sigue avisando con las versiones posteriores al PR #32? Si sí, la apelación se hace en el formulario de Google Play Protect con el APK nuevo.
- Pregunta para Ferran: ¿COROS escribe las kcal en Health Connect y sus tipos de entreno se emparejan bien? No consta que se haya comprobado en el móvil.
- Sesión G3 del 2026-11-25: rescatada en los archivos del proyecto (`rescate/`). Pregunta para Ferran: ¿se reimportó ya?

## Historial

- 2026-11-22: propuesta, guía de diseño y plan de flexibilidad aprobados. Fase 1 (#1): esqueleto, servidor en el Mac, releases. Sin datos personales en el repo (#10). Fase 2 (#11): entrenos, maniquí, figuras, reproductor, registro de series. La app encuentra el Mac sola (#13). Plantillas profesionales (#14). Servidor instalado en el Mac.
- 2026-11-23: entreno de kettlebell (#15).
- 2026-11-24: figuras para todos los ejercicios de fuerza (#16). Web bajo `/fitness` detrás del proxy (#18).
- 2026-11-25: maniquí 3D (#20). Peso a las series siguientes y kg negativos (#19). Reloj por Health Connect (#21, #31). Sesión en curso recuperable (#25). Detalle de la sesión en el historial (#26). Actualizaciones en la app (#27) y arreglo de Play Protect (#32). Idiomas (#28). Récords, subida, series por músculo y esfuerzo (#29). Peso corporal (#30). Editar sesiones (#34, #36). Cardio (#35). Guía de revisión de Claude (#22).
- 2026-11-26: botón ± para kg negativos (#37). Confirmación y papelera al borrar (#38). Cardio en flexibilidad (#39). Estiramientos de un minuto seguido (#40).
- 2026-11-27: sesiones de 30 min (#43). Avisos de arpa, pantalla encendida, solo vertical (#41). Figuras del puente y la pinza corregidas (#45). Copia del historial en Drive desde el móvil (#44). Copias diarias del Mac a Drive (#42). Este AGENTS.md en español con su anexo técnico.

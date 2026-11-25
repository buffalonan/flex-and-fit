# Animaciones de ejercicios

Decisión (2026-11-22, Ferran): la app usa la figura **SVG de la v2** en sus primeras versiones.
Lottie y Three.js 3D quedan guardados para más adelante.

- `prototipos-v2-svg-lottie-3d.html`: copia archivada de la v2 con las tres tecnologías (anatomía compartida `SEG`, poses por nivel `LEVELS`, SVG, generador de Lottie y maniquí 3D).
- Artifact publicado: https://claude.ai/artifact/THgMTxZnYsemnpDAJfECMX

Cuando exista `main` en buffalonan/flex-and-fit, copiar el archivo a `prototypes/animaciones/` y sacar a un módulo la anatomía, las poses y el render SVG.
Nota sobre Lottie: no compartas objetos (por ejemplo `tr`) entre capas. Hay que clonar el JSON antes de `loadAnimation` o no se dibuja nada.

## Maniquí 3D realista (2026-11-25)

Ferran aprobó el maniquí 3D realista (camisa roja, pantalón y zapatillas blancos, cara uniforme, diseño propio) y pidió usarlo en todas las animaciones. Está en la app como `web/figura3d.js`.

- `maniqui-3d-realista.html`: el prototipo con el halo con kettlebell y los isquios con banda, los botones de ángulo y la comparación con la figura SVG.
- Artifact publicado: https://claude.ai/artifact/8cNUj2Pb4pqX6B5FvgKJJu

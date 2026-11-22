# Flex & Fit

Registro de entrenamientos de gimnasio y sesiones de flexibilidad: una web que sirve el Mac y una app Android para el móvil. Los datos se guardan en una base de datos en el Mac (Docker), con copias semanales.

Agentes de IA y revisores: empezad por [AGENTS.md](AGENTS.md).

## Cómo funciona

- **El móvil guarda todo primero en local** (IndexedDB), así que en el gimnasio se puede apuntar sin red.
- **El Mac es la base de datos central:** un contenedor Docker con SQLite y una pequeña API (`server/`), que además sirve la web en `http://<mac>:3334`.
- **Sincronización:** la app envía lo pendiente y recibe lo nuevo cuando encuentra el Mac, en casa o por Tailscale (`http://ferrans-macbook-air:3334`). Si el Mac está dormido, lo reintenta más tarde.
- **Copias semanales** de la base de datos en `~/Documents/fitness-backups/weekly/` y en Google Drive (`Backups/Fitness`), las 12 más recientes, igual que Ghostfolio. Además, Ajustes → Exportar JSON descarga una copia completa.

## Releases

Cada merge a `main` publica:

| Qué | Dónde | Cómo llega |
| --- | --- | --- |
| App Android | [Releases](https://github.com/buffalonan/flex-and-fit/releases/latest), `flex-and-fit.apk` | Ábrelo en Chrome en el móvil, toca el APK y luego Abrir. Se instala encima de la anterior. |
| Web y API del Mac | `ghcr.io/buffalonan/flex-and-fit:latest` | El Mac la descarga sola cada hora (`scripts/mac/update.sh`). |
| Demo web sin datos | <https://buffalonan.github.io/flex-and-fit/> | GitHub Pages. Los datos se quedan en ese navegador. |

## Instalar en el Mac

Con colima (Docker) arrancado:

```sh
curl -fsSL https://raw.githubusercontent.com/buffalonan/flex-and-fit/main/scripts/mac/install.sh | sh
```

Crea `~/flex-and-fit` con `docker-compose.yml` y `.env` (carpetas de las copias y clave opcional), arranca el contenedor e instala un job de launchd que lo actualiza cada hora. Los datos viven en el volumen Docker `flexfit-data`.

En la app del móvil, Ajustes → Dirección del servidor: `http://ferrans-macbook-air:3334`. Si pones `SYNC_TOKEN` en `.env`, escribe la misma clave en Ajustes.

## Puesta en marcha del repo (una vez)

- **Firma del APK:** secretos `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD` (alias `flexandfit`). Sin ellos cada APK usa una clave de un solo uso y hay que desinstalar antes de actualizar. Para crear la clave en el Mac:

  ```sh
  openssl req -x509 -newkey rsa:2048 -nodes -days 10000 -subj "/CN=Flex and Fit" -keyout key.pem -out cert.pem
  openssl pkcs12 -export -inkey key.pem -in cert.pem -name flexandfit -out flexandfit.p12   # pide una contraseña
  base64 -i flexandfit.p12 | pbcopy
  rm key.pem cert.pem
  ```

  Guarda `flexandfit.p12` y su contraseña en un sitio seguro.
- **Imagen pública:** tras la primera publicación, en GitHub → Packages → flex-and-fit → Package settings, pon la visibilidad en *Public* para que el Mac la descargue sin login.
- **Pages:** Settings → Pages → Source: *GitHub Actions*.
- **Revisión de Claude** (opcional): secreto `CLAUDE_CODE_OAUTH_TOKEN`.

## Desarrollo

```sh
npm ci
npm run serve            # servidor + web en http://localhost:3334 (datos en ./data)
npm test                 # tests del servidor y Playwright (escritorio y móvil)
npx eslint .             # lint
npm run app:sync         # copia la web al proyecto Android (luego npx cap open android)
node scripts/build-icons.js   # regenera iconos y splash desde web/icon.svg
```

Necesita Node 24 (usa `node:sqlite`).

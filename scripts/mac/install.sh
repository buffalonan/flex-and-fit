#!/bin/sh
# Installs Flex & Fit on the Mac in Docker (colima), in ~/flex-and-fit:
#   curl -fsSL https://raw.githubusercontent.com/buffalonan/flex-and-fit/main/scripts/mac/install.sh | sh
# Safe to run again: it keeps an existing .env and only refreshes the compose file and the update job.
set -eu

DIR="$HOME/flex-and-fit"
RAW="https://raw.githubusercontent.com/buffalonan/flex-and-fit/main"
LABEL="io.github.buffalonan.flexandfit.update"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

command -v docker > /dev/null || { echo "No encuentro docker. Arranca colima (colima start) y vuelve a probar."; exit 1; }
mkdir -p "$DIR"
cd "$DIR"
curl -fsSL "$RAW/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$RAW/scripts/mac/update.sh" -o update.sh
chmod +x update.sh

if [ ! -f .env ]; then
  drive="$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive" 2> /dev/null | head -1 || true)"
  if [ -n "$drive" ]; then drive_backup="$drive/Backups/Fitness"; else drive_backup="$HOME/Documents/fitness-backups/drive-pendiente"; fi
  {
    echo "BACKUP_DIR=$HOME/Documents/fitness-backups/weekly"
    echo "DRIVE_BACKUP_DIR=$drive_backup"
    echo "SYNC_TOKEN="
  } > .env
  [ -n "$drive" ] || echo "Aviso: no encuentro Google Drive en ~/Library/CloudStorage. Cambia DRIVE_BACKUP_DIR en $DIR/.env."
fi
set -a; . ./.env; set +a
mkdir -p "$BACKUP_DIR" "$DRIVE_BACKUP_DIR"

docker compose up -d

# Hourly: pull the newest image published by GitHub Actions and restart only if it changed.
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$DIR/update.sh</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$DIR/update.log</string>
  <key>StandardErrorPath</key><string>$DIR/update.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2> /dev/null || true
launchctl load "$PLIST"

ip="$(tailscale ip -4 2> /dev/null | head -1 || true)"
echo "Listo. Abre http://localhost:3334 en el Mac."
echo "En el móvil (Ajustes de la app): http://$(scutil --get LocalHostName 2> /dev/null | tr 'A-Z' 'a-z'):3334${ip:+ o http://$ip:3334}"

#!/bin/sh
# Run hourly by launchd (see install.sh): brings Flex & Fit up to the newest image on ghcr.io.
# launchd's PATH has none of the places docker may live: Homebrew (/opt/homebrew/bin, /usr/local/bin)
# or a per-user install (~/.local/bin).
PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1
date

# The Mac's current addresses (home Wi-Fi, Tailscale) go into .env as DIRECCIONES; the server hands them to the
# app in /api/salud, so the phone learns them on its own. They stay on this Mac and the phone, never in the repo.
dirs=""
for i in en0 en1; do
  ip="$(ipconfig getifaddr "$i" 2> /dev/null || true)"
  [ -n "$ip" ] && dirs="$dirs${dirs:+,}http://$ip:3334"
done
ts="$( (tailscale ip -4 || /Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4) 2> /dev/null | head -1 || true)"
[ -n "$ts" ] && dirs="$dirs${dirs:+,}http://$ts:3334"
if [ -f .env ] && ! grep -qx "DIRECCIONES=$dirs" .env; then
  { grep -v '^DIRECCIONES=' .env; echo "DIRECCIONES=$dirs"; } > .env.nuevo && cat .env.nuevo > .env && rm -f .env.nuevo
  echo "Direcciones: $dirs"
fi

# Older installs mounted Google Drive's folder in the container, where colima can't write: move that copy to this disk.
if [ -f .env ] && grep -q '^DRIVE_BACKUP_DIR=.*/Library/CloudStorage/' .env; then
  mkdir -p "$HOME/Documents/fitness-backups/drive-pendiente"
  { grep -v '^DRIVE_BACKUP_DIR=' .env; echo "DRIVE_BACKUP_DIR=$HOME/Documents/fitness-backups/drive-pendiente"; } > .env.nuevo && cat .env.nuevo > .env && rm -f .env.nuevo
  echo "DRIVE_BACKUP_DIR pasa a ~/Documents/fitness-backups/drive-pendiente"
fi

# Google Drive: the server's daily copies (BACKUP_DIR) go to My Drive/Backups/Fitness from here, outside Docker,
# because colima can't write into Google Drive's File Provider folder. The newest 30 are kept there too.
backup_dir="$(sed -n 's/^BACKUP_DIR=//p' .env 2> /dev/null | head -1)"
drive="$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive" 2> /dev/null | head -1 || true)"
if [ -n "$backup_dir" ] && [ -d "$backup_dir" ] && [ -z "$drive" ]; then
  echo "Aviso: no encuentro Google Drive para escritorio; las copias diarias se quedan en este Mac"
fi
if [ -n "$backup_dir" ] && [ -d "$backup_dir" ] && [ -n "$drive" ]; then
  mkdir -p "$drive/Backups/Fitness"
  for f in "$backup_dir"/flexfit-????-??-??.db; do
    [ -f "$f" ] || continue
    [ -f "$drive/Backups/Fitness/$(basename "$f")" ] || { if cp "$f" "$drive/Backups/Fitness/"; then echo "Drive: $(basename "$f")"; else echo "Aviso: no he podido copiar $(basename "$f") a Google Drive"; fi; }
  done
  ls "$drive/Backups/Fitness"/flexfit-????-??-??.db 2> /dev/null | sort | awk '{ f[NR] = $0 } END { for (i = 1; i <= NR - 30; i++) print f[i] }' | while read -r f; do rm -f "$f"; done
fi

docker compose pull --quiet && docker compose up -d

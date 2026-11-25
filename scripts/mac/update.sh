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

docker compose pull --quiet && docker compose up -d

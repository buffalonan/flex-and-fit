#!/bin/sh
# Run hourly by launchd (see install.sh): brings Flex & Fit up to the newest image on ghcr.io.
# launchd's PATH has none of the places docker may live: Homebrew (/opt/homebrew/bin, /usr/local/bin)
# or a per-user install (~/.local/bin).
PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1
date
docker compose pull --quiet && docker compose up -d

#!/bin/sh
# Run hourly by launchd (see install.sh): brings Flex & Fit up to the newest image on ghcr.io.
# colima and Homebrew put docker in /opt/homebrew/bin or /usr/local/bin, which launchd doesn't have on its PATH.
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1
date
docker compose pull --quiet && docker compose up -d

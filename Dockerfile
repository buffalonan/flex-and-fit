# Flex & Fit for the Mac: the web app and the sync API in one small image, with no npm packages at run time.
# Built for Apple Silicon and Intel by .github/workflows/docker.yml and published to ghcr.io/buffalonan/flex-and-fit.
FROM node:26-alpine AS web
WORKDIR /src
ARG APP_VERSION=dev
COPY web ./web
COPY scripts/build-app-web.js ./scripts/
RUN APP_VERSION=$APP_VERSION node scripts/build-app-web.js /site --web

FROM node:26-alpine
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=3334 DATA_DIR=/data WEB_DIR=/app/web APP_VERSION=$APP_VERSION
COPY server/db.js server/backup.js server/server.js server/check-backup.js ./server/
COPY --from=web /site ./web
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
EXPOSE 3334
VOLUME ["/data"]
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:3334/api/salud > /dev/null || exit 1
CMD ["node", "server/server.js"]

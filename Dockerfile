FROM node:22-alpine

WORKDIR /app

# Backend-Dependencies installieren
COPY cecilia-chat/package.json cecilia-chat/package-lock.json ./cecilia-chat/
RUN cd cecilia-chat && npm ci --omit=dev

# Backend-Code kopieren
COPY cecilia-chat/src ./cecilia-chat/src

# Frontend-Dateien kopieren
COPY index.html styles.css placeholder-images.js ./
COPY poster.html cecilia-charakter.html xss-test.html ./
COPY img ./img

ENV NODE_ENV=production
ENV PUBLIC_DIR=/app
ENV PORT=30000

EXPOSE 30000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:30000/health || exit 1

CMD ["node", "cecilia-chat/src/server.mjs"]

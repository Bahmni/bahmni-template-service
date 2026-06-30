FROM mcr.microsoft.com/playwright:v1.61.1-noble

RUN apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock tsconfig.json ./
COPY src/ ./src/

RUN yarn install --frozen-lockfile && \
    yarn build && \
    yarn install --production && \
    yarn cache clean && \
    rm -rf src/ tsconfig.json

ENV NODE_ENV=production
ENV PORT=8080
ENV TEMPLATES_DIR=/etc/bahmni_config/print-templates

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/template-service/health || exit 1

CMD ["node", "dist/server.js"]

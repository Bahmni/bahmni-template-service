# Stage 1: Install production dependencies
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# Stage 2: Runtime with Playwright Chromium
FROM mcr.microsoft.com/playwright:v1.59.1-noble
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

ENV PORT=3000
ENV OPENMRS_URL=http://openmrs:8080
ENV MAX_CONCURRENT_PDF=2
ENV DEFAULT_LOCALE=en
ENV TEMPLATES_DIR=/etc/bahmni_config/templates
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]

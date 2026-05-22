FROM node:24-alpine

RUN apk add --no-cache curl

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT}/template-service/health || exit 1

CMD ["node", "dist/server.js"]

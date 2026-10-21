ARG WITH_PDF=false

FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock tsconfig.json ./
COPY src/ ./src/
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 yarn install --frozen-lockfile && \
    yarn build

FROM node:24-alpine AS pdf-false
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS pdf-true


FROM pdf-${WITH_PDF} AS final
WORKDIR /app
COPY package.json yarn.lock ./

ARG WITH_PDF
RUN if [ "$WITH_PDF" = "true" ]; then \
      yarn install --production; \
    else \
      yarn install --production --ignore-optional; \
    fi && yarn cache clean
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
ENV TEMPLATES_DIR=/etc/bahmni_config/print-templates

EXPOSE 8080

CMD ["node", "dist/server.js"]

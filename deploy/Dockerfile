# Собирает фронт и кладёт его в образ Caddy. Контекст сборки — корень репозитория.
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# Фронт ходит в настоящий бэкенд на том же адресе (/api).
# VITE_AI_DEMO=true оставляет у блоков ИИ плашку «Демо / в разработке» (раздел 8 спеки).
ARG VITE_AI_DEMO=true
ENV VITE_USE_MOCKS=false VITE_API_URL="" VITE_AI_DEMO=$VITE_AI_DEMO
RUN npm run build

FROM caddy:2
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/frontend

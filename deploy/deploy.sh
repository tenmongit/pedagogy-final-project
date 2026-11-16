#!/usr/bin/env bash
# Обновляет демо-сервер до свежего main. Запускается из GitHub Actions по SSH
# (ключ деплоя может выполнить только этот скрипт) или вручную на сервере.
set -euo pipefail

# Всё в функции: скрипт обновляет сам себя, bash должен прочитать его целиком до запуска.
main() {
  cd "$(dirname "$0")/.."

  # Сервер только принимает код: приводим его к origin/main. Файлы .env в git не входят и остаются.
  git fetch --quiet origin main
  git reset --quiet --hard origin/main

  # Если сборка упадёт, старые контейнеры продолжат работать.
  sudo docker compose -f docker-compose.prod.yml up -d --build
  sudo docker image prune -f >/dev/null

  for _ in $(seq 1 30); do
    if sudo docker compose -f docker-compose.prod.yml exec -T caddy \
      wget -qO- http://api:8000/api/health >/dev/null 2>&1; then
      echo "Деплой готов: $(git log -1 --format='%h %s')"
      exit 0
    fi
    sleep 2
  done
  echo "API не отвечает после обновления" >&2
  exit 1
}

main "$@"

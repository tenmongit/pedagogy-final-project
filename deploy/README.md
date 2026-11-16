# Деплой на AWS EC2 с бесплатным адресом

Итог: фронт и API на одном адресе `https://<IP-через-дефисы>.sslip.io`. Домен покупать не нужно: sslip.io превращает имя `1-2-3-4.sslip.io` в IP `1.2.3.4`, а Caddy сам получает сертификат. Фронт собирается внутри Docker, Node на сервере не нужен.

По спеке адрес должен быть готов к 17.11 12:00 и работать до конца экзамена 18.11.

## 1. Сервер (консоль AWS, один раз)

1. EC2 → Launch instance: Ubuntu 24.04, тип `t3.small` (на `t3.micro` сборке фронта может не хватить памяти), диск 10 ГБ, создать или выбрать ключ SSH.
2. Security group: открыть входящие порты 22 (лучше только со своего IP), 80 и 443 (для всех).
3. EC2 → Elastic IPs → Allocate → Associate с этим сервером. Без этого адрес сменится при перезапуске и QR перестанет работать.

## 2. Установка (на сервере)

```bash
ssh -i key.pem ubuntu@<IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit      # и зайти по SSH заново
git clone https://github.com/tenmongit/pedagogy-final-project.git izden && cd izden
cp backend/.env.example backend/.env
nano backend/.env
```

В `backend/.env` заполнить:

- `JWT_SECRET` — команда для генерации есть в файле;
- настройки ИИ (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`) — значения у Мерея, описание в `backend/README.md`;
- `AI_DAILY_LIMIT` — вход без пароля, поэтому лимит защищает ключ от любого, у кого есть ссылка.

## 3. Запуск

```bash
export SITE_ADDRESS=1-2-3-4.sslip.io        # IP сервера через дефисы
export VITE_AI_DEMO=false                   # только если ИИ настроен и отвечает по-настоящему
docker compose -f docker-compose.prod.yml up -d --build
curl https://$SITE_ADDRESS/api/health       # {"status":"ok"}
```

`VITE_AI_DEMO` управляет плашкой «Демо / в разработке» у блоков ИИ. Без переменной плашка остаётся: по спеке нельзя показывать неработающий ИИ как работающий.

Сертификат выдаётся при первом запуске за 10–30 секунд. Если не выдался, причина в логах: `docker compose -f docker-compose.prod.yml logs caddy`.

## Обновление

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Переменные `SITE_ADDRESS` и `VITE_AI_DEMO` нужно задать заново в новой сессии SSH (или записать в файл `.env` в корне репозитория на сервере).

База сохраняется между обновлениями (том `izden-data`). Если поменялась модель данных или нужно вернуть демо к исходному состоянию:

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm izden_izden-data
docker compose -f docker-compose.prod.yml up -d --build
```

## После экзамена

Удалить сервер (Terminate) и освободить Elastic IP (Release). Неиспользуемый Elastic IP продолжает списывать деньги или кредиты.

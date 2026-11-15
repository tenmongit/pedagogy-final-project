# Деплой на AWS EC2 с бесплатным адресом

Итог: фронт и API на одном адресе `https://<IP-через-дефисы>.sslip.io`. Домен покупать не нужно: sslip.io превращает имя `1-2-3-4.sslip.io` в IP `1.2.3.4`, а Caddy сам получает сертификат.

## 1. Сервер (консоль AWS, один раз)

1. EC2 → Launch instance: Ubuntu 24.04, тип `t3.micro`, диск 8–10 ГБ, создать или выбрать ключ SSH.
2. Security group: открыть входящие порты 22 (лучше только со своего IP), 80 и 443 (для всех).
3. EC2 → Elastic IPs → Allocate → Associate с этим сервером. Без этого адрес сменится при перезапуске и QR перестанет работать.

## 2. Установка (на сервере)

```bash
ssh -i key.pem ubuntu@<IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit      # и зайти по SSH заново
git clone https://github.com/tenmongit/pedagogy-final-projet.git izden && cd izden
cp backend/.env.example backend/.env
nano backend/.env    # JWT_SECRET (команда для генерации в файле), AI_API_KEY
```

## 3. Фронт

Caddy раздаёт папку `frontend/dist`. Собрать её на сервере или скопировать готовую со своего компьютера:

```bash
scp -i key.pem -r frontend/dist ubuntu@<IP>:izden/frontend/
```

Фронт должен обращаться к API по относительному пути `/api/...`, без адреса сервера. Тогда CORS не нужен.

## 4. Запуск

```bash
export SITE_ADDRESS=1-2-3-4.sslip.io        # IP сервера через дефисы
docker compose -f docker-compose.prod.yml up -d --build
curl https://$SITE_ADDRESS/api/health       # {"status":"ok"}
```

Сертификат выдаётся при первом запуске за 10–30 секунд. Если не выдался, причина в логах: `docker compose -f docker-compose.prod.yml logs caddy`.

## Обновление

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

База сохраняется между обновлениями (том `izden-data`). Сбросить демо к исходному состоянию: `docker compose -f docker-compose.prod.yml down && docker volume rm izden_izden-data`, затем запустить снова.

## После экзамена

Удалить сервер (Terminate) и освободить Elastic IP (Release). Неиспользуемый Elastic IP продолжает списывать деньги или кредиты.

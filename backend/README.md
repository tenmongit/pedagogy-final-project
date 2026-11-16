# Izden — бэкенд

FastAPI + SQLAlchemy + SQLite. Интерактивная документация всех эндпоинтов со схемами запросов и ответов: `http://localhost:8000/docs`.

## Запуск локально

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload     # http://localhost:8000
pytest                            # тесты
```

На пустой базе создаются демо-данные (одно задание и четыре пользователя):

| Роль | Email | Пароль |
|---|---|---|
| Преподаватель | `teacher@izden.kz` | `teacher123` |
| Студент | `student1@izden.kz`, `student2@izden.kz`, `student3@izden.kz` | `student123` |

## Запуск в Docker (сервер)

```bash
cp backend/.env.example backend/.env   # заполнить JWT_SECRET и CORS_ORIGINS
docker compose up -d --build
```

База лежит в томе `izden-data`. Без `JWT_SECRET` в режиме `ENV=production` сервер не стартует.

## Авторизация

`POST /api/auth/login` c `{"email", "password"}` возвращает `access_token` и `user`. Дальше каждый запрос идёт с заголовком `Authorization: Bearer <token>`. Все даты в ответах в UTC (ISO 8601).

## Эндпоинты

| Метод и путь | Кто | Что делает |
|---|---|---|
| `POST /api/auth/login` | все | вход |
| `GET /api/auth/me` | все | текущий пользователь |
| `GET /api/assignments` | все | список заданий (преподаватель видит только свои) |
| `POST /api/assignments` | преподаватель | создать задание, 4 этапа создаются автоматически |
| `GET /api/assignments/{id}` | все | задание с этапами |
| `GET /api/assignments/{id}/timeline?student_id=` | все | весь путь студента: этапы, версии, декларации ИИ, подсказки, фидбэк, оценка |
| `GET /api/assignments/{id}/students` | преподаватель | сводка по студентам: сданные этапы, оценка |
| `POST /api/stages/{id}/submissions` | студент | сдать новую версию с декларацией об ИИ |
| `GET /api/stages/{id}/submissions?student_id=` | все | версии на этапе |
| `GET /api/submissions/{id}` | все | одна версия |
| `POST /api/submissions/{id}/feedback` | преподаватель | фидбэк на версию |
| `POST /api/stages/{id}/hint` | студент | подсказка ИИ, запрос и ответ пишутся в лог |
| `POST /api/assignments/{id}/defense-questions?student_id=` | преподаватель | сгенерировать вопросы для защиты |
| `GET /api/assignments/{id}/defense-questions?student_id=` | преподаватель | сохранённые вопросы |
| `GET /api/assignments/{id}/grade?student_id=` | все | оценка |
| `PUT /api/assignments/{id}/grade?student_id=` | преподаватель | поставить или изменить оценку (0–100) |

Студент параметр `student_id` не передаёт: он всегда получает свои данные. Преподаватель передаёт его обязательно.

## Правила

- Студент видит все задания, но версии, лог ИИ, фидбэк и оценку только свои. Вопросы для защиты студенту не отдаются никогда.
- Преподаватель видит всё по своим заданиям и ничего по чужим.
- Этапы идут по порядку: нельзя сдать план, пока не сдана тема. Версий на этапе может быть сколько угодно, старые не редактируются.
- В каждой версии обязательна декларация: `used_ai: false` либо `used_ai: true` и хотя бы одна запись в `ai_usage` (`tool`, `purpose`, `details`).
- Оценку ставит только преподаватель и только после сдачи финала. После оценки сдача новых версий закрыта.
- ИИ оценку не ставит и в таблицу оценок не пишет.

## ИИ-модуль

Для демо без поставщика ИИ оставьте на фронтенде `VITE_USE_MOCKS=true` и `VITE_AI_DEMO=true`.
Интерфейс помечает заготовленные подсказки и вопросы «Демо / в разработке».

Для вызовов модели настройте `AI_API_KEY` и `AI_MODEL` в серверном `.env`. Если API
провайдера отличается от OpenAI, укажите `AI_BASE_URL` сервиса, который поддерживает
Chat Completions с `max_completion_tokens` и JSON mode. Для локального сервера используйте
`uvicorn app.main:app --env-file .env`. Без настроенной модели ИИ-маршруты возвращают
`502 AI_UNAVAILABLE`.

`AI_DAILY_LIMIT` ограничивает попытки вызова подсказок и защиты суммарно за сутки UTC.
Счётчик сохраняется в отдельном файле SQLite рядом с базой бэкенда. При необходимости
путь задаётся через `AI_QUOTA_DB`. На этап доступно 10 успешных подсказок на студента.

Генерация живёт в `app/ai/service.py`. Текущий бэкенд вызывает её через существующие
маршруты `/api/stages/{id}/hint` и `/api/assignments/{id}/defense-questions`.
TODO(spec): после перехода основного API на `Work` подключить генерацию к маршрутам
`/api/works/{id}/ai/*`, включая отдельный лог, снимок текста и сохранение `why` и
`edited_by_teacher`. Настройка ключа сама по себе не переключает фронтенд на эти маршруты.

Примеры и порядок проверки качества описаны в [docs/ai-tests.md](../docs/ai-tests.md).

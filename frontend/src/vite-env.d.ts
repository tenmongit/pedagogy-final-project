/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес бэкенда без /api, например http://localhost:8000. Пусто — тот же origin. */
  readonly VITE_API_URL?: string
  /** "false" — настоящий бэкенд, иначе моки в браузере. */
  readonly VITE_USE_MOCKS?: string
  /** "false" — ИИ на бэкенде настоящий, плашку «Демо» у блоков ИИ можно снять. */
  readonly VITE_AI_DEMO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

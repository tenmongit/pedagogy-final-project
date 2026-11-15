import type { IzdenApi } from './contract'
import { httpApi } from './http'
import { mockApi } from './mock'

/** VITE_USE_MOCKS=false — ходим в настоящий бэкенд по VITE_API_URL. По умолчанию моки. */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

export const api: IzdenApi = USE_MOCKS ? mockApi : httpApi

/**
 * Пока ИИ-модуль не подключён по-настоящему, блоки ИИ помечаются «Демо / в разработке»
 * (раздел 8 спеки). На моках — всегда. С бэкендом снимается флагом VITE_AI_DEMO=false.
 */
export const AI_IS_DEMO = USE_MOCKS || import.meta.env.VITE_AI_DEMO !== 'false'

export { ApiError, errorMessage } from './errors'
export type * from './types'

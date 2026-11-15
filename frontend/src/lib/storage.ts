/** localStorage с защитой: в приватном режиме или при запрете хранилища просто ничего не сохраняем. */

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // нет хранилища — живём без него
  }
}

export function readJson<T>(key: string): T | null {
  const raw = readLocal(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown) {
  writeLocal(key, JSON.stringify(value))
}

/** Черновик текста этапа: не теряется при перезагрузке. */
export const draftKey = (workId: number, stage: string) => `izden.draft.${workId}.${stage}`

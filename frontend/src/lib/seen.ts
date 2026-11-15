import { useEffect, useState } from 'react'
import { readJson, writeJson } from './storage'

/**
 * Метка «Новый» у фидбэка. В API нет признака «прочитано», поэтому помним в браузере,
 * какой фидбэк студент уже видел. Возвращает id, которые новые в этот заход на экран.
 */
export function useNewFeedbackIds(userId: number, ids: number[]): Set<number> {
  const key = `izden.seenFeedback.${userId}`
  const idsKey = ids.join(',')
  const [fresh] = useState(() => {
    const seen = new Set(readJson<number[]>(key) ?? [])
    return new Set(ids.filter((id) => !seen.has(id)))
  })

  useEffect(() => {
    if (!idsKey) return
    const seen = new Set(readJson<number[]>(key) ?? [])
    for (const id of idsKey.split(',')) seen.add(Number(id))
    writeJson(key, [...seen])
  }, [key, idsKey])

  return fresh
}

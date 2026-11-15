import type { AIHintLog, Stage, Submission } from '@/api'

const time = (iso: string) => new Date(iso).getTime()

/**
 * Правило связи подсказок с версиями (раздел 6 спеки, «Связь подсказок с версиями»):
 * к версии N относятся подсказки того же этапа, созданные после версии N−1
 * (для N = 1 — с начала этапа) и до версии N.
 * `versions` — версии этапа по возрастанию номера, `index` — позиция версии в этом списке.
 */
export function hintsForVersion(hints: AIHintLog[], stage: Stage, versions: Submission[], index: number): AIHintLog[] {
  const from = index > 0 ? time(versions[index - 1].created_at) : Number.NEGATIVE_INFINITY
  const to = time(versions[index].created_at)
  return hints.filter((h) => h.stage === stage && time(h.created_at) > from && time(h.created_at) <= to)
}

/** Подсказки этапа после его последней версии (или все, если версий ещё нет). */
export function hintsAfterLast(hints: AIHintLog[], stage: Stage, versions: Submission[]): AIHintLog[] {
  const last = versions.at(-1)
  const from = last ? time(last.created_at) : Number.NEGATIVE_INFINITY
  return hints.filter((h) => h.stage === stage && time(h.created_at) > from)
}

export const newestFirst = <T extends { created_at: string }>(items: T[]) =>
  [...items].sort((a, b) => time(b.created_at) - time(a.created_at))

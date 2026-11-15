// Подписи этапов, статусов, ролей и инструментов, а также форматы дат переехали в словари (src/i18n).

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

const KEY = 'izden.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(KEY, token)
    } catch {
      // приватный режим или запрет хранилища: токен живёт до перезагрузки
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // игнорируем
    }
  },
}

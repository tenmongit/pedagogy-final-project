let onUnauthorized: () => void = () => {}

/** AuthProvider регистрирует здесь выход из аккаунта при 401. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export function notifyUnauthorized() {
  onUnauthorized()
}

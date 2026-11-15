import { createContext, useContext } from 'react'

/** Открывает выдвижное меню на экранах уже 1024px (телефон, планшет). */
export const NavContext = createContext<{ openNav: () => void }>({ openNav: () => {} })

export function useOpenNav() {
  return useContext(NavContext).openNav
}

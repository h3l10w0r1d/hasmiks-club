import { useState } from 'react'

export function useLang() {
  const [lang, setLangState] = useState(() => localStorage.getItem('hasmik_lang') || 'hy')
  const setLang = (l) => {
    setLangState(l)
    localStorage.setItem('hasmik_lang', l)
  }
  return [lang, setLang]
}

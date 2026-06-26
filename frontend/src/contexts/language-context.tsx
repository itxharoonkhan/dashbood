"use client"

import * as React from "react"
import { useSelector, useDispatch } from "react-redux"
import { RootState, AppDispatch } from "@/store"
import { setLanguage as setLanguageAction } from "@/store/slices/languageSlice"
import { translations, TranslationKeys } from "@/lib/translations"

type Language = "en" | "ur"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function useLanguage() {
  const dispatch = useDispatch<AppDispatch>()
  const language = useSelector((s: RootState) => s.language.language)

  const setLanguage = (lang: Language) => {
    dispatch(setLanguageAction(lang))
  }

  const t = React.useCallback(
    (key: keyof TranslationKeys) => translations[language][key] || key,
    [language]
  )

  const isRTL = language === "ur"

  return { language, setLanguage, t, isRTL }
}

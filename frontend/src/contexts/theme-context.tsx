"use client"

import React, { useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { RootState, AppDispatch } from "@/store"
import { setTheme as setThemeAction, toggleTheme as toggleThemeAction } from "@/store/slices/themeSlice"

type Theme = "dark" | "light"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()
  const theme = useSelector((s: RootState) => s.theme.theme)

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null
    let initial: Theme = "light"
    if (saved) {
      initial = saved
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initial = "dark"
    }
    dispatch(setThemeAction(initial))
    document.documentElement.classList.toggle("dark", initial === "dark")

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        const t: Theme = e.matches ? "dark" : "light"
        dispatch(setThemeAction(t))
        document.documentElement.classList.toggle("dark", e.matches)
      }
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [dispatch])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return <>{children}</>
}

export function useTheme() {
  const dispatch = useDispatch<AppDispatch>()
  const theme = useSelector((s: RootState) => s.theme.theme)

  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t)
    dispatch(setThemeAction(t))
  }

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    localStorage.setItem("theme", next)
    dispatch(toggleThemeAction())
  }

  return { theme, setTheme, toggleTheme }
}

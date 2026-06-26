"use client"

import * as React from "react"
import { Provider } from "react-redux"
import { store } from "@/store"
import { ThemeProvider } from "@/contexts/theme-context"
import { AuthProvider } from "@/contexts/auth-context"
import { LanguageProvider } from "@/contexts/language-context"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <Toaster />
            {children}
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  )
}

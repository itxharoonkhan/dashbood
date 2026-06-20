"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

interface User {
  id: string
  name: string
  role: "admin" | "cashier" | "superadmin"
  permissions?: string[]
}

interface AuthContextType {
  user: User | null
  userRole: string
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup"]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check for existing auth on mount
    try {
      const token = localStorage.getItem("authToken")
      const role = localStorage.getItem("userRole")
      const userId = localStorage.getItem("userId")
      const userName = localStorage.getItem("userName")
      const permissions = localStorage.getItem("userPermissions")

      if (token && role && userId && userName) {
        setUser({
          id: userId,
          name: userName,
          role: role as "admin" | "cashier" | "superadmin",
          permissions: permissions ? JSON.parse(permissions) : []
        })
      }
    } catch (err) {
      console.warn("Auth storage error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Redirect logic
    if (isLoading) return

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

    if (!user && !isPublicRoute) {
      // Not logged in, redirect to login if not already there
      if (pathname !== "/login") {
        router.replace("/login")
      }
    } else if (user && (pathname === "/" || pathname === "/login")) {
      // Logged in, redirect from landing or login page
      if (user.role === 'superadmin') {
        router.replace("/superadmin")
      } else if (user.role === 'admin') {
        router.replace("/dashboard")
      } else {
        const hasSales = user.permissions?.includes('sales')
        if (hasSales) {
          router.replace("/sales")
        } else if (user.permissions && user.permissions.length > 0) {
          // Map permission back to route
          const routeMap: Record<string, string> = {
            'dashboard': '/dashboard',
            'sales': '/sales',
            'inventory': '/inventory',
            'customers': '/customers',
            'reports': '/reports',
            'settings': '/settings'
          }
          router.replace(routeMap[user.permissions[0]] || "/sales")
        } else {
          router.replace("/sales")
        }
      }
    }
  }, [user, isLoading, pathname, router])

  const login = (token: string, userData: User) => {
    localStorage.setItem("authToken", token)
    localStorage.setItem("userRole", userData.role)
    localStorage.setItem("userId", userData.id)
    localStorage.setItem("userName", userData.name)
    localStorage.setItem("userPermissions", JSON.stringify(userData.permissions || []))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    localStorage.removeItem("userPermissions")
    setUser(null)
    router.push("/login")
  }

  const isAuthenticated = !!user
  const userRole = user?.role || ""

  return (
    <AuthContext.Provider value={{ user, userRole, isLoading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

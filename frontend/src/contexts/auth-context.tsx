"use client"

import React, { useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useRouter, usePathname } from "next/navigation"
import { RootState, AppDispatch } from "@/store"
import { setUser, clearUser, AuthUser } from "@/store/slices/authSlice"

const PUBLIC_ROUTES = ["/login", "/signup"]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()
  const { user, isLoading } = useSelector((s: RootState) => s.auth)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    try {
      const token = localStorage.getItem("authToken")
      const role = localStorage.getItem("userRole")
      const userId = localStorage.getItem("userId")
      const userName = localStorage.getItem("userName")
      const permissions = localStorage.getItem("userPermissions")

      if (token && role && userId && userName) {
        dispatch(setUser({
          id: userId,
          name: userName,
          role: role as AuthUser["role"],
          permissions: permissions ? JSON.parse(permissions) : [],
        }))
      } else {
        dispatch(setUser(null))
      }
    } catch {
      dispatch(setUser(null))
    }
  }, [dispatch])

  useEffect(() => {
    if (isLoading) return
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
    if (!user && !isPublicRoute && pathname !== "/login") {
      router.replace("/login")
    } else if (user && (pathname === "/" || pathname === "/login")) {
      if (user.role === "superadmin") {
        router.replace("/superadmin")
      } else if (user.role === "admin") {
        router.replace("/dashboard")
      } else {
        const hasSales = user.permissions?.includes("sales")
        if (hasSales) {
          router.replace("/sales")
        } else if (user.permissions?.length > 0) {
          const routeMap: Record<string, string> = {
            dashboard: "/dashboard", sales: "/sales", inventory: "/inventory",
            customers: "/customers", reports: "/reports", settings: "/settings",
          }
          router.replace(routeMap[user.permissions[0]] || "/sales")
        } else {
          router.replace("/sales")
        }
      }
    }
  }, [user, isLoading, pathname, router])

  return <>{children}</>
}

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>()
  const { user, isLoading } = useSelector((s: RootState) => s.auth)
  const router = useRouter()

  const login = (token: string, userData: { id: string | number; name: string; role: AuthUser["role"]; permissions?: string[] }) => {
    const id = String(userData.id)
    localStorage.setItem("authToken", token)
    localStorage.setItem("userRole", userData.role)
    localStorage.setItem("userId", id)
    localStorage.setItem("userName", userData.name)
    localStorage.setItem("userPermissions", JSON.stringify(userData.permissions || []))
    dispatch(setUser({ id, name: userData.name, role: userData.role, permissions: userData.permissions || [] }))
  }

  const logout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    localStorage.removeItem("userPermissions")
    dispatch(clearUser())
    router.push("/login")
  }

  return {
    user,
    userRole: user?.role || "",
    isLoading,
    login,
    logout,
    isAuthenticated: !!user,
  }
}

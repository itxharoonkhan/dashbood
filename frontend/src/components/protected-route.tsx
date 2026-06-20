"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ("admin" | "cashier" | "superadmin")[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Define route to permission mapping
  const routePermissionMap: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/sales': 'sales',
    '/inventory': 'inventory',
    '/customers': 'customers',
    '/reports': 'reports',
    '/settings': 'settings',
    '/expenses': 'expenses',
    '/coupons': 'coupons',
    '/suppliers': 'suppliers',
    '/shifts': 'shifts',
    '/tables': 'tables',
    '/kitchen': 'kitchen',
  }

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    // 1. Check Role Access
    const roleIsAllowed = !allowedRoles || allowedRoles.includes(user.role)

    // 2. Check Permission Access
    // Superadmin = admin with empty permissions array → sab access
    const isSuperAdmin = user.role === 'admin' && (!user.permissions || user.permissions.length === 0)

    let permissionIsAllowed = true
    if (!isSuperAdmin) {
      const requiredPermission = routePermissionMap[pathname]
      if (requiredPermission) {
        permissionIsAllowed = user.permissions?.includes(requiredPermission) || false
      }
    }

    if (!roleIsAllowed || !permissionIsAllowed) {
      // Find first allowed page
      const allowedPage = Object.keys(routePermissionMap).find(route =>
        user.permissions?.includes(routePermissionMap[route])
      )
      router.push(allowedPage || "/sales")
    }
  }, [user, isLoading, router, allowedRoles, pathname])

  // Show loading screen while checking auth
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Final Permission Check before rendering children
  const isSuperAdmin = user.role === 'admin' && (!user.permissions || user.permissions.length === 0)
  const requiredPermission = routePermissionMap[pathname]
  const hasPermission = isSuperAdmin || !requiredPermission || (user.permissions?.includes(requiredPermission))
  const hasRole = !allowedRoles || allowedRoles.includes(user.role)

  if (!hasRole || !hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
          <button 
            onClick={() => router.push(user.role === 'admin' ? '/dashboard' : '/sales')}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

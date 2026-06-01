"use client"

import * as React from "react"
import { Bell, Package, CheckCheck, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"

interface Notification {
  id: number
  product_id: number
  product_name: string
  current_stock: number
  threshold: number
  created_at: string
}

export function NotificationBell() {
  const [count, setCount] = React.useState(0)
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Poll count every 60 seconds
  React.useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const fetchCount = async () => {
    try {
      const res = await api.get("/notifications/count")
      setCount(res.data.count || 0)
    } catch {}
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await api.get("/notifications")
      setNotifications(res.data.data || [])
      setCount(res.data.data?.length || 0)
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    if (!open) fetchNotifications()
    setOpen(o => !o)
  }

  const markOne = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(p => p.filter(n => n.id !== id))
      setCount(c => Math.max(0, c - 1))
    } catch {}
  }

  const markAll = async () => {
    try {
      await api.patch("/notifications/read-all")
      setNotifications([])
      setCount(0)
    } catch {}
  }

  const stockLevel = (n: Notification) => {
    if (n.current_stock === 0) return { label: "Out of Stock", color: "text-red-500" }
    if (n.current_stock <= Math.floor(n.threshold / 2)) return { label: "Critical", color: "text-orange-500" }
    return { label: "Low Stock", color: "text-yellow-500" }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={handleOpen}
        title="Low Stock Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-white bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold text-sm">Low Stock Alerts</span>
              {count > 0 && (
                <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {count}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={markAll}>
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Package className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">All stock levels are good</p>
                <p className="text-xs">No low stock alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {notifications.map(n => {
                  const level = stockLevel(n)
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                      <div className="mt-0.5">
                        <Package className={`w-4 h-4 ${level.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.product_name}</p>
                        <p className={`text-xs font-semibold ${level.color}`}>{level.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Only <span className="font-bold text-foreground">{n.current_stock}</span> units left
                          &nbsp;·&nbsp; threshold: {n.threshold}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => markOne(n.id)}
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white text-xs text-muted-foreground">
              Go to <a href="/inventory" className="text-primary hover:underline" onClick={() => setOpen(false)}>Inventory</a> to restock
            </div>
          )}
        </div>
      )}
    </div>
  )
}

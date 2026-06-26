"use client"

import * as React from "react"
import { Bell, BellOff, Package, CheckCheck, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

interface Notification {
  id: number
  product_id: number
  product_name: string
  current_stock: number
  threshold: number
  is_read: boolean
  created_at: string
}

function NotificationsContent() {
  const { toast } = useToast()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [unread, setUnread] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [markingAll, setMarkingAll] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.data || [])
      setUnread(res.data.unread || 0)
    } catch {
      toast({ title: 'Failed to load notifications', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => { load() }, [load])

  const markOne = async (id: number) => {
    try {
      await api.patch('/notifications', { id })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnread(u => Math.max(0, u - 1))
    } catch {
      toast({ title: 'Failed to mark as read', variant: 'destructive' })
    }
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
      toast({ title: 'All notifications marked as read' })
    } catch {
      toast({ title: 'Failed to mark all as read', variant: 'destructive' })
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadList = notifications.filter(n => !n.is_read)
  const readList = notifications.filter(n => n.is_read)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">Low-stock alerts and system notifications</p>
          </div>
          {unread > 0 && (
            <Badge variant="destructive" className="text-sm px-2">{unread} unread</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unread > 0 && (
            <Button size="sm" onClick={markAll} disabled={markingAll}>
              {markingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm text-muted-foreground mt-1">All stock levels are healthy.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {unreadList.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Unread</h2>
              {unreadList.map(n => (
                <NotifCard key={n.id} notif={n} onMarkRead={markOne} />
              ))}
            </div>
          )}
          {readList.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Read</h2>
              {readList.map(n => (
                <NotifCard key={n.id} notif={n} onMarkRead={markOne} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotifCard({ notif, onMarkRead }: { notif: Notification; onMarkRead: (id: number) => void }) {
  const stockPercent = Math.round((notif.current_stock / notif.threshold) * 100)
  const severity = notif.current_stock === 0 ? 'destructive' : notif.current_stock <= notif.threshold / 2 ? 'destructive' : 'secondary'

  return (
    <Card className={`transition-all ${notif.is_read ? 'opacity-60' : 'border-orange-500/30 bg-orange-50/5'}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`p-2.5 rounded-lg ${notif.current_stock === 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
          <Package className={`h-5 w-5 ${notif.current_stock === 0 ? 'text-red-600' : 'text-orange-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{notif.product_name}</span>
            {!notif.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>
              Stock: <span className={`font-semibold ${notif.current_stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>{notif.current_stock}</span>
              <span className="text-muted-foreground"> / threshold {notif.threshold}</span>
            </span>
            <Badge variant={severity} className="text-xs py-0">
              {notif.current_stock === 0 ? 'Out of stock' : `${stockPercent}% of threshold`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(notif.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {!notif.is_read && (
          <Button variant="ghost" size="sm" onClick={() => onMarkRead(notif.id)} className="shrink-0 text-xs">
            Mark read
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  )
}

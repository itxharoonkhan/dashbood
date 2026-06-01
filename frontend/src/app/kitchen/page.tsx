"use client"

import * as React from "react"
import { RefreshCw, ChefHat, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

type KotStatus = "pending" | "cooking" | "ready" | "served" | "billed"

interface KotItem {
  id: number
  product_name: string
  quantity: number
  notes?: string
  status: string
}

interface Kot {
  id: number
  kot_number: string
  status: KotStatus
  printed_at: string
  order_id: number
  pax: number
  table_name: string
  floor_section: string
  items: KotItem[]
}

const STATUS_COLOR: Record<KotStatus, string> = {
  pending: "border-yellow-500 bg-yellow-500/10",
  cooking: "border-orange-500 bg-orange-500/10",
  ready:   "border-green-500  bg-green-500/10",
  served:  "border-blue-500   bg-blue-500/10",
  billed:  "border-gray-400   bg-gray-400/10",
}

const STATUS_BADGE: Record<KotStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  cooking: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  ready:   "bg-green-500/15  text-green-700  border-green-500/30",
  served:  "bg-blue-500/15   text-blue-700   border-blue-500/30",
  billed:  "bg-gray-400/15   text-gray-600   border-gray-400/30",
}

const NEXT_STATUS: Partial<Record<KotStatus, KotStatus>> = {
  pending: "cooking",
  cooking: "ready",
  ready:   "served",
}

const NEXT_LABEL: Partial<Record<KotStatus, string>> = {
  pending: "Start Cooking",
  cooking: "Mark Ready",
  ready:   "Mark Served",
}

function elapsedLabel(printed_at: string) {
  const diff = Math.floor((Date.now() - new Date(printed_at).getTime()) / 60000)
  if (diff < 1) return "Just now"
  if (diff === 1) return "1 min ago"
  return `${diff} mins ago`
}

export default function KitchenPage() {
  const { toast } = useToast()
  const [kots, setKots] = React.useState<Kot[]>([])
  const [loading, setLoading] = React.useState(true)
  const [updating, setUpdating] = React.useState<number | null>(null)

  const fetchKots = React.useCallback(async () => {
    try {
      const res = await api.get("/kitchen/kots")
      setKots(res.data.data || [])
    } catch {
      // silent fail on auto-refresh
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchKots()
    const interval = setInterval(fetchKots, 10000)
    return () => clearInterval(interval)
  }, [fetchKots])

  const handleAdvanceStatus = async (kot: Kot) => {
    const next = NEXT_STATUS[kot.status]
    if (!next) return
    setUpdating(kot.id)
    try {
      await api.put(`/kitchen/kots/${kot.id}/status`, { status: next })
      toast({ title: "Updated", description: `${kot.kot_number} → ${next}` })
      fetchKots()
    } catch {
      toast({ title: "Error", description: "Failed to update KOT", variant: "destructive" })
    } finally {
      setUpdating(null)
    }
  }

  const activeKots = kots.filter(k => k.status !== "billed")

  return (
    <ProtectedRoute allowedRoles={["admin", "cashier"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
              <ChefHat className="w-7 h-7" />
              Kitchen Display
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-refreshes every 10 seconds &mdash; {activeKots.length} active KOT(s)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchKots}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh Now
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeKots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No active KOTs at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeKots.map(kot => (
              <Card key={kot.id} className={`border-2 ${STATUS_COLOR[kot.status]}`}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{kot.table_name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{kot.kot_number}</p>
                    </div>
                    <Badge className={`text-[10px] border shrink-0 ${STATUS_BADGE[kot.status]}`}>
                      {kot.status.charAt(0).toUpperCase() + kot.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {elapsedLabel(kot.printed_at)}
                    </span>
                    <span>{kot.pax} pax</span>
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="space-y-1.5">
                    {kot.items.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                        <div>
                          <span className="font-medium">{item.product_name}</span>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground italic">{item.notes}</p>
                          )}
                        </div>
                        <span className="font-bold shrink-0">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {NEXT_STATUS[kot.status] && (
                    <Button
                      className="w-full h-8 text-sm"
                      variant={kot.status === "ready" ? "default" : "outline"}
                      onClick={() => handleAdvanceStatus(kot)}
                      disabled={updating === kot.id}
                    >
                      {updating === kot.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : null}
                      {NEXT_LABEL[kot.status]}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

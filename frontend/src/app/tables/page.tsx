"use client"

import * as React from "react"
import {
  Users,
  ChefHat,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import OrderPanel from "@/components/tables/OrderPanel"

// ─── Types ────────────────────────────────────────────────────────────────────

type TableStatus = "available" | "occupied" | "bill_printed" | "split"

interface RestaurantTable {
  id: number
  name: string
  capacity: number
  status: TableStatus
  floor_section: string
  order_id?: number
  pax?: number
  running_total?: number
  item_count?: number
  order_opened_at?: string
}

// ─── Colour mapping ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TableStatus, string> = {
  available:    "border-green-500  bg-green-500/10  hover:bg-green-500/20",
  occupied:     "border-red-500    bg-red-500/10    hover:bg-red-500/20",
  bill_printed: "border-orange-500 bg-orange-500/10 hover:bg-orange-500/20",
  split:        "border-purple-500 bg-purple-500/10 hover:bg-purple-500/20",
}

const STATUS_BADGE: Record<TableStatus, string> = {
  available:    "bg-green-500/15  text-green-600  border-green-500/30",
  occupied:     "bg-red-500/15    text-red-600    border-red-500/30",
  bill_printed: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  split:        "bg-purple-500/15 text-purple-600 border-purple-500/30",
}

const STATUS_LABEL: Record<TableStatus, string> = {
  available:    "Available",
  occupied:     "Occupied",
  bill_printed: "Bill Printed",
  split:        "Split",
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const { toast } = useToast()
  const [tables, setTables] = React.useState<RestaurantTable[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userRole, setUserRole] = React.useState("")

  // Selected table for order panel
  const [selectedTable, setSelectedTable] = React.useState<RestaurantTable | null>(null)
  const [orderPanelOpen, setOrderPanelOpen] = React.useState(false)

  // Add table dialog
  const [addOpen, setAddOpen] = React.useState(false)
  const [newTable, setNewTable] = React.useState({ name: "", capacity: "4", floor_section: "Main" })
  const [addLoading, setAddLoading] = React.useState(false)

  React.useEffect(() => {
    setUserRole(localStorage.getItem("userRole") || "")
    fetchTables()
  }, [])

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables")
      setTables(res.data.data || [])
    } catch {
      toast({ title: "Error", description: "Failed to load tables", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleTableClick = (table: RestaurantTable) => {
    setSelectedTable(table)
    setOrderPanelOpen(true)
  }

  const handleAddTable = async () => {
    if (!newTable.name.trim()) return
    setAddLoading(true)
    try {
      await api.post("/tables", {
        name: newTable.name.trim(),
        capacity: parseInt(newTable.capacity) || 4,
        floor_section: newTable.floor_section.trim() || "Main",
      })
      toast({ title: "Table Added", description: `${newTable.name} has been added.` })
      setAddOpen(false)
      setNewTable({ name: "", capacity: "4", floor_section: "Main" })
      fetchTables()
    } catch {
      toast({ title: "Error", description: "Failed to add table", variant: "destructive" })
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteTable = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation()
    if (table.status !== "available") {
      toast({ title: "Cannot Delete", description: "Only available tables can be deleted.", variant: "destructive" })
      return
    }
    try {
      await api.delete(`/tables/${table.id}`)
      toast({ title: "Deleted", description: `${table.name} removed.` })
      fetchTables()
    } catch {
      toast({ title: "Error", description: "Failed to delete table", variant: "destructive" })
    }
  }

  // Group by floor section
  const sections = Array.from(new Set(tables.map(t => t.floor_section))).sort()

  return (
    <ProtectedRoute allowedRoles={["admin", "cashier"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
              <ChefHat className="w-7 h-7" />
              Table Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Click a table to open/view its order</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchTables}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {userRole === "admin" && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Table
              </Button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(STATUS_LABEL) as TableStatus[]).map(s => (
            <span key={s} className={`px-2 py-1 rounded border font-medium ${STATUS_BADGE[s]}`}>
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>

        {/* Floor sections */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          sections.map(section => (
            <div key={section}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {section} Floor
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {tables.filter(t => t.floor_section === section).map(table => (
                  <Card
                    key={table.id}
                    className={`cursor-pointer border-2 transition-all relative group ${STATUS_COLOR[table.status]}`}
                    onClick={() => handleTableClick(table)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-lg font-bold mb-1">{table.name}</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2">
                        <Users className="w-3 h-3" />
                        <span>{table.capacity} seats</span>
                      </div>
                      <Badge className={`text-[10px] border ${STATUS_BADGE[table.status]}`}>
                        {STATUS_LABEL[table.status]}
                      </Badge>
                      {table.status !== "available" && table.running_total !== undefined && (
                        <div className="mt-2 text-sm font-semibold">
                          Rs. {Number(table.running_total).toLocaleString()}
                        </div>
                      )}
                      {table.item_count ? (
                        <div className="text-xs text-muted-foreground">{table.item_count} item(s)</div>
                      ) : null}
                      {/* Delete button (admin, available tables) */}
                      {userRole === "admin" && table.status === "available" && (
                        <button
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                          onClick={(e) => handleDeleteTable(table, e)}
                          title="Delete table"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Order Panel */}
      {selectedTable && (
        <OrderPanel
          open={orderPanelOpen}
          table={selectedTable}
          onClose={() => {
            setOrderPanelOpen(false)
            setSelectedTable(null)
            fetchTables()
          }}
        />
      )}

      {/* Add Table Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tname">Table Name</Label>
              <Input
                id="tname"
                placeholder="e.g. T-11"
                value={newTable.name}
                onChange={e => setNewTable(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tcap">Capacity</Label>
                <Input
                  id="tcap"
                  type="number"
                  min="1"
                  max="20"
                  value={newTable.capacity}
                  onChange={e => setNewTable(p => ({ ...p, capacity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tsec">Floor Section</Label>
                <Input
                  id="tsec"
                  placeholder="Main"
                  value={newTable.floor_section}
                  onChange={e => setNewTable(p => ({ ...p, floor_section: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTable} disabled={addLoading || !newTable.name.trim()}>
              {addLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

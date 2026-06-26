"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Truck, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2,
  Search, PackageCheck, ClipboardList, BarChart2, Phone, Mail,
  MapPin, FileText, ChevronDown, CheckCircle2, XCircle, Clock,
  AlertCircle, RefreshCw, Package
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput, formatPhone } from "@/components/ui/phone-input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

// ─── Types ────────────────────────────────────────────────

interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  status: "active" | "inactive"
  notes: string | null
  mapped_items: number
  total_pos: number
  created_at: string
}

interface Product {
  id: number
  name: string
  sku: string | null
  stock: number
  threshold: number
}

interface PurchaseOrder {
  id: number
  po_number?: number
  supplier_id: number
  supplier_name: string
  status: "draft" | "sent" | "partially_received" | "received" | "cancelled"
  notes: string | null
  expected_date: string | null
  created_at: string
  item_count: number
  total_value: number
  total_qty_ordered: number
  total_qty_received: number
}

interface POItem {
  id: number
  product_id: number
  product_name: string
  sku: string | null
  current_stock: number
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
}

interface PODetail extends PurchaseOrder {
  supplier_phone: string | null
  supplier_email: string | null
  items: POItem[]
}

interface SupplierStat {
  id: number
  name: string
  phone: string | null
  email: string | null
  status: string
  total_pos: number
  total_ordered_value: number
  total_received_value: number
  pending_pos: number
}

// ─── Helpers ──────────────────────────────────────────────

const PO_STATUSES = ["draft", "sent", "partially_received", "received", "cancelled"] as const

const statusMeta: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:              { label: "Draft",              color: "bg-gray-500/20 text-gray-400 border-gray-500/30",   icon: FileText },
  sent:               { label: "Sent",               color: "bg-blue-500/20 text-blue-400 border-blue-500/30",   icon: Clock },
  partially_received: { label: "Partial",            color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertCircle },
  received:           { label: "Received",           color: "bg-green-500/20 text-green-400 border-green-500/30",  icon: CheckCircle2 },
  cancelled:          { label: "Cancelled",          color: "bg-red-500/20 text-red-400 border-red-500/30",       icon: XCircle },
}

function fmt(n: number) { return `Rs. ${Number(n).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` }

// ─── Supplier Form ─────────────────────────────────────────

const emptySupplier = { name: "", phone: "92", email: "", address: "", notes: "", status: "active" as "active" | "inactive" }

function SupplierFormFields({ data, onChange }: {
  data: typeof emptySupplier
  onChange: (d: typeof emptySupplier) => void
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input placeholder="Supplier name" value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <PhoneInput id="supplier-phone" label="Phone" value={data.phone || "92"} onChange={v => onChange({ ...data, phone: v })} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="supplier@email.com" className="pl-9" value={data.email} onChange={e => onChange({ ...data, email: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="City, Area" className="pl-9" value={data.address} onChange={e => onChange({ ...data, address: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Payment terms, delivery schedule..." rows={2} value={data.notes} onChange={e => onChange({ ...data, notes: e.target.value })} />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-white p-3 bg-muted/20">
        <div>
          <p className="text-sm font-medium">Active Status</p>
          <p className="text-xs text-muted-foreground">Inactive suppliers won't appear in PO creation</p>
        </div>
        <Switch checked={data.status === "active"} onCheckedChange={v => onChange({ ...data, status: v ? "active" : "inactive" })} />
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────

export default function SuppliersPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Suppliers state
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loadingSup, setLoadingSup] = React.useState(true)
  const [searchSup, setSearchSup] = React.useState("")
  const [isCreateSupOpen, setIsCreateSupOpen] = React.useState(false)
  const [isEditSupOpen, setIsEditSupOpen] = React.useState(false)
  const [isDeleteSupOpen, setIsDeleteSupOpen] = React.useState(false)
  const [selectedSup, setSelectedSup] = React.useState<Supplier | null>(null)
  const [supForm, setSupForm] = React.useState(emptySupplier)
  const [savingSup, setSavingSup] = React.useState(false)

  // Purchase Orders state
  const [pos, setPos] = React.useState<PurchaseOrder[]>([])
  const [loadingPO, setLoadingPO] = React.useState(true)
  const [filterSupplier, setFilterSupplier] = React.useState("all")
  const [filterStatus, setFilterStatus] = React.useState("all")
  const [isCreatePOOpen, setIsCreatePOOpen] = React.useState(false)
  const [poForm, setPoForm] = React.useState({ supplier_id: "", notes: "", expected_date: "" })
  const [poItems, setPoItems] = React.useState<{ product_id: string; quantity_ordered: string; unit_cost: string }[]>([
    { product_id: "", quantity_ordered: "", unit_cost: "" }
  ])
  const [savingPO, setSavingPO] = React.useState(false)

  // PO Detail / Receive state
  const [viewPO, setViewPO] = React.useState<PODetail | null>(null)
  const [isViewPOOpen, setIsViewPOOpen] = React.useState(false)
  const [isReceiveOpen, setIsReceiveOpen] = React.useState(false)
  const [receiveQtys, setReceiveQtys] = React.useState<Record<number, string>>({})
  const [savingReceive, setSavingReceive] = React.useState(false)

  // Reports state
  const [reportStats, setReportStats] = React.useState<SupplierStat[]>([])
  const [loadingReport, setLoadingReport] = React.useState(false)

  // Products for PO creation
  const [products, setProducts] = React.useState<Product[]>([])

  React.useEffect(() => {
    const role = localStorage.getItem("userRole")
    if (role !== "admin") router.replace("/dashboard")
  }, [router])

  React.useEffect(() => {
    fetchSuppliers()
    fetchPOs()
    fetchProducts()
    fetchReports()
  }, [])

  // ── Suppliers ──────────────────────────────────────────

  const fetchSuppliers = async () => {
    try {
      setLoadingSup(true)
      const res = await api.get("/suppliers")
      setSuppliers(res.data.data || [])
    } catch {
      toast({ title: "Error", description: "Failed to fetch suppliers", variant: "destructive" })
    } finally {
      setLoadingSup(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products")
      setProducts(res.data.data || [])
    } catch {}
  }

  const openCreateSup = () => { setSupForm(emptySupplier); setIsCreateSupOpen(true) }
  const openEditSup = (s: Supplier) => {
    setSelectedSup(s)
    setSupForm({ name: s.name, phone: s.phone || "92", email: s.email || "", address: s.address || "", notes: s.notes || "", status: s.status })
    setIsEditSupOpen(true)
  }
  const openDeleteSup = (s: Supplier) => { setSelectedSup(s); setIsDeleteSupOpen(true) }

  const handleCreateSup = async () => {
    if (!supForm.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return }
    setSavingSup(true)
    try {
      await api.post("/suppliers", supForm)
      toast({ title: "Supplier created" })
      setIsCreateSupOpen(false)
      fetchSuppliers()
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed", variant: "destructive" })
    } finally { setSavingSup(false) }
  }

  const handleEditSup = async () => {
    if (!selectedSup) return
    if (!supForm.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return }
    setSavingSup(true)
    try {
      await api.put(`/suppliers/${selectedSup.id}`, supForm)
      toast({ title: "Supplier updated" })
      setIsEditSupOpen(false)
      fetchSuppliers()
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed", variant: "destructive" })
    } finally { setSavingSup(false) }
  }

  const handleToggleSup = async (s: Supplier) => {
    try {
      const res = await api.patch(`/suppliers/${s.id}/toggle`)
      toast({ title: res.data.message })
      fetchSuppliers()
    } catch {
      toast({ title: "Error", description: "Failed to toggle", variant: "destructive" })
    }
  }

  const handleDeleteSup = async () => {
    if (!selectedSup) return
    setSavingSup(true)
    try {
      await api.delete(`/suppliers/${selectedSup.id}`)
      toast({ title: "Supplier deleted" })
      setIsDeleteSupOpen(false)
      fetchSuppliers()
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    } finally { setSavingSup(false) }
  }

  const filteredSup = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchSup.toLowerCase()) ||
    (s.phone || "").includes(searchSup) ||
    (s.email || "").toLowerCase().includes(searchSup.toLowerCase())
  )

  // ── Purchase Orders ────────────────────────────────────

  const fetchPOs = async () => {
    try {
      setLoadingPO(true)
      const res = await api.get("/suppliers/purchase-orders")
      setPos(res.data.data || [])
    } catch {
      toast({ title: "Error", description: "Failed to fetch purchase orders", variant: "destructive" })
    } finally {
      setLoadingPO(false)
    }
  }

  const fetchReports = async () => {
    try {
      setLoadingReport(true)
      const res = await api.get("/suppliers/reports")
      setReportStats(res.data.data?.supplierStats || [])
    } catch {} finally {
      setLoadingReport(false)
    }
  }

  const addPOItemRow = () => setPoItems(p => [...p, { product_id: "", quantity_ordered: "", unit_cost: "" }])
  const removePOItemRow = (i: number) => setPoItems(p => p.filter((_, idx) => idx !== i))
  const updatePOItem = (i: number, field: string, value: string) =>
    setPoItems(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  const handleCreatePO = async () => {
    if (!poForm.supplier_id) { toast({ title: "Select a supplier", variant: "destructive" }); return }
    const validItems = poItems.filter(i => i.product_id && parseInt(i.quantity_ordered) > 0)
    if (validItems.length === 0) { toast({ title: "Add at least one item with quantity", variant: "destructive" }); return }
    setSavingPO(true)
    try {
      await api.post("/suppliers/purchase-orders", {
        supplier_id: parseInt(poForm.supplier_id),
        notes: poForm.notes || null,
        expected_date: poForm.expected_date || null,
        items: validItems.map(i => ({
          product_id: parseInt(i.product_id),
          quantity_ordered: parseInt(i.quantity_ordered),
          unit_cost: parseFloat(i.unit_cost) || 0,
        }))
      })
      toast({ title: "Purchase order created" })
      setIsCreatePOOpen(false)
      setPoForm({ supplier_id: "", notes: "", expected_date: "" })
      setPoItems([{ product_id: "", quantity_ordered: "", unit_cost: "" }])
      fetchPOs()
      fetchReports()
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed", variant: "destructive" })
    } finally { setSavingPO(false) }
  }

  const openViewPO = async (po: PurchaseOrder) => {
    try {
      const res = await api.get(`/suppliers/purchase-orders/${po.id}`)
      setViewPO(res.data.data)
      setIsViewPOOpen(true)
    } catch {
      toast({ title: "Error", description: "Failed to load PO details", variant: "destructive" })
    }
  }

  const openReceive = (po: PODetail) => {
    const qtys: Record<number, string> = {}
    po.items.forEach(i => { qtys[i.id] = "" })
    setReceiveQtys(qtys)
    setIsReceiveOpen(true)
  }

  const handleReceiveStock = async () => {
    if (!viewPO) return
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([id, qty]) => ({ po_item_id: parseInt(id), quantity_received: parseInt(qty) }))
    if (items.length === 0) { toast({ title: "Enter quantity to receive", variant: "destructive" }); return }
    setSavingReceive(true)
    try {
      await api.post(`/suppliers/purchase-orders/${viewPO.id}/receive`, { items })
      toast({ title: "Stock received!", description: "Inventory has been updated" })
      setIsReceiveOpen(false)
      const res = await api.get(`/suppliers/purchase-orders/${viewPO.id}`)
      setViewPO(res.data.data)
      fetchPOs()
      fetchReports()
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed", variant: "destructive" })
    } finally { setSavingReceive(false) }
  }

  const handleUpdatePOStatus = async (poId: number, status: string) => {
    try {
      await api.patch(`/suppliers/purchase-orders/${poId}/status`, { status })
      toast({ title: `Status updated to ${statusMeta[status]?.label}` })
      if (viewPO) {
        const res = await api.get(`/suppliers/purchase-orders/${poId}`)
        setViewPO(res.data.data)
      }
      fetchPOs()
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    }
  }

  const filteredPOs = pos.filter(po => {
    const supMatch = filterSupplier === "all" || po.supplier_id.toString() === filterSupplier
    const statusMatch = filterStatus === "all" || po.status === filterStatus
    return supMatch && statusMatch
  })

  // ─── Render ────────────────────────────────────────────

  const activeSups = suppliers.filter(s => s.status === "active").length
  const totalPOs = pos.length
  const pendingPOs = pos.filter(p => ["draft", "sent", "partially_received"].includes(p.status)).length

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck className="w-6 h-6 text-primary" />
              Supplier Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage vendors, purchase orders, and stock receiving</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Suppliers", value: suppliers.length, icon: Truck, color: "text-blue-400" },
            { label: "Active", value: activeSups, icon: CheckCircle2, color: "text-green-400" },
            { label: "Total POs", value: totalPOs, icon: ClipboardList, color: "text-purple-400" },
            { label: "Pending POs", value: pendingPOs, icon: AlertCircle, color: "text-yellow-400" },
          ].map(s => (
            <Card key={s.label} className="border border-white">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-8 h-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="suppliers">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="suppliers"><Truck className="w-4 h-4 mr-2" />Suppliers</TabsTrigger>
            <TabsTrigger value="orders"><ClipboardList className="w-4 h-4 mr-2" />Purchase Orders</TabsTrigger>
            <TabsTrigger value="reports"><BarChart2 className="w-4 h-4 mr-2" />Reports</TabsTrigger>
          </TabsList>

          {/* ── SUPPLIERS TAB ── */}
          <TabsContent value="suppliers" className="mt-4">
            <Card className="border border-white">
              <CardHeader className="pb-3 border-b border-white">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base">All Suppliers</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative w-56">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search..." className="pl-9 h-9" value={searchSup} onChange={e => setSearchSup(e.target.value)} />
                    </div>
                    <Button onClick={openCreateSup} size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                      <Plus className="w-4 h-4 mr-1" /> Add Supplier
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingSup ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : filteredSup.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No suppliers found</p>
                    <p className="text-sm">Add your first supplier to get started</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white bg-muted/30">
                          <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Contact</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Items</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">POs</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                          <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSup.map(s => (
                          <tr key={s.id} className="border-b border-white hover:bg-muted/20 transition-colors">
                            <td className="p-4">
                              <p className="font-semibold">{s.name}</p>
                              {s.address && <p className="text-xs text-muted-foreground mt-0.5">{s.address}</p>}
                            </td>
                            <td className="p-4">
                              {s.phone && s.phone !== "92" && <p className="text-sm">{formatPhone(s.phone)}</p>}
                              {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                              {(!s.phone || s.phone === "92") && !s.email && <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="p-4 text-center font-medium">{s.mapped_items}</td>
                            <td className="p-4 text-center font-medium">{s.total_pos}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                                {s.status === "active" ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleSup(s)} title={s.status === "active" ? "Deactivate" : "Activate"}>
                                  {s.status === "active"
                                    ? <ToggleRight className="w-4 h-4 text-green-500" />
                                    : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSup(s)}>
                                  <Edit2 className="w-4 h-4 text-blue-400" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteSup(s)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PURCHASE ORDERS TAB ── */}
          <TabsContent value="orders" className="mt-4">
            <Card className="border border-white">
              <CardHeader className="pb-3 border-b border-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Purchase Orders</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue placeholder="All Suppliers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Suppliers</SelectItem>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-9 w-40">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {PO_STATUSES.map(s => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => { setPoForm({ supplier_id: "", notes: "", expected_date: "" }); setPoItems([{ product_id: "", quantity_ordered: "", unit_cost: "" }]); setIsCreatePOOpen(true) }} className="bg-gradient-to-r from-primary to-secondary text-white">
                      <Plus className="w-4 h-4 mr-1" /> New PO
                    </Button>
                    <Button size="sm" variant="outline" onClick={fetchPOs}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingPO ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : filteredPOs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No purchase orders</p>
                    <p className="text-sm">Create your first PO to restock inventory</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white bg-muted/30">
                          <th className="text-left p-4 font-medium text-muted-foreground">PO #</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Supplier</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Items</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Total</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Expected</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                          <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPOs.map(po => {
                          const meta = statusMeta[po.status]
                          const Icon = meta.icon
                          return (
                            <tr key={po.id} className="border-b border-white hover:bg-muted/20 transition-colors">
                              <td className="p-4 font-mono font-semibold text-primary">PO-{String(po.po_number ?? po.id).padStart(4, "0")}</td>
                              <td className="p-4 font-medium">{po.supplier_name}</td>
                              <td className="p-4 text-muted-foreground">{po.item_count} item{po.item_count !== 1 ? "s" : ""}</td>
                              <td className="p-4 font-semibold">{fmt(po.total_value)}</td>
                              <td className="p-4 text-muted-foreground">
                                {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
                                  <Icon className="w-3 h-3" />{meta.label}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <Button variant="ghost" size="sm" onClick={() => openViewPO(po)} className="h-8 text-xs">
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── REPORTS TAB ── */}
          <TabsContent value="reports" className="mt-4">
            <Card className="border border-white">
              <CardHeader className="pb-3 border-b border-white">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Supplier Purchase Summary</CardTitle>
                  <Button size="sm" variant="outline" onClick={fetchReports} disabled={loadingReport}>
                    <RefreshCw className={`w-4 h-4 ${loadingReport ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingReport ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : reportStats.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No data yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white bg-muted/30">
                          <th className="text-left p-4 font-medium text-muted-foreground">Supplier</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                          <th className="text-right p-4 font-medium text-muted-foreground">Total POs</th>
                          <th className="text-right p-4 font-medium text-muted-foreground">Ordered Value</th>
                          <th className="text-right p-4 font-medium text-muted-foreground">Received Value</th>
                          <th className="text-right p-4 font-medium text-muted-foreground">Pending POs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportStats.map(s => (
                          <tr key={s.id} className="border-b border-white hover:bg-muted/20 transition-colors">
                            <td className="p-4">
                              <p className="font-semibold">{s.name}</p>
                              {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="p-4 text-right font-medium">{s.total_pos}</td>
                            <td className="p-4 text-right font-semibold">{fmt(s.total_ordered_value)}</td>
                            <td className="p-4 text-right font-semibold text-green-400">{fmt(s.total_received_value)}</td>
                            <td className="p-4 text-right">
                              {s.pending_pos > 0
                                ? <span className="text-yellow-400 font-medium">{s.pending_pos}</span>
                                : <span className="text-muted-foreground">0</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── CREATE SUPPLIER DIALOG ── */}
      <Dialog open={isCreateSupOpen} onOpenChange={setIsCreateSupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Add Supplier</DialogTitle>
            <DialogDescription>Register a new supplier or vendor.</DialogDescription>
          </DialogHeader>
          <SupplierFormFields data={supForm} onChange={setSupForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSupOpen(false)} disabled={savingSup}>Cancel</Button>
            <Button onClick={handleCreateSup} disabled={savingSup}>
              {savingSup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT SUPPLIER DIALOG ── */}
      <Dialog open={isEditSupOpen} onOpenChange={setIsEditSupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-400" /> Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier details.</DialogDescription>
          </DialogHeader>
          <SupplierFormFields data={supForm} onChange={setSupForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSupOpen(false)} disabled={savingSup}>Cancel</Button>
            <Button onClick={handleEditSup} disabled={savingSup}>
              {savingSup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE SUPPLIER DIALOG ── */}
      <Dialog open={isDeleteSupOpen} onOpenChange={setIsDeleteSupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" /> Delete Supplier</DialogTitle>
            <DialogDescription>
              Delete <strong>{selectedSup?.name}</strong>? This will not delete existing purchase orders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteSupOpen(false)} disabled={savingSup}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSup} disabled={savingSup}>
              {savingSup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE PO DIALOG ── */}
      <Dialog open={isCreatePOOpen} onOpenChange={setIsCreatePOOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /> Create Purchase Order</DialogTitle>
            <DialogDescription>Select supplier and add items to order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select value={poForm.supplier_id} onValueChange={v => setPoForm(p => ({ ...p, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.status === "active").map(s =>
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input type="date" value={poForm.expected_date} onChange={e => setPoForm(p => ({ ...p, expected_date: e.target.value }))} min={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Special instructions..." rows={2} value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Order Items</Label>
                <Button size="sm" variant="outline" onClick={addPOItemRow} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Row
                </Button>
              </div>
              <div className="rounded-lg border border-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Product</th>
                      <th className="text-left p-2 font-medium text-muted-foreground w-24">Qty</th>
                      <th className="text-left p-2 font-medium text-muted-foreground w-28">Unit Cost</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item, i) => (
                      <tr key={i} className="border-t border-white">
                        <td className="p-2">
                          <Select value={item.product_id} onValueChange={v => {
                            const prod = products.find(p => p.id.toString() === v)
                            updatePOItem(i, "product_id", v)
                            if (prod && !item.unit_cost) {
                              // no auto-fill needed
                            }
                          }}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent>
                              {products.map(p =>
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  {p.name}{p.sku ? ` (${p.sku})` : ""}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input type="number" min="1" placeholder="0" className="h-8" value={item.quantity_ordered} onChange={e => updatePOItem(i, "quantity_ordered", e.target.value)} />
                        </td>
                        <td className="p-2">
                          <Input type="number" min="0" step="0.01" placeholder="0.00" className="h-8" value={item.unit_cost} onChange={e => updatePOItem(i, "unit_cost", e.target.value)} />
                        </td>
                        <td className="p-2">
                          {poItems.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePOItemRow(i)}>
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Total */}
              <div className="flex justify-end text-sm font-semibold">
                Total: {fmt(poItems.reduce((sum, i) => sum + (parseFloat(i.unit_cost) || 0) * (parseInt(i.quantity_ordered) || 0), 0))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatePOOpen(false)} disabled={savingPO}>Cancel</Button>
            <Button onClick={handleCreatePO} disabled={savingPO}>
              {savingPO ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardList className="w-4 h-4 mr-2" />}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VIEW PO DIALOG ── */}
      <Dialog open={isViewPOOpen} onOpenChange={setIsViewPOOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewPO && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  PO-{String(viewPO.po_number ?? viewPO.id).padStart(4, "0")}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ml-2 ${statusMeta[viewPO.status].color}`}>
                    {statusMeta[viewPO.status].label}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Supplier: <strong>{viewPO.supplier_name}</strong>
                  {viewPO.supplier_phone && ` · ${viewPO.supplier_phone}`}
                  {viewPO.expected_date && ` · Expected: ${new Date(viewPO.expected_date).toLocaleDateString()}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status Updater */}
                {viewPO.status !== "received" && viewPO.status !== "cancelled" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Update Status:</span>
                    {PO_STATUSES.filter(s => s !== viewPO.status && s !== "partially_received").map(s => (
                      <Button key={s} size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdatePOStatus(viewPO.id, s)}>
                        {statusMeta[s].label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Items Table */}
                <div className="rounded-lg border border-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Ordered</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Received</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Unit Cost</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewPO.items.map(item => (
                        <tr key={item.id} className="border-t border-white">
                          <td className="p-3">
                            <p className="font-medium">{item.product_name}</p>
                            {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                            <p className="text-xs text-muted-foreground">Stock: {item.current_stock}</p>
                          </td>
                          <td className="p-3 text-right font-medium">{item.quantity_ordered}</td>
                          <td className="p-3 text-right">
                            <span className={item.quantity_received >= item.quantity_ordered ? "text-green-400 font-medium" : item.quantity_received > 0 ? "text-yellow-400 font-medium" : "text-muted-foreground"}>
                              {item.quantity_received}
                            </span>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">{fmt(item.unit_cost)}</td>
                          <td className="p-3 text-right font-semibold">{fmt(item.quantity_ordered * item.unit_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t border-white">
                      <tr>
                        <td colSpan={4} className="p-3 text-right font-semibold">Grand Total</td>
                        <td className="p-3 text-right font-bold text-primary">
                          {fmt(viewPO.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {viewPO.notes && (
                  <p className="text-sm text-muted-foreground border border-white rounded-lg p-3">{viewPO.notes}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewPOOpen(false)}>Close</Button>
                {["draft", "sent", "partially_received"].includes(viewPO.status) && (
                  <Button onClick={() => { openReceive(viewPO); setIsViewPOOpen(false) }} className="bg-gradient-to-r from-primary to-secondary text-white">
                    <PackageCheck className="w-4 h-4 mr-2" /> Receive Stock
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── RECEIVE STOCK DIALOG ── */}
      <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PackageCheck className="w-5 h-5 text-green-400" /> Receive Stock</DialogTitle>
            <DialogDescription>Enter quantities actually received. Inventory will be updated automatically.</DialogDescription>
          </DialogHeader>
          {viewPO && (
            <div className="space-y-3 py-2">
              {viewPO.items.filter(i => i.quantity_received < i.quantity_ordered).map(item => {
                const remaining = item.quantity_ordered - item.quantity_received
                return (
                  <div key={item.id} className="rounded-lg border border-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">Ordered: {item.quantity_ordered} · Received: {item.quantity_received} · Remaining: {remaining}</p>
                      </div>
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-32 shrink-0">Qty Receiving</Label>
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        placeholder={`Max ${remaining}`}
                        className="h-8"
                        value={receiveQtys[item.id] || ""}
                        onChange={e => setReceiveQtys(p => ({ ...p, [item.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                )
              })}
              {viewPO.items.every(i => i.quantity_received >= i.quantity_ordered) && (
                <p className="text-sm text-green-400 text-center py-2">All items have been fully received.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsReceiveOpen(false); setIsViewPOOpen(true) }} disabled={savingReceive}>Back</Button>
            <Button onClick={handleReceiveStock} disabled={savingReceive} className="bg-gradient-to-r from-green-600 to-green-500 text-white">
              {savingReceive ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PackageCheck className="w-4 h-4 mr-2" />}
              Confirm Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

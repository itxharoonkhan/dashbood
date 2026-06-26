"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Tag, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Loader2, Search, Calendar, Percent, DollarSign, Hash
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

interface FormData {
  code: string
  type: "flat" | "percentage"
  value: string
  min_order_value: string
  usage_limit: string
  expiry_date: string
  is_active: boolean
}

function CouponForm({ formData, setFormData }: { formData: FormData; setFormData: React.Dispatch<React.SetStateAction<FormData>> }) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Promo Code *</Label>
          <Input
            placeholder="e.g. SAVE20"
            value={formData.code}
            onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
            className="uppercase"
          />
        </div>
        <div className="space-y-2">
          <Label>Discount Type *</Label>
          <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="flat">Flat Amount (Rs.)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount Value *</Label>
          <div className="relative">
            {formData.type === "percentage"
              ? <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              : <span className="absolute left-3 top-2 text-sm text-muted-foreground font-medium">Rs.</span>}
            <Input
              type="number"
              placeholder={formData.type === "percentage" ? "e.g. 15" : "e.g. 100"}
              className="pl-9"
              value={formData.value}
              onChange={e => setFormData(p => ({ ...p, value: e.target.value }))}
              min="0"
              max={formData.type === "percentage" ? "100" : undefined}
            />
          </div>
          {formData.type === "percentage" && formData.value && (
            <p className="text-xs text-muted-foreground">{formData.value}% off on subtotal</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Min Order Value</Label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-sm text-muted-foreground font-medium">Rs.</span>
            <Input
              type="number"
              placeholder="0 = no minimum"
              className="pl-9"
              value={formData.min_order_value}
              onChange={e => setFormData(p => ({ ...p, min_order_value: e.target.value }))}
              min="0"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Usage Limit</Label>
          <Input
            type="number"
            placeholder="Leave empty = unlimited"
            value={formData.usage_limit}
            onChange={e => setFormData(p => ({ ...p, usage_limit: e.target.value }))}
            min="1"
          />
        </div>
        <div className="space-y-2">
          <Label>Expiry Date</Label>
          <Input
            type="date"
            value={formData.expiry_date}
            onChange={e => {
              const val = e.target.value
              const year = val ? parseInt(val.split("-")[0]) : 0
              if (!val || year <= 9999) setFormData(p => ({ ...p, expiry_date: val }))
            }}
            min={new Date().toISOString().split("T")[0]}
            max="9999-12-31"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white p-3 bg-muted/20">
        <div>
          <p className="text-sm font-medium">Active Status</p>
          <p className="text-xs text-muted-foreground">Inactive coupons cannot be applied at checkout</p>
        </div>
        <Switch
          checked={formData.is_active}
          onCheckedChange={v => setFormData(p => ({ ...p, is_active: v }))}
        />
      </div>
    </div>
  )
}

interface Coupon {
  id: number
  code: string
  type: "flat" | "percentage"
  value: number
  min_order_value: number
  usage_limit: number | null
  used_count: number
  expiry_date: string | null
  is_active: number
  created_at: string
}

const emptyForm = {
  code: "",
  type: "percentage" as "flat" | "percentage",
  value: "",
  min_order_value: "",
  usage_limit: "",
  expiry_date: "",
  is_active: true,
}

export default function CouponsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [coupons, setCoupons] = React.useState<Coupon[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [selectedCoupon, setSelectedCoupon] = React.useState<Coupon | null>(null)
  const [formData, setFormData] = React.useState<FormData>(emptyForm)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    const role = localStorage.getItem("userRole")
    if (role !== "admin") router.replace("/dashboard")
  }, [router])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const res = await api.get("/coupons")
      setCoupons(res.data.data || [])
    } catch {
      toast({ title: "Error", description: "Failed to fetch coupons", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchCoupons() }, [])

  const filtered = coupons.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const activeCoupons = coupons.filter(c => c.is_active).length
  const totalUsed = coupons.reduce((s, c) => s + c.used_count, 0)

  const openCreate = () => {
    setFormData(emptyForm)
    setIsCreateOpen(true)
  }

  const openEdit = (c: Coupon) => {
    setSelectedCoupon(c)
    setFormData({
      code: c.code,
      type: c.type,
      value: c.value.toString(),
      min_order_value: c.min_order_value ? c.min_order_value.toString() : "",
      usage_limit: c.usage_limit !== null ? c.usage_limit.toString() : "",
      expiry_date: c.expiry_date ? c.expiry_date.split("T")[0] : "",
      is_active: c.is_active === 1,
    })
    setIsEditOpen(true)
  }

  const openDelete = (c: Coupon) => {
    setSelectedCoupon(c)
    setIsDeleteOpen(true)
  }

  const validateForm = () => {
    if (!formData.code.trim()) return "Promo code is required"
    if (!formData.value || isNaN(parseFloat(formData.value))) return "Value is required"
    if (parseFloat(formData.value) <= 0) return "Value must be greater than 0"
    if (formData.type === "percentage" && parseFloat(formData.value) > 100) return "Percentage cannot exceed 100"
    return null
  }

  const handleCreate = async () => {
    const err = validateForm()
    if (err) { toast({ title: "Validation", description: err, variant: "destructive" }); return }
    setSaving(true)
    try {
      await api.post("/coupons", {
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value),
        min_order_value: formData.min_order_value ? parseFloat(formData.min_order_value) : 0,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        expiry_date: formData.expiry_date || null,
        is_active: formData.is_active,
      })
      toast({ title: "Success!", description: "Coupon created successfully" })
      setIsCreateOpen(false)
      fetchCoupons()
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed to create coupon", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedCoupon) return
    const err = validateForm()
    if (err) { toast({ title: "Validation", description: err, variant: "destructive" }); return }
    setSaving(true)
    try {
      await api.put(`/coupons/${selectedCoupon.id}`, {
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value),
        min_order_value: formData.min_order_value ? parseFloat(formData.min_order_value) : 0,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        expiry_date: formData.expiry_date || null,
        is_active: formData.is_active,
      })
      toast({ title: "Updated!", description: "Coupon updated successfully" })
      setIsEditOpen(false)
      fetchCoupons()
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed to update coupon", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (c: Coupon) => {
    try {
      const res = await api.patch(`/coupons/${c.id}/toggle`)
      toast({ title: res.data.message })
      fetchCoupons()
    } catch {
      toast({ title: "Error", description: "Failed to toggle coupon", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!selectedCoupon) return
    setSaving(true)
    try {
      await api.delete(`/coupons/${selectedCoupon.id}`)
      toast({ title: "Deleted!", description: `Coupon ${selectedCoupon.code} removed` })
      setIsDeleteOpen(false)
      fetchCoupons()
    } catch {
      toast({ title: "Error", description: "Failed to delete coupon", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const isExpired = (date: string | null) => {
    if (!date) return false
    return new Date(date) < new Date()
  }

  const getStatus = (c: Coupon) => {
    if (!c.is_active) return { label: "Inactive", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" }
    if (isExpired(c.expiry_date)) return { label: "Expired", color: "bg-red-500/20 text-red-400 border-red-500/30" }
    if (c.usage_limit !== null && c.used_count >= c.usage_limit) return { label: "Exhausted", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" }
    return { label: "Active", color: "bg-green-500/20 text-green-400 border-green-500/30" }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Tag className="w-6 h-6 text-primary" />
              Discount Coupons
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage promotional coupon codes</p>
          </div>
          <Button onClick={openCreate} className="bg-gradient-to-r from-primary to-secondary text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Coupon
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Coupons", value: coupons.length, icon: Tag, color: "text-blue-400" },
            { label: "Active", value: activeCoupons, icon: ToggleRight, color: "text-green-400" },
            { label: "Total Used", value: totalUsed, icon: Hash, color: "text-purple-400" },
            { label: "Inactive", value: coupons.length - activeCoupons, icon: ToggleLeft, color: "text-gray-400" },
          ].map(stat => (
            <Card key={stat.label} className="border border-white">
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + Table */}
        <Card className="border border-white">
          <CardHeader className="pb-3 border-b border-white">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">All Coupons</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code..."
                  className="pl-9 h-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No coupons found</p>
                <p className="text-sm">Create your first coupon to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white bg-muted/30">
                      <th className="text-left p-4 font-medium text-muted-foreground">Code</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Value</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Min Order</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Usage</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Expiry</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const status = getStatus(c)
                      return (
                        <tr key={c.id} className="border-b border-white hover:bg-muted/20 transition-colors">
                          <td className="p-4">
                            <span className="font-mono font-bold text-primary text-base tracking-wider">{c.code}</span>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {c.type === "percentage" ? <Percent className="w-3 h-3 mr-1" /> : null}
                              {c.type === "percentage" ? "Percentage" : "Flat"}
                            </Badge>
                          </td>
                          <td className="p-4 font-semibold">
                            {c.type === "percentage" ? `${c.value}%` : `Rs. ${c.value}`}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {c.min_order_value > 0 ? `Rs. ${c.min_order_value}` : "—"}
                          </td>
                          <td className="p-4">
                            <span className="text-foreground font-medium">{c.used_count}</span>
                            <span className="text-muted-foreground"> / {c.usage_limit ?? "∞"}</span>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {c.expiry_date
                              ? <span className={isExpired(c.expiry_date) ? "text-red-400" : ""}>{new Date(c.expiry_date).toLocaleDateString()}</span>
                              : "No expiry"}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => handleToggle(c)}
                                title={c.is_active ? "Deactivate" : "Activate"}
                              >
                                {c.is_active
                                  ? <ToggleRight className="w-4 h-4 text-green-500" />
                                  : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => openEdit(c)}
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4 text-blue-400" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => openDelete(c)}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
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
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Create Coupon
            </DialogTitle>
            <DialogDescription>Fill in the details to create a new promo code.</DialogDescription>
          </DialogHeader>
          <CouponForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-400" /> Edit Coupon
            </DialogTitle>
            <DialogDescription>Update coupon details. Used count won't be reset.</DialogDescription>
          </DialogHeader>
          <CouponForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Coupon
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete coupon <strong>{selectedCoupon?.code}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

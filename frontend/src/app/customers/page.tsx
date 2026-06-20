"use client"

import * as React from "react"
import { Search, Mail, Phone, Calendar, DollarSign, Loader2, Plus, Edit, Trash2, MapPin, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { PhoneInput, isValidPhone, formatPhone } from "@/components/ui/phone-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import { AxiosError } from "axios"

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  pincode: string
  gst_number: string
  created_at: string
  joinedDate: string
  totalOrders: number
  totalSpent: number
  loyalty_points: number
  status: "active" | "inactive"
}

export default function CustomersPage() {
  const { toast } = useToast()
  const { t, isRTL } = useLanguage()
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "", email: "", phone: "", address: "", city: "", pincode: "", gst_number: "",
  })

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const res = await api.get("/customers")
      let data = res.data.data || []
      const mapped = (Array.isArray(data) ? data : []).map((c: any) => ({
        id: c.id?.toString() || "",
        name: c.name || "Unknown",
        email: c.email || "",
        phone: c.phone || "",
        address: c.address || "",
        city: c.city || "",
        pincode: c.pincode || "",
        gst_number: c.gst_number || "",
        created_at: c.created_at || new Date().toISOString(),
        joinedDate: c.created_at || new Date().toISOString(),
        totalOrders: parseInt(c.totalOrders || 0),
        totalSpent: parseFloat(c.totalSpent || 0),
        loyalty_points: parseInt(c.loyalty_points || 0),
        status: "active" as const,
      }))
      setCustomers(mapped)
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: axiosError.response?.data?.message || "Failed to load customers", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchCustomers() }, [])

  const resetForm = () => setFormData({ name: "", email: "", phone: "92", address: "", city: "", pincode: "", gst_number: "" })

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Missing field", description: "Customer name is required.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await api.post("/customers", formData)
      const newCust = await api.get(`/customers/${res.data.id || res.data.data?.id}`)
      const mapped = {
        id: newCust.data.data.id.toString(),
        name: newCust.data.data.name || formData.name,
        email: newCust.data.data.email || formData.email,
        phone: newCust.data.data.phone || formData.phone,
        address: newCust.data.data.address || formData.address,
        city: newCust.data.data.city || formData.city,
        pincode: newCust.data.data.pincode || formData.pincode,
        gst_number: newCust.data.data.gst_number || formData.gst_number,
        created_at: newCust.data.data.created_at || new Date().toISOString(),
        joinedDate: newCust.data.data.created_at || new Date().toISOString(),
        totalOrders: parseInt(newCust.data.data.totalOrders || 0),
        totalSpent: parseFloat(newCust.data.data.totalSpent || 0),
        loyalty_points: parseInt(newCust.data.data.loyalty_points || 0),
        status: "active" as const,
      }
      setCustomers(prev => [mapped, ...prev])
      setIsAddOpen(false)
      resetForm()
      toast({ title: "Customer added", description: `${mapped.name} has been added.` })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to add customer", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingCustomer) return
    setSaving(true)
    try {
      const res = await api.put(`/customers/${editingCustomer.id}`, {
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        address: editingCustomer.address,
        city: editingCustomer.city,
        pincode: editingCustomer.pincode,
        gst_number: editingCustomer.gst_number,
      })
      const updated = res.data.data
      setCustomers(prev => prev.map(c => c.id === updated.id.toString() ? {
        ...c, name: updated.name || "", email: updated.email || "", phone: updated.phone || "",
        address: updated.address || "", city: updated.city || "", pincode: updated.pincode || "",
        gst_number: updated.gst_number || "",
      } : c))
      setEditingCustomer(null)
      toast({ title: "Customer updated", description: `${updated.name} has been updated.` })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update customer", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.delete(`/customers/${id}`)
      setCustomers(prev => prev.filter(c => c.id !== id))
      toast({ title: "Customer deleted", description: `${name} has been removed.`, variant: "destructive" })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to delete customer", variant: "destructive" })
    }
  }

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === "active").length,
    revenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  )

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  if (loading) {
    return (
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex flex-col gap-1">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (<Card key={i}><CardContent className="pt-6"><div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" /><div className="h-8 w-16 bg-muted rounded animate-pulse" /></CardContent></Card>))}
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">{t('customers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.subtitle') || "Manage your customer base"}</p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddOpen(true) }} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /><span>{t('customers.addCustomer') || "Add Customer"}</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('customers.totalCustomers')}</CardTitle>
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">{t('customers.allTime') || "Total customers"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('customers.active')}</CardTitle>
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold text-green-500">{stats.active}</div><p className="text-xs text-muted-foreground">{t('customers.activeCustomers') || "Active customers"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('customers.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold">Rs. {stats.revenue.toLocaleString()}</div><p className="text-xs text-muted-foreground">{t('customers.fromAllCustomers') || "From all customers"}</p></CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-3 xs:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('customers.searchPlaceholder') || "Search by name, phone or email..."} 
              className="pl-10 bg-muted/30 focus:bg-card transition-colors" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCustomers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-12 pb-12 text-center">
              <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">{customers.length === 0 ? "No customers yet. Add your first customer!" : `No customers match "${searchTerm}"`}</p>
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary/20 text-primary font-semibold">{getInitials(customer.name)}</AvatarFallback></Avatar>
                    <div>
                      <CardTitle className="text-lg">{customer.name}</CardTitle>
                      <Badge variant={customer.status === "active" ? "default" : "secondary"} className="mt-1">{customer.status}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-4 h-4" /><span>{customer.email}</span></div>}
                {customer.phone && customer.phone !== "92" && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4" /><span>{formatPhone(customer.phone)}</span></div>}
                {(customer.address || customer.city) && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="w-4 h-4" /><span>{[customer.address, customer.city].filter(Boolean).join(", ")}</span></div>}
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-4 h-4" /><span>Joined {new Date(customer.joinedDate).toLocaleDateString()}</span></div>
                <Separator />
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-lg font-bold">{customer.totalOrders}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total Spent</p><p className="text-lg font-bold text-primary">Rs. {customer.totalSpent.toLocaleString()}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Loyalty Pts</p>
                    <p className={`text-lg font-bold ${customer.loyalty_points > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                      ⭐ {customer.loyalty_points}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingCustomer(customer)}><Edit className="w-4 h-4 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(customer.id, customer.name)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('customers.addCustomer') || "Add Customer"}</DialogTitle><DialogDescription>Enter customer details below.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Customer name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Email</Label><Input value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></div>
              <PhoneInput id="add-phone" label="Phone" value={formData.phone} onChange={(v) => setFormData(p => ({ ...p, phone: v }))} />
            </div>
            <div className="grid gap-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))} placeholder="Street address" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>City</Label><Input value={formData.city} onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="City" /></div>
              <div className="grid gap-2"><Label>PIN/ZIP Code</Label><Input value={formData.pincode} onChange={(e) => setFormData(p => ({ ...p, pincode: e.target.value }))} placeholder="00000" /></div>
            </div>
            <div className="grid gap-2"><Label>GST Number</Label><Input value={formData.gst_number} onChange={(e) => setFormData(p => ({ ...p, gst_number: e.target.value }))} placeholder="GSTIN" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding..." : "Add Customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          {editingCustomer && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Name *</Label><Input value={editingCustomer.name ?? ""} onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Email</Label><Input value={editingCustomer.email ?? ""} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} /></div>
                <PhoneInput id="edit-phone" label="Phone" value={editingCustomer.phone || "92"} onChange={(v) => setEditingCustomer({ ...editingCustomer, phone: v })} />
              </div>
              <div className="grid gap-2"><Label>Address</Label><Input value={editingCustomer.address ?? ""} onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>City</Label><Input value={editingCustomer.city ?? ""} onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })} /></div>
                <div className="grid gap-2"><Label>PIN/ZIP Code</Label><Input value={editingCustomer.pincode ?? ""} onChange={(e) => setEditingCustomer({ ...editingCustomer, pincode: e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>GST Number</Label><Input value={editingCustomer.gst_number ?? ""} onChange={(e) => setEditingCustomer({ ...editingCustomer, gst_number: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingCustomer(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  )
}

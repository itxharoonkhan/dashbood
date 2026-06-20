"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Building2, Plus, RefreshCw, Users, DollarSign,
  ShoppingCart, CheckCircle, XCircle, AlertCircle,
  Trash2, Edit, Loader2, LogOut
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

interface Tenant {
  id: number
  name: string
  email: string
  slug: string
  status: 'active' | 'inactive' | 'suspended'
  plan: 'basic' | 'pro' | 'enterprise'
  created_at: string
  user_count: number
  sale_count: number
  total_revenue: number
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  inactive: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  suspended: "bg-red-500/10 text-red-600 border-red-500/20",
}

const planColors: Record<string, string> = {
  basic: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  pro: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  enterprise: "bg-purple-500/10 text-purple-600 border-purple-500/20",
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'active') return <CheckCircle className="w-3.5 h-3.5" />
  if (status === 'suspended') return <XCircle className="w-3.5 h-3.5" />
  return <AlertCircle className="w-3.5 h-3.5" />
}

export default function SuperAdminPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { logout } = useAuth()

  const [tenants, setTenants] = React.useState<Tenant[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [selectedTenant, setSelectedTenant] = React.useState<Tenant | null>(null)

  const [form, setForm] = React.useState({
    name: "",
    email: "",
    slug: "",
    plan: "basic",
    mode: "retail",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  })

  const [editForm, setEditForm] = React.useState({
    name: "",
    status: "active",
    plan: "basic",
  })

  // Guard: only superadmin can see this page
  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    if (role !== 'superadmin') {
      router.push('/login')
    }
  }, [router])

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const res = await api.get('/tenants')
      setTenants(res.data.data || [])
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to fetch tenants",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchTenants()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.slug || !form.admin_email || !form.admin_password) {
      toast({ title: "Missing Fields", description: "All required fields must be filled.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await api.post('/tenants', form)
      toast({ title: "Success", description: "Tenant created successfully!" })
      setIsAddOpen(false)
      setForm({ name: "", email: "", slug: "", plan: "basic", mode: "retail", admin_name: "", admin_email: "", admin_password: "" })
      fetchTenants()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to create tenant",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditOpen = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setEditForm({ name: tenant.name, status: tenant.status, plan: tenant.plan })
    setIsEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenant) return
    setSaving(true)
    try {
      await api.put(`/tenants/${selectedTenant.id}`, editForm)
      toast({ title: "Success", description: "Tenant updated successfully!" })
      setIsEditOpen(false)
      fetchTenants()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to update tenant",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSuspend = async (tenant: Tenant) => {
    if (!confirm(`Suspend tenant "${tenant.name}"? Users will lose access.`)) return
    try {
      await api.delete(`/tenants/${tenant.id}`)
      toast({ title: "Tenant Suspended", description: `${tenant.name} has been suspended.` })
      fetchTenants()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to suspend tenant",
        variant: "destructive"
      })
    }
  }

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const totalRevenue = tenants.reduce((s, t) => s + parseFloat(String(t.total_revenue || 0)), 0)
  const activeTenants = tenants.filter(t => t.status === 'active').length
  const totalUsers = tenants.reduce((s, t) => s + (t.user_count || 0), 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Super Admin — Tenant Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all business tenants on this platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTenants} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Tenant
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground">{activeTenants} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <Users className="w-5 h-5 text-blue-500" />
              {totalUsers}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <DollarSign className="w-5 h-5 text-green-500" />
              {totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">Across all tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <ShoppingCart className="w-5 h-5 text-purple-500" />
              {tenants.reduce((s, t) => s + (t.sale_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Building2 className="w-10 h-10 mb-2 opacity-40" />
              <p>No tenants found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs capitalize border ${planColors[tenant.plan] || ''}`} variant="outline">
                        {tenant.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs capitalize border flex items-center gap-1 w-fit ${statusColors[tenant.status] || ''}`} variant="outline">
                        <StatusIcon status={tenant.status} />
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{tenant.user_count}</TableCell>
                    <TableCell className="text-right">{tenant.sale_count}</TableCell>
                    <TableCell className="text-right">
                      Rs. {parseFloat(String(tenant.total_revenue || 0)).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditOpen(tenant)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {tenant.id !== 1 && tenant.status !== 'suspended' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleSuspend(tenant)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Tenant Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create New Tenant
            </DialogTitle>
            <DialogDescription>
              Fill in the business details and create an admin account for this tenant.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Business Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      setForm(p => ({ ...p, name: e.target.value, slug: autoSlug(e.target.value) }))
                    }}
                    placeholder="My Shop"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm(p => ({ ...p, slug: e.target.value }))}
                    placeholder="my-shop"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Business Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="shop@example.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm(p => ({ ...p, plan: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Business Mode *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, mode: "retail" }))}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${form.mode === "retail" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}
                    >
                      <span className="text-xl mb-1">🛒</span>
                      <span className="text-sm font-medium">Retail</span>
                      <span className="text-xs text-muted-foreground">Shop / Store</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, mode: "restaurant" }))}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${form.mode === "restaurant" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}
                    >
                      <span className="text-xl mb-1">🍽️</span>
                      <span className="text-sm font-medium">Restaurant</span>
                      <span className="text-xs text-muted-foreground">Tables / KOT</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Admin Name</Label>
                  <Input
                    value={form.admin_name}
                    onChange={(e) => setForm(p => ({ ...p, admin_name: e.target.value }))}
                    placeholder="Store Admin"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Admin Email *</Label>
                  <Input
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setForm(p => ({ ...p, admin_email: e.target.value }))}
                    placeholder="admin@myshop.com"
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Admin Password *</Label>
                  <Input
                    type="password"
                    value={form.admin_password}
                    onChange={(e) => setForm(p => ({ ...p, admin_password: e.target.value }))}
                    placeholder="Secure password"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Edit Tenant
            </DialogTitle>
            <DialogDescription>
              Update {selectedTenant?.name} settings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Business Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm(p => ({ ...p, plan: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

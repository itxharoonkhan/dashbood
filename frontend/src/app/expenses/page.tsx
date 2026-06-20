"use client"

import * as React from "react"
import {
  TrendingDown, Plus, Edit, Trash2, Search, Calendar,
  Loader2, Receipt, Filter, X, Wallet, CreditCard, Banknote,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: number
  title: string
  amount: number
  category: string
  payment_method: string
  notes: string | null
  expense_date: string
  created_by: number
  created_by_name: string
  shift_id: number | null
  created_at: string
}

interface Summary {
  byCategory: { category: string; total: number }[]
  byMonth: { month: string; total: number }[]
  totals: { total_all: number; today: number; this_month: number; total_entries: number }
}

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Supplies", "Maintenance", "Marketing", "Other"] as const

const CATEGORY_COLORS: Record<string, string> = {
  Rent: "#ef4444",
  Utilities: "#3b82f6",
  Salaries: "#8b5cf6",
  Supplies: "#f97316",
  Maintenance: "#eab308",
  Marketing: "#22c55e",
  Other: "#6b7280",
}

const CATEGORY_BADGE: Record<string, string> = {
  Rent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Utilities: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Salaries: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Supplies: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Maintenance: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Marketing: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const PM_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-3.5 h-3.5" />,
  card: <CreditCard className="w-3.5 h-3.5" />,
  wallet: <Wallet className="w-3.5 h-3.5" />,
}

const fmt = (n: number) =>
  "Rs. " + Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const today = () => new Date().toISOString().split("T")[0]

const EMPTY_FORM = {
  title: "",
  amount: "",
  category: "Other",
  payment_method: "cash",
  notes: "",
  expense_date: today(),
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { toast } = useToast()
  const userRole = typeof window !== "undefined" ? localStorage.getItem("userRole") || "cashier" : "cashier"
  const isAdmin = userRole === "admin"

  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [filterCategory, setFilterCategory] = React.useState("")
  const [filterFrom, setFilterFrom] = React.useState("")
  const [filterTo, setFilterTo] = React.useState("")

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null)
  const [form, setForm] = React.useState({ ...EMPTY_FORM })
  const [saving, setSaving] = React.useState(false)

  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = React.useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (filterFrom) params.from = filterFrom
      if (filterTo) params.to = filterTo
      if (filterCategory) params.category = filterCategory

      const [expRes, sumRes] = await Promise.all([
        api.get("/expenses", { params }),
        isAdmin ? api.get("/expenses/summary", { params }) : Promise.resolve(null),
      ])

      setExpenses(expRes.data.data || [])
      if (sumRes) setSummary(sumRes.data.data)
    } catch {
      toast({ title: "Error", description: "Failed to load expenses", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, filterCategory, isAdmin])

  React.useEffect(() => { fetchAll() }, [fetchAll])

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingExpense(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setForm({
      title: exp.title,
      amount: String(exp.amount),
      category: exp.category,
      payment_method: exp.payment_method,
      notes: exp.notes || "",
      expense_date: exp.expense_date.split("T")[0],
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingExpense(null)
    setForm({ ...EMPTY_FORM })
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return toast({ title: "Title required", variant: "destructive" })
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0)
      return toast({ title: "Enter a valid amount", variant: "destructive" })

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        amount: amt,
        category: form.category,
        payment_method: form.payment_method,
        notes: form.notes.trim() || null,
        expense_date: form.expense_date,
      }

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, payload)
        toast({ title: "Expense updated" })
      } else {
        await api.post("/expenses", payload)
        toast({ title: "Expense added" })
      }

      closeDialog()
      fetchAll()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to save",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/expenses/${deleteId}`)
      toast({ title: "Expense deleted" })
      setDeleteId(null)
      fetchAll()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = expenses.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase()) ||
    (e.notes || "").toLowerCase().includes(search.toLowerCase())
  )

  const clearFilters = () => {
    setFilterFrom("")
    setFilterTo("")
    setFilterCategory("")
    setSearch("")
  }

  const hasFilters = filterFrom || filterTo || filterCategory || search

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-6 p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-red-500" />
              Expenses
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track all business expenses</p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> Add Expense
          </Button>
        </div>

        {/* Stat Cards (admin only) */}
        {isAdmin && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Today</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-500">{fmt(summary.totals.today)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">This Month</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-500">{fmt(summary.totals.this_month)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total (Period)</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{fmt(summary.totals.total_all)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entries</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{summary.totals.total_entries}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Chart + Filters row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Category Chart */}
          {isAdmin && summary && summary.byCategory.length > 0 && (
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={summary.byCategory}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                    >
                      {summary.byCategory.map((entry) => (
                        <Cell
                          key={entry.category}
                          fill={CATEGORY_COLORS[entry.category] || "#6b7280"}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend
                      formatter={(value) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card className={isAdmin && summary && summary.byCategory.length > 0 ? "md:col-span-2" : "md:col-span-3"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" />Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expenses..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 items-center">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="flex-1" />
                <span className="text-muted-foreground text-sm">to</span>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="flex-1" />
                {hasFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Receipt className="w-10 h-10 opacity-30" />
                <p className="text-sm">No expenses found</p>
                <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add First Expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      {isAdmin && <th className="text-left px-4 py-3 font-medium text-muted-foreground">By</th>}
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((exp, i) => (
                      <tr key={exp.id} className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(exp.expense_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 font-medium">{exp.title}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[exp.category] || CATEGORY_BADGE.Other}`}>
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-muted-foreground capitalize">
                            {PM_ICON[exp.payment_method]}
                            {exp.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-500">
                          {fmt(exp.amount)}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-muted-foreground text-xs">{exp.created_by_name}</td>
                        )}
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                          {exp.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(exp.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total row */}
                  <tfoot>
                    <tr className="border-t bg-muted/20">
                      <td colSpan={isAdmin ? 4 : 3} className="px-4 py-3 text-sm font-medium text-muted-foreground">
                        {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-500">
                        {fmt(filtered.reduce((s, e) => s + parseFloat(String(e.amount)), 0))}
                      </td>
                      <td colSpan={isAdmin ? 3 : 2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                {editingExpense ? "Edit Expense" : "Add Expense"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 py-1">
              {/* Title */}
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Monthly Rent"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div className="space-y-1.5">
                  <Label>Amount (Rs.) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label>Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="wallet">Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  placeholder="Any additional details..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editingExpense ? "Update" : "Add Expense"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </ProtectedRoute>
  )
}

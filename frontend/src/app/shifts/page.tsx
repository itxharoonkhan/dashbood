"use client"

import * as React from "react"
import {
  Clock,
  PlayCircle,
  StopCircle,
  Printer,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  ShoppingBag,
  Trash2,
  ArrowDownCircle,
  Search,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

// ─── helpers ────────────────────────────────────────────────────────────────

const formatPKR = (rupees: number | null | undefined): string => {
  if (rupees === null || rupees === undefined) return "Rs. —"
  const formatted = Math.abs(rupees)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `Rs. ${formatted}`
}

const formatDateTime = (dt: string | null): string => {
  if (!dt) return "—"
  return new Date(dt).toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const formatDuration = (start: string, end: string | null): string => {
  const from = new Date(start).getTime()
  const to = end ? new Date(end).getTime() : Date.now()
  const diff = Math.floor((to - from) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return `${h}h ${m}m`
}

// ─── types ───────────────────────────────────────────────────────────────────

interface CashMovement {
  id: number
  type: "cash_out" | "cash_in"
  amount_rupees: number
  reason: string | null
  created_at: string
}

interface Shift {
  id: number
  cashier_id: number
  cashier_name: string
  status: "open" | "closed"
  start_time: string
  end_time: string | null
  opening_cash_rupees: number
  closing_cash_rupees: number | null
  expected_cash_rupees: number | null
  variance_rupees: number | null
  total_sales_rupees: number
  transaction_count: number
  total_cash_out_rupees?: number
  movements?: CashMovement[]
}

// ─── printable report ────────────────────────────────────────────────────────

function ShiftReportPrint({ shift }: { shift: Shift }) {
  const variance = shift.variance_rupees ?? 0

  return (
    <div
      id="shift-report-print"
      style={{
        fontFamily: "monospace",
        maxWidth: 300,
        margin: "0 auto",
        padding: 8,
        background: "#fff",
        color: "#000",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: "bold" }}>
          END-OF-SHIFT REPORT
        </h2>
        <p style={{ margin: "2px 0", fontSize: 10 }}>Elites POS System</p>
        <p style={{ margin: "2px 0", fontSize: 10, color: "#555" }}>
          Printed: {formatDateTime(new Date().toISOString())}
        </p>
      </div>

      <hr style={{ borderTop: "1px dashed #000", margin: "10px 0" }} />

      <table style={{ width: "100%", fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ paddingBottom: 2 }}>Cashier</td>
            <td style={{ textAlign: "right", fontWeight: "bold" }}>
              {shift.cashier_name}
            </td>
          </tr>
          <tr>
            <td style={{ paddingBottom: 2 }}>Shift #</td>
            <td style={{ textAlign: "right" }}>{shift.id}</td>
          </tr>
          <tr>
            <td style={{ paddingBottom: 2 }}>Start</td>
            <td style={{ textAlign: "right" }}>
              {formatDateTime(shift.start_time)}
            </td>
          </tr>
          <tr>
            <td style={{ paddingBottom: 2 }}>End</td>
            <td style={{ textAlign: "right" }}>
              {formatDateTime(shift.end_time)}
            </td>
          </tr>
          <tr>
            <td style={{ paddingBottom: 2 }}>Duration</td>
            <td style={{ textAlign: "right" }}>
              {formatDuration(shift.start_time, shift.end_time)}
            </td>
          </tr>
        </tbody>
      </table>

      <hr style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <table style={{ width: "100%", fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ paddingBottom: 6 }}>Opening Cash</td>
            <td style={{ textAlign: "right" }}>
              {formatPKR(shift.opening_cash_rupees)}
            </td>
          </tr>
          <tr>
            <td style={{ paddingBottom: 6 }}>
              Total Sales ({shift.transaction_count} txns)
            </td>
            <td style={{ textAlign: "right" }}>
              {formatPKR(shift.total_sales_rupees)}
            </td>
          </tr>
          {(shift.total_cash_out_rupees ?? 0) > 0 && (
            <tr>
              <td style={{ paddingBottom: 6, color: "#c05c00" }}>Cash Out</td>
              <td style={{ textAlign: "right", color: "#c05c00" }}>
                - {formatPKR(shift.total_cash_out_rupees)}
              </td>
            </tr>
          )}
          <tr>
            <td style={{ paddingBottom: 6 }}>Expected Cash</td>
            <td style={{ textAlign: "right" }}>
              {formatPKR(shift.expected_cash_rupees)}
            </td>
          </tr>
          <tr>
            <td style={{ paddingBottom: 6 }}>Actual Cash Counted</td>
            <td style={{ textAlign: "right" }}>
              {formatPKR(shift.closing_cash_rupees)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cash Out Movements Detail */}
      {shift.movements && shift.movements.filter(m => m.type === 'cash_out').length > 0 && (
        <>
          <hr style={{ borderTop: "1px dashed #000", margin: "10px 0" }} />
          <p style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>CASH OUT DETAIL:</p>
          <table style={{ width: "100%", fontSize: 11 }}>
            <tbody>
              {shift.movements.filter(m => m.type === 'cash_out').map(m => (
                <tr key={m.id}>
                  <td style={{ paddingBottom: 3, color: "#555" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.reason ? ` — ${m.reason}` : ''}
                  </td>
                  <td style={{ textAlign: "right", color: "#c05c00" }}>
                    - {formatPKR(m.amount_rupees)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <hr style={{ borderTop: "2px solid #000", margin: "6px 0" }} />

      <table style={{ width: "100%", fontSize: 12, fontWeight: "bold" }}>
        <tbody>
          <tr>
            <td>Cash Variance</td>
            <td
              style={{
                textAlign: "right",
                color: variance < 0 ? "red" : variance > 0 ? "green" : "black",
              }}
            >
              {variance < 0 ? "- " : variance > 0 ? "+ " : ""}
              {formatPKR(Math.abs(variance))}
            </td>
          </tr>
        </tbody>
      </table>

      <hr style={{ borderTop: "1px dashed #000", margin: "10px 0" }} />
      <p style={{ textAlign: "center", fontSize: 10, color: "#666", margin: 0 }}>
        Thank you — Elites POS
      </p>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { toast } = useToast()
  const [userRole, setUserRole] = React.useState<string>("cashier")
  const [activeShift, setActiveShift] = React.useState<Shift | null>(null)
  const [shifts, setShifts] = React.useState<Shift[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)

  // dialog state
  const [openShiftDialog, setOpenShiftDialog] = React.useState(false)
  const [closeShiftDialog, setCloseShiftDialog] = React.useState(false)
  const [reportDialog, setReportDialog] = React.useState(false)
  const [selectedReport, setSelectedReport] = React.useState<Shift | null>(null)
  const [deleteShiftId, setDeleteShiftId] = React.useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // cash out dialog
  const [cashOutDialog, setCashOutDialog] = React.useState(false)
  const [cashOutAmount, setCashOutAmount] = React.useState("")
  const [cashOutReason, setCashOutReason] = React.useState("")
  const [cashOutLoading, setCashOutLoading] = React.useState(false)

  // filter state (shifts history)
  const [filterCashier, setFilterCashier] = React.useState("")
  const [filterFrom, setFilterFrom] = React.useState("")
  const [filterTo, setFilterTo] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<"all" | "open" | "closed">("all")

  // form state
  const [openingCash, setOpeningCash] = React.useState("")
  const [closingCash, setClosingCash] = React.useState("")

  // live clock
  const [now, setNow] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  React.useEffect(() => {
    const role = localStorage.getItem("userRole") || "cashier"
    setUserRole(role)
  }, [])

  const fetchActiveShift = React.useCallback(async () => {
    try {
      const res = await api.get("/shifts/active")
      setActiveShift(res.data.data)
    } catch {
      setActiveShift(null)
    }
  }, [])

  const fetchAllShifts = React.useCallback(async () => {
    try {
      const res = await api.get("/shifts")
      setShifts(res.data.data || [])
    } catch {
      setShifts([])
    }
  }, [])

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchActiveShift()
      const role = localStorage.getItem("userRole") || "cashier"
      if (role === "admin") await fetchAllShifts()
      setLoading(false)
    }
    load()
  }, [fetchActiveShift, fetchAllShifts])

  // ── open shift ─────────────────────────────────────────────────────────────
  const handleOpenShift = async () => {
    const amount = parseFloat(openingCash)
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid opening cash amount.", variant: "destructive" })
      return
    }
    setActionLoading(true)
    try {
      const res = await api.post("/shifts/open", { opening_cash: amount })
      if (res.data.success) {
        toast({ title: "Shift Opened", description: `Shift started with opening cash ${formatPKR(amount)}` })
        setOpenShiftDialog(false)
        setOpeningCash("")
        await fetchActiveShift()
        if (userRole === "admin") await fetchAllShifts()
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to open shift", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  // ── delete shift ───────────────────────────────────────────────────────────
  const handleDeleteShift = async () => {
    if (!deleteShiftId) return
    setDeleteLoading(true)
    try {
      const res = await api.delete(`/shifts/${deleteShiftId}`)
      if (res.data.success) {
        toast({ title: "Shift Deleted", description: "Shift record has been removed." })
        setDeleteShiftId(null)
        await fetchAllShifts()
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete shift", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── cash out ───────────────────────────────────────────────────────────────
  const handleCashOut = async () => {
    const amount = parseFloat(cashOutAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Valid amount daalo.", variant: "destructive" })
      return
    }
    if (!activeShift) return
    setCashOutLoading(true)
    try {
      const res = await api.post(`/shifts/${activeShift.id}/cash-movement`, {
        type: "cash_out",
        amount,
        reason: cashOutReason.trim() || null,
      })
      if (res.data.success) {
        toast({ title: "Cash Out Recorded", description: `Rs. ${amount.toFixed(2)} drawer se nikala gaya` })
        setCashOutDialog(false)
        setCashOutAmount("")
        setCashOutReason("")
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed", variant: "destructive" })
    } finally {
      setCashOutLoading(false)
    }
  }

  // ── close shift ────────────────────────────────────────────────────────────
  const handleCloseShift = async () => {
    const amount = parseFloat(closingCash)
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid closing cash amount.", variant: "destructive" })
      return
    }
    setActionLoading(true)
    try {
      const res = await api.put("/shifts/close", { closing_cash: amount })
      if (res.data.success) {
        const d = res.data.data
        toast({
          title: "Shift Closed",
          description: `Variance: ${d.variance_rupees >= 0 ? "+" : ""}${formatPKR(d.variance_rupees)}`,
        })
        setCloseShiftDialog(false)
        setClosingCash("")
        await fetchActiveShift()
        if (userRole === "admin") await fetchAllShifts()
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to close shift", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  // ── view + print report ────────────────────────────────────────────────────
  const handleViewReport = async (shiftId: number) => {
    try {
      const res = await api.get(`/shifts/${shiftId}/report`)
      if (res.data.success) {
        setSelectedReport(res.data.data)
        setReportDialog(true)
      }
    } catch {
      toast({ title: "Error", description: "Failed to load report", variant: "destructive" })
    }
  }

  const handlePrint = () => {
    const printArea = document.getElementById("shift-report-print")
    if (!printArea) return
    const win = window.open("", "_blank", "width=380,height=600")
    if (!win) return
    win.document.write(`
      <html><head>
        <title>Shift Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px;
            color: #000;
            background: #fff;
          }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; font-size: 11px; }
          hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          h2 { font-size: 14px; text-align: center; margin-bottom: 2px; }
          p { font-size: 10px; }
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            body { padding: 4px; }
          }
        </style>
      </head><body>
        ${printArea.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.onfocus = function() { setTimeout(function() { window.close(); }, 300); }
          }
        <\/script>
      </body></html>
    `)
    win.document.close()
  }

  const varianceColor = (v: number | null | undefined) => {
    if (v === null || v === undefined) return ""
    if (v < 0) return "text-destructive"
    if (v > 0) return "text-green-600"
    return "text-muted-foreground"
  }

  const varianceIcon = (v: number | null | undefined) => {
    if (v === null || v === undefined) return <Minus className="w-3 h-3" />
    if (v < 0) return <TrendingDown className="w-3 h-3 text-destructive" />
    if (v > 0) return <TrendingUp className="w-3 h-3 text-green-600" />
    return <Minus className="w-3 h-3 text-muted-foreground" />
  }

  const filteredShifts = shifts.filter(s => {
    const matchCashier = !filterCashier || s.cashier_name.toLowerCase().includes(filterCashier.toLowerCase())
    const matchFrom = !filterFrom || new Date(s.start_time) >= new Date(filterFrom)
    const matchTo = !filterTo || new Date(s.start_time) <= new Date(filterTo + "T23:59:59")
    const matchStatus = filterStatus === "all" || s.status === filterStatus
    return matchCashier && matchFrom && matchTo && matchStatus
  })

  const hasActiveFilters = filterCashier || filterFrom || filterTo || filterStatus !== "all"

  const clearFilters = () => {
    setFilterCashier("")
    setFilterFrom("")
    setFilterTo("")
    setFilterStatus("all")
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin", "cashier"]}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading shifts...</span>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "cashier"]}>
      <div className="space-y-6">
        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Clock className="w-7 h-7" />
              Shift Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage cashier shifts, opening/closing cash &amp; end-of-shift reports
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {now.toLocaleString("en-PK", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>

        {/* ── Active Shift Card ─────────────────────────────────────────────── */}
        <Card className={`border-2 ${activeShift ? "border-green-500/40 bg-green-500/5" : "border-dashed"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {activeShift ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-500" /> Current Shift</>
                ) : (
                  <><AlertCircle className="w-5 h-5 text-muted-foreground" /> No Active Shift</>
                )}
              </CardTitle>
              <Badge variant={activeShift ? "default" : "secondary"} className={activeShift ? "bg-green-500 text-white" : ""}>
                {activeShift ? "OPEN" : "CLOSED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeShift ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Cashier</p>
                    <p className="font-semibold">{activeShift.cashier_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="font-semibold text-sm">{formatDateTime(activeShift.start_time)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-semibold">{formatDuration(activeShift.start_time, null)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opening Cash</p>
                    <p className="font-semibold text-primary">{formatPKR(activeShift.opening_cash_rupees)}</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2 flex-wrap">
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => setCloseShiftDialog(true)}
                  >
                    <StopCircle className="w-4 h-4" />
                    Close Shift
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-orange-500 text-orange-500 hover:bg-orange-500/10"
                    onClick={() => setCashOutDialog(true)}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    Cash Out
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleViewReport(activeShift.id)}
                  >
                    <Printer className="w-4 h-4" />
                    View Report
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <p className="text-muted-foreground text-sm flex-1">
                  No shift is currently open. Open a shift to start tracking sales and cash flow.
                </p>
                <Button className="gap-2 shrink-0" onClick={() => setOpenShiftDialog(true)}>
                  <PlayCircle className="w-4 h-4" />
                  Open Shift
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Shifts History (Admin only) ───────────────────────────────────── */}
        {userRole === "admin" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">Shifts History</CardTitle>
                  <CardDescription>
                    {hasActiveFilters
                      ? `${filteredShifts.length} of ${shifts.length} shifts`
                      : `${shifts.length} total shifts`}
                  </CardDescription>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                {/* Cashier Search */}
                <div className="relative sm:col-span-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cashier name..."
                    value={filterCashier}
                    onChange={e => setFilterCashier(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Date From */}
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-muted-foreground pointer-events-none select-none z-10">
                    From
                  </span>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={e => setFilterFrom(e.target.value)}
                    max={filterTo || undefined}
                    className="w-full pl-14 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Date To */}
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-muted-foreground pointer-events-none select-none z-10">
                    To
                  </span>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={e => setFilterTo(e.target.value)}
                    min={filterFrom || undefined}
                    max="9999-12-31"
                    className="w-full pl-10 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex gap-1">
                  {(["all", "open", "closed"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`flex-1 py-2 text-xs font-medium rounded-md border transition-colors capitalize ${
                        filterStatus === s
                          ? s === "open"
                            ? "bg-green-500 text-white border-green-500"
                            : s === "closed"
                              ? "bg-muted text-foreground border-border"
                              : "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Report</TableHead>
                      <TableHead className="text-center">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShifts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          {hasActiveFilters ? "Koi shift match nahi hua filter se." : "No shifts recorded yet."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredShifts.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground text-xs">{s.id}</TableCell>
                          <TableCell className="font-medium">{s.cashier_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateTime(s.start_time)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(s.start_time, s.end_time)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatPKR(s.opening_cash_rupees)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <div className="flex items-center justify-end gap-1">
                              <ShoppingBag className="w-3 h-3 text-muted-foreground" />
                              {formatPKR(s.total_sales_rupees)}
                              <span className="text-xs text-muted-foreground">({s.transaction_count})</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {s.variance_rupees !== null ? (
                              <span className={`flex items-center justify-end gap-1 ${varianceColor(s.variance_rupees)}`}>
                                {varianceIcon(s.variance_rupees)}
                                {formatPKR(Math.abs(s.variance_rupees ?? 0))}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={s.status === "open" ? "default" : "secondary"}
                              className={s.status === "open" ? "bg-green-500 text-white text-xs" : "text-xs"}>
                              {s.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {s.status === "closed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleViewReport(s.id)}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.status === "closed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteShiftId(s.id)}
                                title="Delete shift"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* ── Open Shift Dialog ─────────────────────────────────────────────── */}
        <Dialog open={openShiftDialog} onOpenChange={setOpenShiftDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-green-500" />
                Open New Shift
              </DialogTitle>
              <DialogDescription>
                Enter the opening cash amount to start your shift.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="opening-cash">Opening Cash (PKR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    Rs.
                  </span>
                  <Input
                    id="opening-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-10"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOpenShift()}
                  />
                </div>
                {openingCash && !isNaN(parseFloat(openingCash)) && (
                  <p className="text-xs text-muted-foreground">
                    {formatPKR(parseFloat(openingCash))} will be recorded as opening cash
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpenShiftDialog(false); setOpeningCash("") }}>
                Cancel
              </Button>
              <Button onClick={handleOpenShift} disabled={actionLoading} className="gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                Open Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Close Shift Dialog ────────────────────────────────────────────── */}
        <Dialog open={closeShiftDialog} onOpenChange={setCloseShiftDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StopCircle className="w-5 h-5 text-destructive" />
                Close Shift
              </DialogTitle>
              <DialogDescription>
                Count your cash drawer and enter the total below.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {activeShift && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shift Started</span>
                    <span>{formatDateTime(activeShift.start_time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{formatDuration(activeShift.start_time, null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Opening Cash</span>
                    <span className="font-medium">{formatPKR(activeShift.opening_cash_rupees)}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="closing-cash">Actual Cash Counted (PKR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    Rs.
                  </span>
                  <Input
                    id="closing-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-10"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCloseShift()}
                  />
                </div>
                {closingCash && !isNaN(parseFloat(closingCash)) && (
                  <p className="text-xs text-muted-foreground">
                    {formatPKR(parseFloat(closingCash))} will be recorded as closing cash
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCloseShiftDialog(false); setClosingCash("") }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleCloseShift} disabled={actionLoading} className="gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                Close Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Shift Report Dialog ───────────────────────────────────────────── */}
        <Dialog open={reportDialog} onOpenChange={setReportDialog}>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                End-of-Shift Report
              </DialogTitle>
              {selectedReport && (
                <DialogDescription>
                  Shift #{selectedReport.id} — {selectedReport.cashier_name}
                </DialogDescription>
              )}
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                {/* Visible report + hidden anchor for printing */}
                <div id="shift-report-print">
                  <ShiftReportPrint shift={selectedReport} />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                    <p className="text-xl font-bold">{selectedReport.transaction_count}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${
                    (selectedReport.variance_rupees ?? 0) < 0
                      ? "bg-destructive/10"
                      : (selectedReport.variance_rupees ?? 0) > 0
                        ? "bg-green-500/10"
                        : "bg-muted/40"
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`text-xl font-bold ${varianceColor(selectedReport.variance_rupees)}`}>
                      {(selectedReport.variance_rupees ?? 0) > 0 ? "+" : ""}
                      {formatPKR(selectedReport.variance_rupees)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-shrink-0 border-t pt-3">
              <Button variant="outline" onClick={() => setReportDialog(false)}>
                Close
              </Button>
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Print Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
        <Dialog open={!!deleteShiftId} onOpenChange={(open) => { if (!open) setDeleteShiftId(null) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Delete Shift #{deleteShiftId}
              </DialogTitle>
              <DialogDescription>
                Kya aap sure hain? Yeh shift record permanently delete ho jaayega. Sales data safe rahega.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteShiftId(null)} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteShift} disabled={deleteLoading} className="gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Cash Out Dialog ───────────────────────────────────────────────── */}
        <Dialog open={cashOutDialog} onOpenChange={(open) => { if (!open) { setCashOutDialog(false); setCashOutAmount(""); setCashOutReason("") } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-500">
                <ArrowDownCircle className="w-5 h-5" />
                Cash Out
              </DialogTitle>
              <DialogDescription>
                Drawer se cash nikalne ka record. Yeh end-of-shift expected amount se minus ho jaayega.
              </DialogDescription>
            </DialogHeader>
            <div className="py-3 space-y-4">
              {/* Available balance indicator */}
              {activeShift && (
                <div className="bg-muted/40 rounded-lg px-4 py-2 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Available in Drawer</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatPKR(activeShift.opening_cash_rupees)}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="cashout-amount">Amount (PKR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rs.</span>
                  <input
                    id="cashout-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={cashOutAmount}
                    onChange={(e) => setCashOutAmount(e.target.value)}
                  />
                </div>
                {cashOutAmount && activeShift && parseFloat(cashOutAmount) > activeShift.opening_cash_rupees && (
                  <p className="text-xs text-destructive">Amount available cash se zyada hai</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashout-reason">Reason (Optional)</Label>
                <input
                  id="cashout-reason"
                  type="text"
                  placeholder="e.g. Owner ne liya, Supplies"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={cashOutReason}
                  onChange={(e) => setCashOutReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCashOutDialog(false)} disabled={cashOutLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleCashOut}
                disabled={cashOutLoading || !cashOutAmount}
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {cashOutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownCircle className="w-4 h-4" />}
                Record Cash Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </ProtectedRoute>
  )
}

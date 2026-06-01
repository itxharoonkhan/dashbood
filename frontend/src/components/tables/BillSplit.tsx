"use client"

import * as React from "react"
import { Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
}

interface SplitRow {
  label: string
  amount: string
  paid: boolean
  splitId?: number
}

interface Props {
  open: boolean
  orderId: number
  total: number
  items: OrderItem[]
  onClose: () => void
  onPaid: () => void
}

type SplitType = "equal" | "by_amount"

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillSplit({ open, orderId, total, items, onClose, onPaid }: Props) {
  const { toast } = useToast()

  const [splitType, setSplitType] = React.useState<SplitType>("equal")
  const [rows, setRows] = React.useState<SplitRow[]>([
    { label: "Person 1", amount: "", paid: false },
    { label: "Person 2", amount: "", paid: false },
  ])
  const [saved, setSaved] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  // Auto-fill equal split
  React.useEffect(() => {
    if (splitType === "equal" && rows.length > 0) {
      const each = (total / rows.length).toFixed(2)
      setRows(prev => prev.map(r => ({ ...r, amount: each })))
    }
  }, [splitType, rows.length, total])

  const addRow = () => {
    if (rows.length >= 6) return
    setRows(prev => [...prev, { label: `Person ${prev.length + 1}`, amount: "", paid: false }])
  }

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const updateRow = (idx: number, key: keyof SplitRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }

  const allocatedTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const remaining = total - allocatedTotal
  const isBalanced = Math.abs(remaining) < 0.01

  // ─── Save split to backend ────────────────────────────────────────────────
  const handleSaveSplit = async () => {
    if (!isBalanced) {
      toast({ title: "Unbalanced Split", description: `Rs. ${Math.abs(remaining).toFixed(2)} still unallocated.`, variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      await api.post(`/orders/${orderId}/split`, {
        split_type: splitType,
        splits: rows.map(r => ({ person_label: r.label, amount: parseFloat(r.amount) })),
      })
      setSaved(true)
      // Reload rows with IDs from backend
      const oRes = await api.get(`/orders/${orderId}`)
      const splits = oRes.data.data?.splits || []
      setRows(splits.map((s: any) => ({
        label: s.person_label,
        amount: String(s.amount),
        paid: !!s.paid,
        splitId: s.id,
      })))
      toast({ title: "Split Saved", description: "Bill split has been saved." })
    } catch {
      toast({ title: "Error", description: "Failed to save split", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ─── Mark a portion as paid ───────────────────────────────────────────────
  const handleMarkPaid = async (idx: number) => {
    const row = rows[idx]
    if (!row.splitId) return
    setLoading(true)
    try {
      await api.put(`/orders/${orderId}/split/${row.splitId}/pay`)
      setRows(prev => prev.map((r, i) => i === idx ? { ...r, paid: true } : r))
      toast({ title: "Paid", description: `${row.label}'s portion marked as paid.` })
      // Check if all paid
      const allPaid = rows.every((r, i) => i === idx ? true : r.paid)
      if (allPaid) {
        toast({ title: "Order Complete", description: "All portions paid. Table freed." })
        onPaid()
      }
    } catch {
      toast({ title: "Error", description: "Failed to mark as paid", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split Bill — Rs. {total.toLocaleString()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Split Method</Label>
            <Select value={splitType} onValueChange={v => setSplitType(v as SplitType)} disabled={saved}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equal Split</SelectItem>
                <SelectItem value="by_amount">By Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="flex-1 h-9 text-sm"
                  placeholder="Name"
                  value={row.label}
                  onChange={e => updateRow(idx, "label", e.target.value)}
                  disabled={saved}
                />
                <Input
                  className="w-28 h-9 text-sm"
                  type="number"
                  placeholder="Amount"
                  value={row.amount}
                  onChange={e => updateRow(idx, "amount", e.target.value)}
                  disabled={saved || splitType === "equal"}
                />
                {saved ? (
                  row.paid ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <Button
                      size="sm"
                      className="h-9 text-xs shrink-0"
                      onClick={() => handleMarkPaid(idx)}
                      disabled={loading}
                    >
                      Pay
                    </Button>
                  )
                ) : (
                  <Button
                    variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length <= 2}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {!saved && rows.length < 6 && (
            <Button variant="outline" size="sm" onClick={addRow} className="w-full h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Person
            </Button>
          )}

          {/* Balance indicator */}
          <div className={`text-sm font-medium text-center px-3 py-2 rounded-lg border ${
            isBalanced ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}>
            {isBalanced
              ? "Split balanced"
              : remaining > 0
                ? `Rs. ${remaining.toFixed(2)} still unallocated`
                : `Rs. ${Math.abs(remaining).toFixed(2)} over-allocated`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!saved && (
            <Button onClick={handleSaveSplit} disabled={loading || !isBalanced}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Split
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

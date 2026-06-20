"use client"

import * as React from "react"
import {
  X, CreditCard, Banknote, QrCode, CheckCircle, Tag, Loader2,
  XCircle, Star, Split, Plus, ShoppingCart, User, Receipt,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { PhoneInput, isValidPhone } from "@/components/ui/phone-input"
import api from "@/lib/api"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface AppliedCoupon {
  id: number
  code: string
  type: "flat" | "percentage"
  value: number
  discount: number
}

interface LoyaltyInfo {
  found: boolean
  customer_id?: number
  customer_name?: string
  points?: number
  min_redeem?: number
  max_percent?: number
  rate?: number
}

interface SplitRow {
  method: string
  amount: string
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  onComplete: (customerData?: {
    name: string
    phone: string
    coupon?: AppliedCoupon
    loyaltyPointsRedeemed?: number
    splitPayments?: { method: string; amount: number }[]
    paymentMethod?: string
    amountPaid?: number
  }) => void
  onPaymentMethodChange?: (method: string) => void
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  scan: "Wallet",
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function PaymentDialog({
  open,
  onOpenChange,
  cart,
  subtotal,
  tax,
  discount,
  total,
  onComplete,
  onPaymentMethodChange,
}: PaymentDialogProps) {
  const { toast } = useToast()
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "scan">("card")
  const [isSplitMode, setIsSplitMode] = React.useState(false)
  const [splitRows, setSplitRows] = React.useState<SplitRow[]>([
    { method: "cash", amount: "" },
    { method: "card", amount: "" },
  ])
  const [cashReceived, setCashReceived] = React.useState("")
  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("92")
  const [phoneError, setPhoneError] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isComplete, setIsComplete] = React.useState(false)

  const [couponInput, setCouponInput] = React.useState("")
  const [couponLoading, setCouponLoading] = React.useState(false)
  const [appliedCoupon, setAppliedCoupon] = React.useState<AppliedCoupon | null>(null)

  const [loyaltyInfo, setLoyaltyInfo] = React.useState<LoyaltyInfo | null>(null)
  const [loyaltyLoading, setLoyaltyLoading] = React.useState(false)
  const [usePoints, setUsePoints] = React.useState(false)
  const [pointsToUse, setPointsToUse] = React.useState(0)

  const couponDiscount = appliedCoupon?.discount ?? 0
  const loyaltyDiscount = usePoints ? pointsToUse : 0
  const actualTotal = Math.max(0, total - couponDiscount - loyaltyDiscount)

  const change = !isSplitMode && paymentMethod === "cash"
    ? Math.max(0, parseFloat(cashReceived || "0") - actualTotal)
    : 0

  const splitCashTotal    = splitRows.filter(r => r.method === "cash").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const splitNonCashTotal = splitRows.filter(r => r.method !== "cash").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const splitPaid         = splitCashTotal + splitNonCashTotal
  const splitRemaining    = parseFloat((actualTotal - splitPaid).toFixed(2))
  const nonCashOverpay    = splitNonCashTotal > actualTotal
  const cashNeeded        = Math.max(0, actualTotal - splitNonCashTotal)
  const splitChange       = splitCashTotal > cashNeeded
    ? parseFloat((splitCashTotal - cashNeeded).toFixed(2))
    : 0

  React.useEffect(() => {
    if (!open) {
      setCouponInput("")
      setAppliedCoupon(null)
      setCashReceived("")
      setCustomerName("")
      setCustomerPhone("92")
      setPhoneError(null)
      setIsComplete(false)
      setLoyaltyInfo(null)
      setUsePoints(false)
      setPointsToUse(0)
      setIsSplitMode(false)
      setSplitRows([{ method: "cash", amount: "" }, { method: "card", amount: "" }])
    }
  }, [open])

  const lookupLoyalty = async (phone: string) => {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 12) return
    if (!isValidPhone(phone)) return
    setLoyaltyLoading(true)
    try {
      const res = await api.get(`/loyalty/lookup?phone=${encodeURIComponent(phone.trim())}`)
      setLoyaltyInfo(res.data)
      setUsePoints(false)
      setPointsToUse(0)
    } catch {
      setLoyaltyInfo(null)
    } finally {
      setLoyaltyLoading(false)
    }
  }

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    try {
      const res = await api.post("/coupons/validate", {
        code: couponInput.trim().toUpperCase(),
        subtotal,
      })
      setAppliedCoupon({
        id: res.data.coupon.id,
        code: res.data.coupon.code,
        type: res.data.coupon.type,
        value: res.data.coupon.value,
        discount: res.data.discount,
      })
      toast({ title: "Coupon Applied!", description: res.data.message })
    } catch (e: any) {
      toast({
        title: "Invalid Coupon",
        description: e.response?.data?.message || "Could not apply coupon",
        variant: "destructive",
      })
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput("")
  }

  const updateSplitRow = (idx: number, field: keyof SplitRow, value: string) => {
    setSplitRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const addSplitRow = () => {
    if (splitRows.length >= 3) return
    setSplitRows(prev => [...prev, { method: "scan", amount: "" }])
  }

  const removeSplitRow = (idx: number) => {
    if (splitRows.length <= 2) return
    setSplitRows(prev => prev.filter((_, i) => i !== idx))
  }

  const handlePayment = () => {
    if (!customerName.trim()) {
      toast({ title: "Name Required", description: "Please enter the customer name to proceed.", variant: "destructive" })
      return
    }
    const phoneDigits = customerPhone.replace(/\D/g, "")
    if (phoneDigits.length > 2 && !isValidPhone(customerPhone)) {
      setPhoneError("Phone number 12 digits ka hona chahiye — 92 ke baad 10 digits daalo")
      toast({ title: "Phone Number Invalid", description: "Sirf 12 digits allowed hain (92 + 10 digits)", variant: "destructive" })
      return
    }
    setPhoneError(null)

    if (isSplitMode) {
      const emptyRows = splitRows.filter(r => !r.amount || parseFloat(r.amount) <= 0)
      if (emptyRows.length > 0) {
        toast({ title: "Incomplete Split", description: "Enter amount for each payment method.", variant: "destructive" })
        return
      }
      if (nonCashOverpay) {
        toast({ title: "Invalid Amount", description: "Card/Wallet ka amount exact hona chahiye — change nahi milta.", variant: "destructive" })
        return
      }
      if (splitRemaining > 0.009) {
        toast({ title: "Insufficient Payment", description: `Rs. ${splitRemaining.toFixed(2)} still remaining.`, variant: "destructive" })
        return
      }
    } else {
      if (paymentMethod === "cash" && parseFloat(cashReceived || "0") < actualTotal) {
        toast({ title: "Insufficient Amount", description: "Cash received is less than the total payable.", variant: "destructive" })
        return
      }
    }

    setIsProcessing(true)

    const finalSplitPayments = isSplitMode
      ? splitRows.map(r => ({ method: r.method, amount: parseFloat(r.amount) || 0 }))
      : undefined

    const resolvedMethod = isSplitMode ? "Split" : METHOD_LABELS[paymentMethod]
    onPaymentMethodChange?.(resolvedMethod)

    const finalName           = customerName.trim()
    const finalPhone          = customerPhone.trim()
    const finalPointsRedeemed = usePoints ? pointsToUse : 0
    const finalAmountPaid     = isSplitMode
      ? splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      : paymentMethod === 'cash' ? parseFloat(cashReceived || '0') : 0

    setTimeout(() => {
      setIsProcessing(false)
      setIsComplete(true)
      toast({ title: "Payment Successful!", description: "Transaction completed successfully." })
      setTimeout(() => {
        onComplete({
          name: finalName,
          phone: finalPhone,
          coupon: appliedCoupon ?? undefined,
          loyaltyPointsRedeemed: finalPointsRedeemed,
          splitPayments: finalSplitPayments,
          paymentMethod: resolvedMethod,
          amountPaid: finalAmountPaid,
        })
        setTimeout(() => {
          onOpenChange(false)
          setIsComplete(false)
        }, 100)
      }, 1500)
    }, 1500)
  }

  const isPayDisabled = isProcessing || (
    isSplitMode
      ? splitRemaining > 0.009 || nonCashOverpay
      : paymentMethod === "cash" && parseFloat(cashReceived || "0") < actualTotal
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[10000] max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">

        {/* ── Header ── */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Complete Payment</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cart.length} item{cart.length !== 1 ? "s" : ""} in cart
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Success Screen ── */}
        {isComplete ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mb-5">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">Transaction completed</p>
            {customerName.trim() && Math.floor(actualTotal / (loyaltyInfo?.rate ?? 100)) > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 px-4 py-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-semibold text-yellow-500">
                  +{Math.floor(actualTotal / (loyaltyInfo?.rate ?? 100))} points earned!
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Customer Info ── */}
              <div>
                <SectionHeader icon={User} title="Customer Info" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <PhoneInput
                      id="customerPhone"
                      label="Phone (Optional)"
                      value={customerPhone}
                      onChange={(val) => { setCustomerPhone(val); setPhoneError(null) }}
                      onBlur={lookupLoyalty}
                      error={phoneError ?? undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customerName" className="text-sm font-medium flex items-center gap-1">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="customerName"
                      placeholder="Required"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value.slice(0, 15))}
                      maxLength={15}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* ── Promo Code ── */}
              <div>
                <SectionHeader icon={Tag} title="Promo Code" />
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-mono font-bold text-green-500 text-sm">{appliedCoupon.code}</span>
                      <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                        {appliedCoupon.type === "percentage" ? `${appliedCoupon.value}% off` : `Rs. ${appliedCoupon.value} off`}
                      </Badge>
                    </div>
                    <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                      className="uppercase font-mono h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="h-9 shrink-0 px-4"
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Loyalty Points ── */}
              {loyaltyLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up loyalty points...
                </div>
              )}
              {loyaltyInfo?.found && !loyaltyLoading && (
                <div>
                  <SectionHeader icon={Star} title="Loyalty Points" />
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-yellow-500">
                        {loyaltyInfo.points} pts available
                      </span>
                      {(loyaltyInfo.points ?? 0) >= (loyaltyInfo.min_redeem ?? 100) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const maxByPercent = Math.floor(total * (loyaltyInfo.max_percent ?? 30) / 100)
                            const maxUsable = Math.min(loyaltyInfo.points ?? 0, maxByPercent)
                            if (!usePoints) { setPointsToUse(maxUsable); setUsePoints(true) }
                            else { setUsePoints(false); setPointsToUse(0) }
                          }}
                          className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                            usePoints
                              ? "bg-yellow-500 text-white"
                              : "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                          }`}
                        >
                          {usePoints ? "Remove" : "Use Points"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Min {loyaltyInfo.min_redeem} needed</span>
                      )}
                    </div>
                    {usePoints && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">Points to use:</span>
                        <input
                          type="number"
                          min={loyaltyInfo.min_redeem ?? 100}
                          max={Math.min(loyaltyInfo.points ?? 0, Math.floor(total * (loyaltyInfo.max_percent ?? 30) / 100))}
                          value={pointsToUse}
                          onChange={e => {
                            const maxByPercent = Math.floor(total * (loyaltyInfo.max_percent ?? 30) / 100)
                            const maxUsable = Math.min(loyaltyInfo.points ?? 0, maxByPercent)
                            setPointsToUse(Math.min(Math.max(0, parseInt(e.target.value) || 0), maxUsable))
                          }}
                          className="w-20 text-center text-sm border border-yellow-500/40 rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                        <span className="text-xs text-yellow-500 font-semibold">= Rs. {pointsToUse} off</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Order Summary ── */}
              <div>
                <SectionHeader icon={Receipt} title="Order Summary" />
                <div className="rounded-lg border bg-muted/20 overflow-hidden">
                  {/* Items */}
                  <div className="px-3 py-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-foreground truncate pr-4">{item.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
                        <span className="font-medium shrink-0">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals breakdown */}
                  <div className="px-3 py-2.5 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-medium text-foreground">Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax</span>
                      <span className="font-medium text-foreground">Rs. {tax.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-500">
                        <span>Discount</span>
                        <span>-Rs. {discount.toFixed(2)}</span>
                      </div>
                    )}
                    {appliedCoupon && (
                      <div className="flex justify-between text-green-500">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Coupon ({appliedCoupon.code})
                        </span>
                        <span>-Rs. {couponDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {usePoints && pointsToUse > 0 && (
                      <div className="flex justify-between text-yellow-500">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" /> Points ({pointsToUse} pts)
                        </span>
                        <span>-Rs. {pointsToUse.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-purple-500">
                      <span>Donation</span>
                      <span>Rs. 1.00</span>
                    </div>
                  </div>

                  {/* Total Payable — prominent */}
                  <div className="px-3 py-3 bg-primary/8 border-t flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Total Payable</span>
                    <span className="text-xl font-bold text-primary">Rs. {actualTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* ── Payment Method ── */}
              <div>
                <SectionHeader icon={CreditCard} title="Payment Method" />
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "cash",  label: "Cash",   icon: Banknote   },
                    { key: "card",  label: "Card",   icon: CreditCard },
                    { key: "scan",  label: "Wallet", icon: QrCode     },
                  ].map(m => {
                    const isActive = !isSplitMode && paymentMethod === m.key
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => { setPaymentMethod(m.key as any); setIsSplitMode(false) }}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <m.icon className="w-5 h-5" />
                        <span className="text-xs">{m.label}</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setIsSplitMode(true)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-all ${
                      isSplitMode
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <Split className="w-5 h-5" />
                    <span className="text-xs">Split</span>
                  </button>
                </div>
              </div>

              {/* ── Cash Input ── */}
              {!isSplitMode && paymentMethod === "cash" && (
                <div className="space-y-2">
                  <Label htmlFor="cash" className="text-sm font-medium">Cash Received</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">Rs.</span>
                    <Input
                      id="cash"
                      type="number"
                      placeholder="0.00"
                      value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      className="pl-10 text-lg font-semibold h-11"
                    />
                  </div>
                  {cashReceived && (
                    <div className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${
                      change >= 0 ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
                    }`}>
                      <span className="text-muted-foreground font-medium">Change to return:</span>
                      <span className={`font-bold text-base ${change >= 0 ? "text-green-500" : "text-red-500"}`}>
                        Rs. {change.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Split Payment ── */}
              {isSplitMode && (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Enter amount for each method</p>

                  {splitRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Select value={row.method} onValueChange={v => updateSplitRow(idx, "method", v)}>
                        <SelectTrigger className="w-28 h-9 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">
                            <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" />Cash</span>
                          </SelectItem>
                          <SelectItem value="card">
                            <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />Card</span>
                          </SelectItem>
                          <SelectItem value="scan">
                            <span className="flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" />Wallet</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={row.amount}
                        onChange={e => updateSplitRow(idx, "amount", e.target.value)}
                        className="flex-1 h-9"
                        min="0"
                      />
                      {splitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeSplitRow(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {splitRows.length < 3 && (
                    <Button variant="outline" size="sm" onClick={addSplitRow} className="w-full h-8 text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Payment Method
                    </Button>
                  )}

                  <div className="rounded-md bg-background/60 border px-3 py-2.5 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Payable</span>
                      <span className="font-semibold text-foreground">Rs. {actualTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Entered</span>
                      <span className="font-semibold text-foreground">Rs. {splitPaid.toFixed(2)}</span>
                    </div>
                    {nonCashOverpay && (
                      <div className="flex items-center gap-1.5 font-semibold text-red-400 text-xs pt-0.5">
                        <X className="w-3.5 h-3.5" />
                        Card/Wallet overpayment allowed nahi — exact amount daalo
                      </div>
                    )}
                    {!nonCashOverpay && splitRemaining > 0.009 && (
                      <div className="flex justify-between font-semibold text-red-400">
                        <span>Remaining</span>
                        <span>Rs. {splitRemaining.toFixed(2)}</span>
                      </div>
                    )}
                    {!nonCashOverpay && splitChange > 0 && (
                      <div className="flex justify-between font-semibold text-green-500">
                        <span>Change (Cash)</span>
                        <span>Rs. {splitChange.toFixed(2)}</span>
                      </div>
                    )}
                    {!nonCashOverpay && splitRemaining <= 0.009 && splitChange === 0 && (
                      <div className="flex items-center gap-1.5 text-green-500 font-semibold text-xs pt-0.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Payment complete
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* ── Footer ── */}
            <DialogFooter className="shrink-0 px-6 py-4 border-t bg-muted/20 flex flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
                className="h-10 px-5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 text-base font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                onClick={handlePayment}
                disabled={isPayDisabled}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Pay  Rs. ${actualTotal.toFixed(2)}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

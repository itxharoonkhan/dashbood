"use client"

import * as React from "react"
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Loader2,
  ChefHat,
  SplitSquareHorizontal,
  CheckCircle2,
} from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import BillSplit from "./BillSplit"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableInfo {
  id: number
  name: string
  capacity: number
  status: string
  order_id?: number
}

interface Product {
  id: number
  name: string
  selling_price: number
  category: string
}

interface OrderItem {
  id?: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  notes: string
}

interface Props {
  open: boolean
  table: TableInfo
  onClose: () => void
}

// ─── Print KOT Slip ───────────────────────────────────────────────────────────

function printKOT(tableName: string, kotNumber: string, items: OrderItem[]) {
  const now = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
  const rows = items.map(i => `
    <tr>
      <td style="font-size:18px; font-weight:bold; padding:4px 0;">${i.quantity}x</td>
      <td style="font-size:16px; padding:4px 8px;">
        ${i.product_name}
        ${i.notes ? `<div style="font-size:12px; color:#555; font-style:italic;">* ${i.notes}</div>` : ''}
      </td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
  <html>
  <head>
    <title>KOT - ${tableName}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: monospace; width: 280px; padding: 12px; }
      .header { text-align:center; border-bottom: 2px dashed #000; padding-bottom:8px; margin-bottom:8px; }
      .title { font-size:20px; font-weight:bold; letter-spacing:2px; }
      .table-name { font-size:28px; font-weight:bold; margin:6px 0; }
      .meta { font-size:12px; color:#444; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      .footer { border-top:2px dashed #000; margin-top:10px; padding-top:8px; text-align:center; font-size:11px; color:#666; }
      @media print { button { display:none; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">** KITCHEN ORDER **</div>
      <div class="table-name">${tableName}</div>
      <div class="meta">KOT: ${kotNumber} &nbsp;|&nbsp; Time: ${now}</div>
    </div>
    <table>${rows}</table>
    <div class="footer">--- Order End ---</div>
  </body>
  </html>`

  const w = window.open('', '_blank', 'width=320,height=500')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 300)
}

// ─── Print Bill ───────────────────────────────────────────────────────────────

function printBill(
  tableName: string,
  items: OrderItem[],
  pax: number,
  orderId: number,
  storeName: string,
  footerMsg: string,
  waiterName: string,
  payMethod = '',
  amountPaid = 0,
  saleId: number | null = null,
  logoUrl = ''
) {
  const total   = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const change  = amountPaid > total ? amountPaid - total : 0
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  const rows = items.map(i => `
    <tr>
      <td class="item-name">${i.product_name}${i.notes ? `<br/><span class="note">* ${i.notes}</span>` : ''}</td>
      <td class="center">x${i.quantity}</td>
      <td class="right">Rs. ${(i.quantity * i.unit_price).toLocaleString()}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${tableName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',monospace; width:300px; padding:10px; font-size:12px; }
    .header { text-align:center; margin-bottom:10px; }
    .logo   { max-height:60px; max-width:180px; object-fit:contain; margin:0 auto 6px; display:block; }
    .store  { font-size:20px; font-weight:bold; margin-bottom:2px; }
    .sub    { font-size:10px; color:#666; }
    .dashed { border-top:1px dashed #000; margin:6px 0; }
    .solid  { border-top:2px solid #000; margin:6px 0; }
    .row    { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
    .bold   { font-weight:bold; }
    .right  { text-align:right; }
    .center { text-align:center; }
    table   { width:100%; border-collapse:collapse; margin:4px 0; }
    th      { font-size:11px; font-weight:bold; padding:3px 0; border-bottom:1px solid #000; }
    td      { font-size:11px; padding:3px 0; vertical-align:top; }
    td.item-name { width:55%; }
    td.center    { width:15%; text-align:center; }
    td.right     { width:30%; text-align:right; }
    .note   { font-size:10px; font-style:italic; color:#666; }
    .total-row { display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin:4px 0; }
    .pay-row   { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
    .footer { text-align:center; font-size:10px; margin-top:8px; color:#555; }
    @media print { @page { margin:0; } body { padding:4px; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="logo"/>` : ''}
    <div class="store">${storeName}</div>
    <div class="sub">${dateStr} &nbsp; ${timeStr}</div>
  </div>

  <div class="dashed"></div>
  <div class="row"><span>Invoice #:</span><span class="bold">${saleId ?? orderId}</span></div>
  <div class="row"><span>Table:</span><span class="bold">${tableName}</span></div>
  <div class="row"><span>Guests:</span><span>${pax}</span></div>
  <div class="row"><span>Waiter:</span><span>${waiterName}</span></div>
  <div class="row"><span>Type:</span><span>DINE</span></div>
  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="solid"></div>
  <div class="total-row"><span>Total</span><span>Rs. ${total.toLocaleString()}</span></div>
  <div class="dashed"></div>

  ${amountPaid > 0 ? `
  <div class="pay-row"><span>Cash Received:</span><span>Rs. ${amountPaid.toLocaleString()}</span></div>
  ${change > 0 ? `<div class="pay-row"><span>Change:</span><span>Rs. ${change.toLocaleString()}</span></div>` : ''}
  <div class="pay-row"><span>Payment Mode:</span><span style="text-transform:capitalize">${payMethod}</span></div>
  <div class="dashed"></div>
  ` : ''}

  <div class="footer">${footerMsg || 'Thank you for dining with us!'}</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=360,height=650')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 300)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderPanel({ open, table, onClose }: Props) {
  const { toast } = useToast()

  const [orderId, setOrderId] = React.useState<number | null>(null)
  const [orderStatus, setOrderStatus] = React.useState<string>("open")
  const [cart, setCart] = React.useState<OrderItem[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [storeName, setStoreName] = React.useState("Restaurant")
  const [footerMsg, setFooterMsg] = React.useState("Thank you for dining with us!")
  const [logoUrl, setLogoUrl] = React.useState("")
  const [waiterName, setWaiterName] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [pax, setPax] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [splitOpen, setSplitOpen] = React.useState(false)

  // Payment dialog state
  const [payDialogOpen, setPayDialogOpen] = React.useState(false)
  const [payMethod, setPayMethod] = React.useState("cash")
  const [payAmount, setPayAmount] = React.useState("")

  // ─── Load data when dialog opens ─────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setCart([])
    setSearch("")
    setOrderId(null)
    setOrderStatus("open")
    setWaiterName("")


    const init = async () => {
      try {
        // Load settings for receipt
        api.get("/settings").then(r => {
          const s = r.data.data || r.data
          if (s?.store_name) setStoreName(s.store_name)
          if (s?.receipt_footer_message) setFooterMsg(s.receipt_footer_message)
          if (s?.receipt_logo) {
            const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace('/api', '')
            setLogoUrl(`${base}${s.receipt_logo}`)
          }
        }).catch(() => {})

        // Load products
        const pRes = await api.get("/products?limit=200")
        const prods = (pRes.data.data?.products || pRes.data.data || []).filter(
          (p: any) => p.is_active !== false
        )
        setProducts(prods)

        // Determine order ID — prefer table.order_id, fallback: query by table_id
        let targetOrderId: number | null = table.order_id ?? null

        if (!targetOrderId && table.status !== "available") {
          // Table is occupied/billed but order_id not passed — fetch it
          const listRes = await api.get(`/orders?table_id=${table.id}&status=open`)
          const openOrders = listRes.data.data || []
          if (openOrders.length) {
            targetOrderId = openOrders[0].id
          } else {
            // Try billed orders
            const billedRes = await api.get(`/orders?table_id=${table.id}&status=billed`)
            const billedOrders = billedRes.data.data || []
            if (billedOrders.length) targetOrderId = billedOrders[0].id
          }
        }

        if (targetOrderId) {
          const oRes = await api.get(`/orders/${targetOrderId}`)
          if (oRes.data.success) {
            const ord = oRes.data.data
            setOrderId(ord.id)
            setOrderStatus(ord.status)
            setPax(ord.pax || 1)
            if (ord.waiter_name) setWaiterName(ord.waiter_name)
            setPayAmount(String(ord.items?.reduce((s: number, i: any) => s + i.quantity * parseFloat(i.unit_price), 0) || ""))
            setCart(
              (ord.items || []).map((i: any) => ({
                id: i.id,
                product_id: i.product_id,
                product_name: i.product_name,
                quantity: i.quantity,
                unit_price: parseFloat(i.unit_price),
                notes: i.notes || "",
              }))
            )
          }
        } else {
          setPax(1)
          setPayAmount("")
        }
      } catch {
        toast({ title: "Error", description: "Failed to load order data", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [open, table])

  // ─── Cart helpers ─────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    if (orderStatus === "billed" || orderStatus === "paid") return
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id && !i.id)
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id && !i.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: parseFloat(product.selling_price as any),
        notes: "",
      }]
    })
  }

  const updateQty = (product_id: number, delta: number) => {
    setCart(prev =>
      prev
        .map(i => (!i.id && i.product_id === product_id) ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0)
    )
  }

  const removeItem = (product_id: number) => {
    setCart(prev => prev.filter(i => !(i.product_id === product_id && !i.id)))
  }

  const total = cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  // ─── Load an existing order by ID ────────────────────────────────────────
  const loadOrder = async (oid: number) => {
    const oRes = await api.get(`/orders/${oid}`)
    const ord = oRes.data.data
    setOrderId(ord.id)
    setOrderStatus(ord.status)
    setPax(ord.pax || 1)
    if (ord.waiter_name) setWaiterName(ord.waiter_name)
    setCart((ord.items || []).map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: parseFloat(i.unit_price),
      notes: i.notes || "",
    })))
  }

  // ─── Open new order ───────────────────────────────────────────────────────
  const handleOpenOrder = async () => {
    const newItems = cart.filter(i => !i.id)
    if (newItems.length === 0) {
      toast({ title: "Empty Cart", description: "Add items before opening the order.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post("/orders", { table_id: table.id, pax, waiter_name: waiterName })
      const newOrderId = res.data.data.order_id
      setOrderId(newOrderId)
      setOrderStatus("open")

      const kotRes = await api.post(`/orders/${newOrderId}/items`, {
        items: newItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
      })

      await loadOrder(newOrderId)
      printKOT(table.name, kotRes.data.data?.kot_number || 'KOT', newItems)
      toast({ title: "KOT Printed", description: `Slip print ho gayi — waiter kitchen le jaaye` })
    } catch (err: any) {
      // Agar backend ne 400 diya with existing_order_id — load that order
      const errData = err.response?.data
      if (errData?.existing_order_id) {
        await loadOrder(errData.existing_order_id)
        toast({ title: "Existing Order", description: "Is table ka existing order load ho gaya." })
      } else {
        toast({ title: "Error", description: errData?.message || "Failed to open order", variant: "destructive" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Add more items ───────────────────────────────────────────────────────
  const handleSendKot = async () => {
    if (!orderId) return handleOpenOrder()
    const newItems = cart.filter(i => !i.id)
    if (newItems.length === 0) {
      toast({ title: "No New Items", description: "Add new items before sending KOT.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const kotRes = await api.post(`/orders/${orderId}/items`, {
        items: newItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
      })
      await loadOrder(orderId)
      printKOT(table.name, kotRes.data.data?.kot_number || 'KOT', newItems)
      toast({ title: "KOT Printed", description: "Slip print ho gayi — waiter kitchen le jaaye" })
    } catch {
      toast({ title: "Error", description: "Failed to send KOT", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Print bill ───────────────────────────────────────────────────────────
  const handlePrintBill = async () => {
    if (!orderId || cart.length === 0) return
    setSubmitting(true)
    try {
      await api.put(`/orders/${orderId}/bill`)
      setOrderStatus("billed")
      toast({ title: "Bill Ready", description: `Payment complete karo — receipt automatically print hogi` })
    } catch {
      toast({ title: "Error", description: "Failed to print bill", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Re-open billed order (customer wants to add more items) ─────────────
  const handleReopenOrder = async () => {
    if (!orderId) return
    setSubmitting(true)
    try {
      await api.put(`/orders/${orderId}/reopen`)
      setOrderStatus("open")
      toast({ title: "Order Re-opened", description: "Ab nayi items add kar sakte hain aur naya KOT bhej sakte hain." })
    } catch {
      toast({ title: "Error", description: "Order reopen nahi hua", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Complete payment (with dialog) ───────────────────────────────────────
  const handleCompleteConfirm = async () => {
    if (!orderId) return
    const paid = parseFloat(payAmount)
    if (isNaN(paid) || paid < total) {
      toast({ title: "Amount Kam Hai", description: `Minimum Rs. ${total.toLocaleString()} chahiye.`, variant: "destructive" })
      return
    }
    setSubmitting(true)
    setPayDialogOpen(false)
    try {
      const completeRes = await api.put(`/orders/${orderId}/complete`, { payment_method: payMethod })
      const saleId = completeRes.data?.data?.sale_id ?? null
      printBill(table.name, cart, pax, orderId, storeName, footerMsg, waiterName || '—', payMethod, parseFloat(payAmount), saleId, logoUrl)
      toast({ title: "Payment Complete", description: `${table.name} available ho gayi.` })
      onClose()
    } catch {
      toast({ title: "Error", description: "Failed to complete order", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Filtered products ────────────────────────────────────────────────────
  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products

  const isReadOnly = orderStatus === "billed" || orderStatus === "paid"
  const newItemsInCart = cart.filter(i => !i.id)

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-primary" />
                {table.name}
              </DialogTitle>
              <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1">
                <span className="text-xs text-muted-foreground font-medium">Guests</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPax(p => Math.max(1, p - 1))} disabled={!!orderId}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-5 text-center font-bold text-sm">{pax}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPax(p => p + 1)} disabled={!!orderId}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 ml-1">
                {orderId && (
                  <Badge variant="outline" className="text-xs">Order #{orderId}</Badge>
                )}
                {orderStatus === "billed" && (
                  <Badge className="text-xs bg-orange-500/15 text-orange-700 border-orange-500/30">Bill Printed</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Product list */}
              <div className="flex-1 flex flex-col border-r">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8 h-9"
                      placeholder="Search products..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  {orderStatus === "billed" && (
                    <p className="text-xs text-orange-600 mt-2 text-center">
                      Bill print ho chuka hai — "Add More Items" dabao nayi order ke liye
                    </p>
                  )}
                  {orderStatus === "paid" && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Order complete ho chuka hai
                    </p>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {filtered.map(p => (
                      <button
                        key={p.id}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          isReadOnly
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:border-primary hover:bg-primary/5 cursor-pointer"
                        }`}
                        onClick={() => !isReadOnly && addToCart(p)}
                        disabled={isReadOnly}
                      >
                        <div className="font-medium text-sm leading-tight">{p.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.category}</div>
                        <div className="text-sm font-bold text-primary mt-1">
                          Rs. {Number(p.selling_price).toLocaleString()}
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No products found</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Order summary */}
              <div className="w-72 flex flex-col">
                <div className="p-3 font-semibold text-sm border-b">Order Items</div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {cart.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No items yet</p>
                    )}
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium leading-tight truncate">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Rs. {item.unit_price.toLocaleString()} × {item.quantity} = Rs. {(item.unit_price * item.quantity).toLocaleString()}
                          </div>
                          {item.id && (
                            <Badge variant="outline" className="text-[9px] mt-0.5">Sent to kitchen</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!item.id ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product_id, -1)}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product_id, 1)}>
                                <Plus className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.product_id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-3 border-t space-y-3">
                  <div className="flex items-center justify-between font-bold text-base">
                    <span>Total</span>
                    <span>Rs. {total.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {/* Waiter name input */}
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Waiter ka naam..."
                        value={waiterName}
                        onChange={e => setWaiterName(e.target.value)}
                        disabled={!!orderId}
                      />
                    </div>

                    {/* No order yet */}
                    {!orderId && (
                      <Button
                        className="w-full h-9"
                        onClick={handleOpenOrder}
                        disabled={submitting || newItemsInCart.length === 0}
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ChefHat className="w-4 h-4 mr-1" />}
                        Open Order + Send KOT
                      </Button>
                    )}

                    {/* Order open */}
                    {orderId && orderStatus === "open" && (
                      <>
                        {newItemsInCart.length > 0 && (
                          <Button className="w-full h-9" variant="outline" onClick={handleSendKot} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ChefHat className="w-4 h-4 mr-1" />}
                            Send KOT + Print Slip ({newItemsInCart.length} items)
                          </Button>
                        )}
                        <Button className="w-full h-9" onClick={handlePrintBill} disabled={submitting || cart.length === 0}>
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Printer className="w-4 h-4 mr-1" />}
                          Print Bill
                        </Button>
                        <Button className="w-full h-9" variant="outline" onClick={() => setSplitOpen(true)} disabled={submitting}>
                          <SplitSquareHorizontal className="w-4 h-4 mr-1" />
                          Split Bill
                        </Button>
                      </>
                    )}

                    {/* Bill printed — payment pending */}
                    {orderId && orderStatus === "billed" && (
                      <>
                        <Button
                          className="w-full h-9"
                          onClick={() => {
                            setPayAmount(String(total))
                            setPayDialogOpen(true)
                          }}
                          disabled={submitting}
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                          Complete Payment
                        </Button>
                        <Button className="w-full h-9" variant="outline" onClick={() => setSplitOpen(true)} disabled={submitting}>
                          <SplitSquareHorizontal className="w-4 h-4 mr-1" />
                          Split Bill
                        </Button>
                        <Button
                          className="w-full h-9 text-xs border-dashed" variant="outline"
                          onClick={handleReopenOrder}
                          disabled={submitting}
                        >
                          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                          Add More Items
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Payment — {table.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Bill Amount</p>
              <p className="text-2xl font-bold">Rs. {total.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="wallet">Wallet / EasyPaisa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount Received</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={`Min Rs. ${total.toLocaleString()}`}
              />
              {payMethod === "cash" && parseFloat(payAmount) > total && (
                <p className="text-sm text-green-600 font-medium">
                  Change: Rs. {(parseFloat(payAmount) - total).toLocaleString()}
                </p>
              )}
              {parseFloat(payAmount) < total && payAmount !== "" && (
                <p className="text-sm text-destructive">
                  Amount kam hai — Rs. {(total - parseFloat(payAmount)).toLocaleString()} aur chahiye
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCompleteConfirm}
              disabled={submitting || !payAmount || parseFloat(payAmount) < total}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderId && (
        <BillSplit
          open={splitOpen}
          orderId={orderId}
          total={total}
          items={cart}
          onClose={() => setSplitOpen(false)}
          onPaid={() => { setSplitOpen(false); onClose() }}
        />
      )}
    </>
  )
}

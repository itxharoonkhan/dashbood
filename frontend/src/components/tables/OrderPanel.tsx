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
  CheckCircle2,
  RotateCcw,
  Banknote,
  QrCode,
  Split,
  X,
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
import { printReceipt } from "@/lib/print-receipt"

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

function printKOT(
  tableName: string,
  kotNumber: string,
  items: OrderItem[],
  waiterName = '',
  pax = 0
) {
  const now      = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr  = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const rows = items.map((i, idx) => `
    <tr style="${idx > 0 ? 'border-top:1px dotted #ccc;' : ''}">
      <td class="num">${idx + 1}.</td>
      <td class="name">
        <span class="item-title">${i.product_name}</span>
        ${i.notes ? `<div class="note">&#9656; ${i.notes}</div>` : ''}
      </td>
      <td class="qty">x${i.quantity}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>KOT - ${tableName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',Courier,monospace; width:80mm; padding:8px; font-size:13px; }
    .title-box { border:2.5px solid #000; text-align:center; padding:5px 0; font-size:15px; font-weight:bold; letter-spacing:4px; margin-bottom:6px; }
    .table-name { text-align:center; font-size:52px; font-weight:bold; letter-spacing:6px; line-height:1; margin:4px 0 6px; }
    .dashed { border-top:1px dashed #000; margin:5px 0; }
    .solid  { border-top:2.5px solid #000; margin:5px 0; }
    .info   { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
    .lbl    { color:#555; }
    .val    { font-weight:bold; }
    table   { width:100%; border-collapse:collapse; margin:6px 0; }
    .num    { width:20px; font-size:10px; color:#888; vertical-align:top; padding-top:5px; }
    .name   { vertical-align:top; padding:4px 6px; }
    .item-title { font-size:15px; font-weight:bold; display:block; }
    .note   { font-size:11px; color:#555; font-style:italic; margin-top:2px; }
    .qty    { text-align:right; font-size:26px; font-weight:bold; white-space:nowrap; width:48px; vertical-align:middle; }
    .summary{ text-align:center; font-size:12px; font-weight:bold; margin:4px 0; }
    .footer { text-align:center; font-size:10px; color:#666; margin-top:6px; }
    @media print { @page { margin:0; } body { padding:5px; } }
  </style>
</head>
<body>
  <div class="title-box">KITCHEN ORDER</div>
  <div class="table-name">${tableName}</div>

  <div class="dashed"></div>
  <div class="info"><span class="lbl">KOT #</span><span class="val">${kotNumber}</span></div>
  <div class="info"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
  <div class="info"><span class="lbl">Time</span><span class="val">${now}</span></div>
  ${waiterName ? `<div class="info"><span class="lbl">Waiter</span><span class="val">${waiterName}</span></div>` : ''}
  ${pax > 0    ? `<div class="info"><span class="lbl">Covers</span><span class="val">${pax} pax</span></div>` : ''}
  <div class="solid"></div>

  <table>${rows}</table>

  <div class="solid"></div>
  <div class="summary">${items.length} item(s) &nbsp;|&nbsp; Total qty: ${totalQty}</div>
  <div class="dashed"></div>
  <div class="footer">--- Kitchen Copy ---</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=340,height=600')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 300)
}

// ─── Print Correction KOT ────────────────────────────────────────────────────

function printCorrectionKOT(
  tableName: string,
  kotNumber: string,
  voided: { name: string; qty: number }[],
  added: OrderItem[],
  waiterName = ''
) {
  const now     = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })

  const voidRows = voided.map((v, idx) => `
    <tr style="${idx > 0 ? 'border-top:1px dotted #fca5a5;' : ''}">
      <td class="num" style="color:#dc2626;">-</td>
      <td class="name"><span class="item-title" style="color:#dc2626;text-decoration:line-through;">${v.name}</span></td>
      <td class="qty" style="color:#dc2626;">x${v.qty}</td>
    </tr>`).join('')

  const addRows = added.map((i, idx) => `
    <tr style="${idx > 0 ? 'border-top:1px dotted #86efac;' : ''}">
      <td class="num" style="color:#16a34a;">+</td>
      <td class="name">
        <span class="item-title" style="color:#16a34a;">${i.product_name}</span>
        ${i.notes ? `<div class="note" style="color:#16a34a;">&#9656; ${i.notes}</div>` : ''}
      </td>
      <td class="qty" style="color:#16a34a;">x${i.quantity}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Correction KOT - ${tableName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',Courier,monospace; width:80mm; padding:8px; font-size:13px; }
    .title-box { border:2.5px solid #dc2626; text-align:center; padding:5px 0; font-size:14px; font-weight:bold; letter-spacing:3px; color:#dc2626; margin-bottom:6px; }
    .table-name { text-align:center; font-size:52px; font-weight:bold; letter-spacing:6px; line-height:1; margin:4px 0 6px; }
    .dashed { border-top:1px dashed #000; margin:5px 0; }
    .solid  { border-top:2.5px solid #000; margin:5px 0; }
    .info   { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
    .lbl    { color:#555; }
    .val    { font-weight:bold; }
    .sec-title { font-size:12px; font-weight:bold; padding:4px 6px; margin:6px 0 2px; border-radius:3px; }
    table   { width:100%; border-collapse:collapse; margin:2px 0; }
    .num    { width:16px; font-size:16px; font-weight:bold; vertical-align:top; padding-top:4px; }
    .name   { vertical-align:top; padding:4px 6px; }
    .item-title { font-size:15px; font-weight:bold; display:block; }
    .note   { font-size:11px; font-style:italic; margin-top:2px; }
    .qty    { text-align:right; font-size:26px; font-weight:bold; white-space:nowrap; width:48px; vertical-align:middle; }
    .footer { text-align:center; font-size:10px; color:#666; margin-top:8px; }
    @media print { @page { margin:0; } body { padding:5px; } }
  </style>
</head>
<body>
  <div class="title-box">ORDER CORRECTION</div>
  <div class="table-name">${tableName}</div>

  <div class="dashed"></div>
  <div class="info"><span class="lbl">KOT #</span><span class="val">${kotNumber}</span></div>
  <div class="info"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
  <div class="info"><span class="lbl">Time</span><span class="val">${now}</span></div>
  ${waiterName ? `<div class="info"><span class="lbl">Waiter</span><span class="val">${waiterName}</span></div>` : ''}
  <div class="solid"></div>

  ${voided.length > 0 ? `
    <div class="sec-title" style="background:#fee2e2;color:#dc2626;">VOID — Hatao</div>
    <table>${voidRows}</table>
  ` : ''}

  ${added.length > 0 ? `
    <div class="sec-title" style="background:#dcfce7;color:#16a34a;${voided.length > 0 ? 'margin-top:8px;' : ''}">ADD — Banana hai</div>
    <table>${addRows}</table>
  ` : ''}

  <div class="dashed"></div>
  <div class="footer">--- Correction End ---</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=340,height=600')
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
  const [taxRate, setTaxRate] = React.useState(0)
  const [showTax, setShowTax] = React.useState(false)
  const [showDonation, setShowDonation] = React.useState(false)
  // itemId → new desired qty (for sent items only; 0 = full void)
  const [itemAdjustments, setItemAdjustments] = React.useState<Record<number, number>>({})

  // Payment dialog state
  const [payDialogOpen, setPayDialogOpen] = React.useState(false)
  const [payMethod, setPayMethod]   = React.useState("cash")
  const [payAmount, setPayAmount]   = React.useState("")
  const [isSplitMode, setIsSplitMode] = React.useState(false)
  const [splitRows, setSplitRows]   = React.useState([
    { method: "cash", amount: "" },
    { method: "card", amount: "" },
  ])

  // ─── Load data when dialog opens ─────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setCart([])
    setSearch("")
    setOrderId(null)
    setOrderStatus("open")
    setWaiterName("")
    setItemAdjustments({})


    const init = async () => {
      try {
        // Load settings for receipt
        Promise.all([api.get("/settings"), api.get("/settings/receipt")]).then(([sRes, rRes]) => {
          const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace('/api', '')
          const s = sRes.data.data || sRes.data
          if (s?.store_name) setStoreName(s.store_name)
          if (s?.tax_rate) setTaxRate(parseFloat(s.tax_rate) || 0)
          if (s?.receipt_logo) setLogoUrl(`${base}${s.receipt_logo}`)
          if (s?.receipt_footer_message) setFooterMsg(s.receipt_footer_message)
          if (rRes.data?.success && rRes.data?.data) {
            const d = rRes.data.data
            if (d.receipt_logo) setLogoUrl(`${base}${d.receipt_logo}`)
            if (d.receipt_footer_message) setFooterMsg(d.receipt_footer_message)
            setShowTax(Boolean(d.receipt_show_tax))
            setShowDonation(Boolean(d.receipt_show_donation))
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

  const getDisplayQty = (item: OrderItem) =>
    item.id ? (itemAdjustments[item.id] ?? item.quantity) : item.quantity

  const subtotal    = cart.reduce((sum, i) => sum + getDisplayQty(i) * i.unit_price, 0)
  const taxAmount   = showTax ? parseFloat((subtotal * taxRate / 100).toFixed(2)) : 0
  const donationAmt = showDonation ? 1 : 0
  const total       = parseFloat((subtotal + taxAmount + donationAmt).toFixed(2))

  const hasAdjustments = Object.keys(itemAdjustments).length > 0

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
      printKOT(table.name, kotRes.data.data?.kot_number || 'KOT', newItems, waiterName, pax)
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
      printKOT(table.name, kotRes.data.data?.kot_number || 'KOT', newItems, waiterName, pax)
      toast({ title: "KOT Printed", description: "Slip print ho gayi — waiter kitchen le jaaye" })
    } catch {
      toast({ title: "Error", description: "Failed to send KOT", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Send Correction KOT (modify sent items + add new items) ────────────
  const handleSendCorrection = async () => {
    if (!orderId) return
    setSubmitting(true)
    try {
      // 1. Apply adjustments to sent items
      const voided: { name: string; qty: number }[] = []
      for (const [itemIdStr, newQty] of Object.entries(itemAdjustments)) {
        const itemId = parseInt(itemIdStr)
        const original = cart.find(i => i.id === itemId)
        if (!original) continue
        const reduced = original.quantity - newQty
        if (reduced > 0) voided.push({ name: original.product_name, qty: reduced })
        await api.patch(`/orders/${orderId}/items/${itemId}`, { quantity: newQty })
      }

      // 2. Send new unsent items as KOT (if any)
      const newItems = cart.filter(i => !i.id)
      let kotNumber = 'CORR'
      if (newItems.length > 0) {
        const kotRes = await api.post(`/orders/${orderId}/items`, {
          items: newItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
        })
        kotNumber = kotRes.data.data?.kot_number || 'CORR'
      }

      // 3. Print correction KOT
      printCorrectionKOT(table.name, kotNumber, voided, newItems, waiterName)

      // 4. Reload order + clear adjustments
      await loadOrder(orderId)
      setItemAdjustments({})
      toast({ title: "Correction Sent", description: "Kitchen ko correction slip mil gayi" })
    } catch {
      toast({ title: "Error", description: "Correction send nahi hua", variant: "destructive" })
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

    if (isSplitMode) {
      const splitPaid = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      if (splitPaid < total) {
        toast({ title: "Amount Kam Hai", description: `Rs. ${(total - splitPaid).toFixed(2)} aur chahiye.`, variant: "destructive" })
        return
      }
    } else {
      const paid = parseFloat(payAmount)
      if (isNaN(paid) || paid < total) {
        toast({ title: "Amount Kam Hai", description: `Minimum Rs. ${total.toLocaleString()} chahiye.`, variant: "destructive" })
        return
      }
    }

    setSubmitting(true)
    setPayDialogOpen(false)
    try {
      const splitPayload = isSplitMode
        ? splitRows.map(r => ({ method: r.method, amount: parseFloat(r.amount) || 0 }))
        : undefined

      const completeRes = await api.put(`/orders/${orderId}/complete`, {
        payment_method: isSplitMode ? 'split' : payMethod,
        ...(splitPayload && { payments: splitPayload }),
      })
      const saleId = completeRes.data?.data?.sale_id ?? null
      const saleNumber = completeRes.data?.data?.sale_number ?? null
      printReceipt({
        storeName,
        logoUrl,
        footerMsg,
        items: cart.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.unit_price, notes: i.notes })),
        invoiceNumber: saleNumber ? `INV-${String(saleNumber).padStart(6, '0')}` : (saleId ?? orderId),
        tableName: table.name,
        pax,
        waiterName: waiterName || '',
        orderType: 'DINE',
        subtotal,
        tax: taxAmount,
        taxLabel: taxRate > 0 ? `Tax (${taxRate}%)` : 'Tax',
        showTax,
        donation: donationAmt,
        showDonation,
        payMethod: isSplitMode ? 'split' : payMethod,
        amountPaid: isSplitMode ? splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) : parseFloat(payAmount),
        splitPayments: isSplitMode ? splitRows.map(r => ({ method: r.method, amount: parseFloat(r.amount) || 0 })) : undefined,
      })
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
              <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
                <span className="text-xs text-muted-foreground font-medium">Guests</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 touch-target-sm" onClick={() => setPax(p => Math.max(1, p - 1))} disabled={!!orderId}>
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="w-6 text-center font-bold text-sm">{pax}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 touch-target-sm" onClick={() => setPax(p => p + 1)} disabled={!!orderId}>
                  <Plus className="w-3.5 h-3.5" />
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
                        className={`text-left p-3 rounded-lg border transition-all min-h-[72px] active:scale-95 ${
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
                    {cart.map((item, idx) => {
                      const displayQty = getDisplayQty(item)
                      const isVoided   = item.id && displayQty === 0
                      const isReduced  = item.id && displayQty < item.quantity && displayQty > 0
                      return (
                        <div key={idx} className={`flex items-start gap-2 text-sm rounded-md p-1 -mx-1 ${isVoided ? 'bg-red-50 opacity-60' : isReduced ? 'bg-orange-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium leading-tight truncate ${isVoided ? 'line-through text-destructive' : ''}`}>
                              {item.product_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Rs. {item.unit_price.toLocaleString()} × {displayQty} = Rs. {(item.unit_price * displayQty).toLocaleString()}
                            </div>
                            {item.id && !isVoided && !isReduced && (
                              <Badge variant="outline" className="text-[9px] mt-0.5">Sent to kitchen</Badge>
                            )}
                            {isReduced && (
                              <Badge variant="outline" className="text-[9px] mt-0.5 border-orange-400 text-orange-600">
                                {item.quantity} → {displayQty} (correction)
                              </Badge>
                            )}
                            {isVoided && (
                              <Badge variant="outline" className="text-[9px] mt-0.5 border-red-400 text-red-600">VOID</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!item.id ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-9 w-9 touch-target-sm" onClick={() => updateQty(item.product_id, -1)}>
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-9 w-9 touch-target-sm" onClick={() => updateQty(item.product_id, 1)}>
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 touch-target-sm text-destructive" onClick={() => removeItem(item.product_id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1">
                                {/* Undo reduction */}
                                {displayQty < item.quantity && (
                                  <Button variant="ghost" size="icon" className="h-9 w-9 touch-target-sm text-green-600"
                                    onClick={() => setItemAdjustments(prev => {
                                      const n = Math.min(item.quantity, (prev[item.id!] ?? item.quantity) + 1)
                                      return { ...prev, [item.id!]: n }
                                    })}>
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <span className={`w-6 text-center text-xs font-bold ${isVoided ? 'text-destructive' : isReduced ? 'text-orange-600' : ''}`}>
                                  {displayQty}
                                </span>
                                {/* Reduce qty */}
                                {!isReadOnly && (
                                  <Button variant="ghost" size="icon" className="h-9 w-9 touch-target-sm text-destructive"
                                    onClick={() => setItemAdjustments(prev => {
                                      const n = Math.max(0, (prev[item.id!] ?? item.quantity) - 1)
                                      return { ...prev, [item.id!]: n }
                                    })}>
                                    <Minus className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
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
                        {/* Correction: sent items modified OR new items added together */}
                        {(hasAdjustments || newItemsInCart.length > 0) && hasAdjustments ? (
                          <Button className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSendCorrection} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                            Send Correction KOT
                          </Button>
                        ) : newItemsInCart.length > 0 && (
                          <Button className="w-full h-9" variant="outline" onClick={handleSendKot} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ChefHat className="w-4 h-4 mr-1" />}
                            Send KOT + Print Slip ({newItemsInCart.length} items)
                          </Button>
                        )}
                        <Button className="w-full h-9" onClick={handlePrintBill} disabled={submitting || cart.length === 0}>
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Printer className="w-4 h-4 mr-1" />}
                          Print Bill
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
                            setIsSplitMode(false)
                            setSplitRows([{ method: "cash", amount: "" }, { method: "card", amount: "" }])
                            setPayDialogOpen(true)
                          }}
                          disabled={submitting}
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                          Complete Payment
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
          <div className="space-y-3 py-2">
            {/* Bill Summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span><span>Rs. {subtotal.toLocaleString()}</span>
              </div>
              {showTax && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{taxRate > 0 ? `Tax (${taxRate}%)` : 'Tax'}</span>
                  <span>Rs. {taxAmount.toLocaleString()}</span>
                </div>
              )}
              {showDonation && (
                <div className="flex justify-between text-xs text-purple-600">
                  <span>Donation</span><span>Rs. 1.00</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1.5 border-t">
                <span>Total</span><span>Rs. {total.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Payment Method</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: "cash",   label: "Cash",   Icon: Banknote },
                  { key: "card",   label: "Card",   Icon: CreditCard },
                  { key: "wallet", label: "Wallet", Icon: QrCode },
                ].map(({ key, label, Icon }) => (
                  <Button key={key} size="sm"
                    variant={!isSplitMode && payMethod === key ? "default" : "outline"}
                    className="flex flex-col h-auto py-2 gap-1"
                    onClick={() => { setPayMethod(key); setIsSplitMode(false) }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{label}</span>
                  </Button>
                ))}
                <Button size="sm"
                  variant={isSplitMode ? "default" : "outline"}
                  className="flex flex-col h-auto py-2 gap-1"
                  onClick={() => setIsSplitMode(true)}
                >
                  <Split className="w-4 h-4" />
                  <span className="text-[11px]">Split</span>
                </Button>
              </div>
            </div>

            {/* Single Method: Cash received */}
            {!isSplitMode && (
              <div className="space-y-1.5">
                {payMethod === "cash" ? (
                  <>
                    <Label className="text-xs">Amount Received</Label>
                    <Input type="number" value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      placeholder={`Min Rs. ${total.toLocaleString()}`}
                    />
                    {parseFloat(payAmount) > total && (
                      <p className="text-sm text-green-600 font-medium">
                        Change: Rs. {(parseFloat(payAmount) - total).toLocaleString()}
                      </p>
                    )}
                    {parseFloat(payAmount) < total && payAmount !== "" && (
                      <p className="text-sm text-destructive">
                        Rs. {(total - parseFloat(payAmount)).toLocaleString()} aur chahiye
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    {payMethod === "card" ? "Card se exact amount lena hoga" : "Wallet se exact amount lena hoga"}
                  </p>
                )}
              </div>
            )}

            {/* Split Mode */}
            {isSplitMode && (() => {
              const splitPaid      = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
              const splitRemaining = parseFloat((total - splitPaid).toFixed(2))
              const cashPaid       = splitRows.filter(r => r.method === "cash").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
              const nonCashPaid    = splitRows.filter(r => r.method !== "cash").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
              const cashNeeded     = Math.max(0, total - nonCashPaid)
              const splitChange    = cashPaid > cashNeeded ? parseFloat((cashPaid - cashNeeded).toFixed(2)) : 0
              return (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  {splitRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Select value={row.method} onValueChange={v => setSplitRows(prev => prev.map((r, i) => i === idx ? { ...r, method: v } : r))}>
                        <SelectTrigger className="w-26 h-8 shrink-0 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="wallet">Wallet</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Amount" value={row.amount}
                        onChange={e => setSplitRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                        className="flex-1 h-8 text-sm"
                      />
                      {splitRows.length > 2 && (
                        <button onClick={() => setSplitRows(prev => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {splitRows.length < 3 && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs"
                      onClick={() => setSplitRows(prev => [...prev, { method: "wallet", amount: "" }])}>
                      <Plus className="w-3 h-3 mr-1" /> Add Method
                    </Button>
                  )}
                  {/* Summary */}
                  <div className="rounded-md bg-muted/60 p-2 space-y-1 text-xs border">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Entered</span><span className="font-medium text-foreground">Rs. {splitPaid.toLocaleString()}</span>
                    </div>
                    {splitRemaining > 0.009 && (
                      <div className="flex justify-between font-semibold text-destructive">
                        <span>Remaining</span><span>Rs. {splitRemaining.toFixed(2)}</span>
                      </div>
                    )}
                    {splitChange > 0 && (
                      <div className="flex justify-between font-semibold text-green-600">
                        <span>Change (Cash)</span><span>Rs. {splitChange.toFixed(2)}</span>
                      </div>
                    )}
                    {splitRemaining <= 0.009 && splitChange === 0 && (
                      <p className="text-green-600 font-medium">✓ Payment complete</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCompleteConfirm}
              disabled={submitting || (isSplitMode
                ? splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) < total
                : (payMethod === "cash" ? (!payAmount || parseFloat(payAmount) < total) : false))}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}

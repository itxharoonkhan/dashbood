"use client"

import * as React from "react"
import { X, Printer, Download, Edit2, Plus, Minus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  category?: string
}

interface ReceiptPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  subtotal: number
  tax: number
  discount: number
  loyaltyDiscount?: number
  total: number
  paymentMethod?: string
  orderNumber?: string
  tableNumber?: string
  customerName?: string
  customerPhone?: string
  storeName?: string
  orderTime?: Date
  splitPayments?: { method: string; amount: number }[]
}

export function ReceiptPrintDialog({
  open,
  onOpenChange,
  cart,
  subtotal,
  tax,
  discount,
  loyaltyDiscount = 0,
  total,
  paymentMethod = "Card",
  orderNumber = "------",
  tableNumber = "04",
  customerName,
  customerPhone,
  storeName,
  orderTime,
  splitPayments,
}: ReceiptPrintDialogProps) {
  const { toast } = useToast()
  const receiptRef = React.useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = React.useState(new Date())
  const [fetchedStoreName, setFetchedStoreName] = React.useState<string>("")
  const [isEditing, setIsEditing] = React.useState(false)
  const [editableCart, setEditableCart] = React.useState<CartItem[]>(cart)

  // Receipt customization settings
  const [receiptLogo, setReceiptLogo] = React.useState<string | null>(null)
  const [footerMessage, setFooterMessage] = React.useState<string>("Thank you for your visit!")
  const [showTaxLine, setShowTaxLine] = React.useState<boolean>(true)
  const [showDonationLine, setShowDonationLine] = React.useState<boolean>(false)

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
  const SERVER_BASE = API_BASE.replace('/api', '')

  // Fetch store name + receipt customization settings every time dialog opens
  React.useEffect(() => {
    if (!open) return

    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('authToken')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const [storeRes, receiptRes] = await Promise.all([
          fetch(`${API_BASE}/settings`, { headers }),
          fetch(`${API_BASE}/settings/receipt`, { headers }),
        ])

        if (storeRes.ok) {
          const storeData = await storeRes.json()
          const name = storeData?.data?.store_name || storeData?.settings?.store_name || ''
          if (name) setFetchedStoreName(storeName || name)
        }

        if (receiptRes.ok) {
          const receiptData = await receiptRes.json()
          if (receiptData?.success && receiptData?.data) {
            const d = receiptData.data
            setReceiptLogo(d.receipt_logo ?? null)
            setFooterMessage(d.receipt_footer_message || "Thank you for your visit!")
            setShowTaxLine(Boolean(d.receipt_show_tax))
            setShowDonationLine(Boolean(d.receipt_show_donation))
          }
        }
      } catch {
        // fallback: keep defaults
      }
    }

    if (storeName) setFetchedStoreName(storeName)
    fetchSettings()
  }, [open, storeName, API_BASE])

  React.useEffect(() => {
    setEditableCart(cart)
  }, [cart])

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const updateQuantity = (id: string, delta: number) => {
    setEditableCart(prev => 
      prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(0, item.quantity + delta)
          return { ...item, quantity: newQty }
        }
        return item
      }).filter(item => item.quantity > 0)
    )
  }

  const handleQuantityChange = (id: string, newQty: string) => {
    const qty = parseInt(newQty)
    if (!isNaN(qty) && qty >= 0) {
      setEditableCart(prev => 
        prev.map(item => {
          if (item.id === id) {
            return { ...item, quantity: qty }
          }
          return item
        }).filter(item => item.quantity > 0)
      )
    }
  }

  const recalculatedSubtotal = editableCart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const ratio = subtotal > 0 ? recalculatedSubtotal / subtotal : 0
  const recalculatedTax = showTaxLine ? tax * ratio : 0
  const donation = showDonationLine ? 1 : 0
  const recalculatedTotal = recalculatedSubtotal + recalculatedTax + donation - (discount || 0) - (loyaltyDiscount || 0)

  const handlePrint = () => {
    if (!receiptRef.current) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast({
        title: "Print Error",
        description: "Please allow popups to print receipt",
        variant: "destructive",
      })
      return
    }

    const receiptHTML = receiptRef.current.innerHTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            max-width: 80mm; 
            margin: 0 auto; 
            padding: 10mm;
            font-size: 12px;
          }
          .header { text-align: center; margin-bottom: 15px; }
          .header h1 { font-size: 20px; margin-bottom: 5px; }
          .header p { font-size: 11px; color: #666; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .items { margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .item-name { flex: 1; }
          .item-qty { margin: 0 10px; }
          .item-price { font-weight: bold; }
          .totals { margin: 10px 0; }
          .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .total-row.grand-total { 
            font-size: 16px; 
            font-weight: bold; 
            border-top: 2px solid #000; 
            padding-top: 5px; 
            margin-top: 5px; 
          }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; }
          .payment-info { margin: 10px 0; font-size: 11px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${receiptHTML}
        <script>
          window.onload = function() {
            window.print();
            window.onfocus = function() { 
              setTimeout(function() { window.close(); }, 500); 
            }
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()

    toast({
      title: "Print Started",
      description: "Receipt is being printed",
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-hidden flex flex-col z-[10000]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Receipt Preview</span>
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4 rounded-lg">
          <div
            ref={receiptRef}
            className="bg-white text-black p-4 rounded shadow-sm mx-auto"
            style={{ maxWidth: '300px', fontFamily: 'monospace' }}
          >
            {/* Store Header */}
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              {receiptLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${SERVER_BASE}${receiptLogo}`}
                  alt="Store logo"
                  style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', margin: '0 auto 8px' }}
                />
              )}
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>
                {fetchedStoreName || storeName || 'Elites POS'}
              </h1>
              <p style={{ fontSize: '10px', color: '#666' }}>POS Terminal</p>
              <p style={{ fontSize: '10px', marginTop: '4px' }}>
                {formatTime(orderTime || currentTime)}
              </p>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Order Info */}
            <div style={{ fontSize: '11px', margin: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Invoice #: {orderNumber}</span>
                <span></span>
              </div>
              <div style={{ marginTop: '2px' }}>
                Payment: {splitPayments && splitPayments.length >= 2 ? 'Split' : paymentMethod}
              </div>
              {customerName && (
                <div style={{ marginTop: '2px' }}>
                  Customer: {customerName}
                </div>
              )}
              {customerPhone && (
                <div style={{ marginTop: '2px' }}>
                  Phone: {customerPhone}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Items */}
            <div style={{ margin: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                <span style={{ flex: 1 }}>Item</span>
                <span style={{ margin: '0 8px' }}>Qty</span>
                <span>Price</span>
              </div>
              {editableCart.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px', alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ margin: '0 8px' }}>x{item.quantity}</span>
                  <span style={{ fontWeight: 'bold' }}>Rs. {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Totals */}
            <div style={{ margin: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0' }}>
                <span>Subtotal:</span>
                <span>Rs. {recalculatedSubtotal.toFixed(2)}</span>
              </div>
              {showTaxLine && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0' }}>
                  <span>Tax:</span>
                  <span>Rs. {recalculatedTax.toFixed(2)}</span>
                </div>
              )}
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0', color: '#16a34a' }}>
                  <span>Promo Code:</span>
                  <span>-Rs. {discount.toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0', color: '#d97706' }}>
                  <span>Loyalty Points:</span>
                  <span>-Rs. {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              {showDonationLine && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0', color: '#7c3aed' }}>
                  <span>Donation:</span>
                  <span>Rs. {donation.toFixed(2)}</span>
                </div>
              )}
              <div style={{ borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                  <span>TOTAL:</span>
                  <span>Rs. {recalculatedTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Split Payment Breakdown */}
            {splitPayments && splitPayments.length >= 2 && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                <div style={{ margin: '8px 0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Payment Breakdown</div>
                  {splitPayments.map((p, i) => {
                    const label = p.method === 'cash' ? 'Cash' : p.method === 'card' ? 'Card' : 'Wallet'
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0' }}>
                        <span>{label}</span>
                        <span>Rs. {p.amount.toFixed(2)}</span>
                      </div>
                    )
                  })}
                  {(() => {
                    const paidSum = splitPayments.reduce((s, p) => s + p.amount, 0)
                    const change = parseFloat((paidSum - recalculatedTotal).toFixed(2))
                    return change > 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0', fontWeight: 'bold' }}>
                        <span>Change Returned</span>
                        <span>Rs. {change.toFixed(2)}</span>
                      </div>
                    ) : null
                  })()}
                </div>
              </>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px' }}>
              <p style={{ fontWeight: 'bold' }}>{footerMessage}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4">
          <Button
            onClick={handlePrint}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

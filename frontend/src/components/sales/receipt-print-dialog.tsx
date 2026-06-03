"use client"

import * as React from "react"
import { Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { generateReceiptHTML, printReceipt } from "@/lib/print-receipt"

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
  paymentMethod = "Card",
  orderNumber = "------",
  tableNumber,
  customerName,
  customerPhone,
  storeName,
  orderTime,
  splitPayments,
}: ReceiptPrintDialogProps) {
  const { toast } = useToast()

  const [fetchedStoreName, setFetchedStoreName] = React.useState("")
  const [receiptLogo, setReceiptLogo]           = React.useState<string | null>(null)
  const [footerMessage, setFooterMessage]       = React.useState("Thank you for your visit!")
  const [showTaxLine, setShowTaxLine]           = React.useState(true)
  const [showDonationLine, setShowDonationLine] = React.useState(false)
  const [currentTime]                           = React.useState(new Date())

  const API_BASE    = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
  const SERVER_BASE = API_BASE.replace('/api', '')

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
        // keep defaults
      }
    }

    if (storeName) setFetchedStoreName(storeName)
    fetchSettings()
  }, [open, storeName, API_BASE])

  // Build opts for HTML generation
  const receiptOpts = React.useMemo(() => ({
    storeName: fetchedStoreName || storeName || 'Elites POS',
    logoUrl: receiptLogo ? `${SERVER_BASE}${receiptLogo}` : undefined,
    footerMsg: footerMessage,
    items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
    invoiceNumber: orderNumber || '------',
    orderTime: orderTime || currentTime,
    tableName: tableNumber,
    customerName,
    customerPhone,
    orderType: tableNumber ? 'DINE' : 'POS',
    subtotal,
    tax,
    taxLabel: 'Tax',
    showTax: showTaxLine,
    donation: 1,
    showDonation: showDonationLine,
    discount,
    loyaltyDiscount,
    payMethod: paymentMethod,
    splitPayments,
  }), [
    fetchedStoreName, storeName, receiptLogo, SERVER_BASE, footerMessage,
    cart, orderNumber, orderTime, currentTime, tableNumber, customerName, customerPhone,
    subtotal, tax, showTaxLine, showDonationLine, discount, loyaltyDiscount,
    paymentMethod, splitPayments,
  ])

  const previewHtml = React.useMemo(() => generateReceiptHTML(receiptOpts), [receiptOpts])

  const handlePrint = () => {
    printReceipt(receiptOpts)
    toast({ title: "Print Started", description: "Receipt is being printed" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-hidden flex flex-col z-[10000]">
        <DialogHeader>
          <DialogTitle>Receipt Preview</DialogTitle>
        </DialogHeader>

        {/* Receipt Preview — iframe showing exact print output */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4 rounded-lg flex justify-center">
          <iframe
            srcDoc={previewHtml}
            className="bg-white rounded shadow-sm"
            style={{ width: '300px', minHeight: '400px', border: 'none' }}
            scrolling="auto"
          />
        </div>

        {/* Print Button */}
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

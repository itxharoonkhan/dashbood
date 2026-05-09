"use client"

import * as React from "react"
import { X, CreditCard, Banknote, QrCode, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  onComplete: (customerData?: { name: string; phone: string }) => void
  onPaymentMethodChange?: (method: string) => void
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
  const [cashReceived, setCashReceived] = React.useState("")
  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("92-")
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isComplete, setIsComplete] = React.useState(false)

  const change = paymentMethod === "cash" ? Math.max(0, parseFloat(cashReceived || "0") - total) : 0

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // Allow empty to reset to default
    if (value.length < 3) {
      setCustomerPhone("92-")
      return
    }

    // Must start with 92- and then only digits, max 13 chars (92- + 10 digits)
    if (value.startsWith("92-")) {
      const digitsPart = value.substring(3)
      if (/^\d*$/.test(digitsPart) && digitsPart.length <= 10) {
        setCustomerPhone(value)
      }
    }
  }

  const handlePayment = () => {
    if (!customerName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter the customer name to proceed.",
        variant: "destructive",
      })
      return
    }

    if (paymentMethod === "cash" && parseFloat(cashReceived || "0") < total) {
      toast({
        title: "Insufficient amount",
        description: "Please enter enough cash to cover the total.",
        variant: "destructive",
      })
      return
    }

    // Phone validation: if anything is entered after 92-, it must be 10 digits
    const digitsOnly = customerPhone.substring(3)
    if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must have exactly 10 digits after '92-'.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // Parent ko payment method inform karo
    const methodLabels = { cash: "Cash", card: "Card", scan: "Scan" }
    onPaymentMethodChange?.(methodLabels[paymentMethod])

    // Final data
    const finalName = customerName.trim()
    const finalPhone = digitsOnly.length === 10 ? customerPhone : ""

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false)
      setIsComplete(true)

      toast({
        title: "Payment successful!",
        description: "Transaction completed successfully.",
      })

      // onComplete() ko thoda delay do taaki UI update ho jaye
      setTimeout(() => {
        // Pehle print dialog open karo
        onComplete({ name: finalName, phone: finalPhone })
        // Thoda wait karo taaki print dialog properly open ho
        setTimeout(() => {
          // Payment dialog close karo
          onOpenChange(false)
          setIsComplete(false)
          setCustomerName("")
          setCustomerPhone("92-")
          setCashReceived("")
        }, 100)
      }, 1500)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[10000]">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            {cart.length} items in cart
          </DialogDescription>
        </DialogHeader>

        {isComplete ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground">Transaction completed</p>
          </div>
        ) : (
          <>
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone (Optional)</Label>
                <Input
                  id="customerPhone"
                  placeholder="92-XXXXXXXXXX"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  type="tel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName" className="flex items-center gap-1">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerName"
                  placeholder="Required"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={!customerName.trim() ? "border-white/50" : ""}
                />
              </div>
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-2 max-h-40 overflow-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-foreground">
                    {item.name} x {item.quantity}
                  </span>
                  <span className="font-medium">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">Rs. {tax.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-Rs. {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-purple-500">
                <span>Donation</span>
                <span>Rs. 1.00</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">Rs. {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Card</span>
                </Button>
                <Button
                  variant={paymentMethod === "scan" ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod("scan")}
                >
                  <QrCode className="w-5 h-5" />
                  <span className="text-xs">Scan</span>
                </Button>
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <Label htmlFor="cash">Cash Received</Label>
                <Input
                  id="cash"
                  type="number"
                  placeholder="Enter amount"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="text-lg"
                />
                {cashReceived && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change:</span>
                    <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rs. {change.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                onClick={handlePayment}
                disabled={isProcessing || (paymentMethod === "cash" && parseFloat(cashReceived || "0") < total)}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : (
                  `Pay Rs. ${total.toFixed(2)}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

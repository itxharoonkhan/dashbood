"use client"

import * as React from "react"
import Image from "next/image"
import { Search, Minus, Plus, Trash2, ShoppingCart, Bell, Settings, LogOut, Printer, ChevronDown, ChevronUp, Globe, ScanLine, PauseCircle, Clock, RotateCcw, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import ProtectedRoute from "@/components/protected-route"
import { PaymentDialog } from "@/components/sales/payment-dialog"
import { ReceiptPrintDialog } from "@/components/sales/receipt-print-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import api from "@/lib/api"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  category: string
  variantId?: number
  variantName?: string
}

interface ProductVariant {
  id: number
  name: string
  price: number
}

interface AppliedCoupon {
  id: number
  code: string
  type: "flat" | "percentage"
  value: number
  discount: number
}

interface OrderData {
  cart: CartItem[]
  subtotal: number
  tax: number
  donation: number
  total: number
  paymentMethod: string
  orderNumber?: string
  customerName?: string
  customerPhone?: string
  orderTime?: Date
  couponDiscount?: number
  couponCode?: string
  loyaltyDiscount?: number
  splitPayments?: { method: string; amount: number }[]
  amountPaid?: number
}

interface HeldOrder {
  id: string
  cart: CartItem[]
  cartItems: Record<string, number>
  heldAt: Date
  subtotal: number
}

interface MenuItem {
  id: number
  name: string
  category: string
  price: number
  stock: number
  img: string
  has_variants: boolean
  variants: ProductVariant[]
}

// Categories will be dynamic


export default function POSPage() {
  const { toast } = useToast()
  const { t, language, setLanguage, isRTL } = useLanguage()
  const { logout } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = React.useState<any[]>([
    { id: 'all', nameKey: 'category.all', color: 'from-gray-500 to-gray-600' }
  ])
  const [cart, setCart] = React.useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [discount, setDiscount] = React.useState(0)
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [cartItems, setCartItems] = React.useState<Record<string, number>>({})
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = React.useState(true)
  const [orderNumber, setOrderNumber] = React.useState('------')
  const [showMobileCart, setShowMobileCart] = React.useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string>("Card")
  const [savedOrder, setSavedOrder] = React.useState<OrderData | null>(null)
  const [showAddedPopup, setShowAddedPopup] = React.useState(false)
  const [lastAddedItem, setLastAddedItem] = React.useState("")
  const [taxRate, setTaxRate] = React.useState(5)
  const [invoicePrefix, setInvoicePrefix] = React.useState('INV')
  const [barcodeInput, setBarcodeInput] = React.useState("")
  const [barcodeLoading, setBarcodeLoading] = React.useState(false)
  const barcodeRef = React.useRef<HTMLInputElement>(null)
  const searchRef  = React.useRef<HTMLInputElement>(null)
  // Selected cart item for +/- shortcuts
  const [selectedCartId, setSelectedCartId] = React.useState<string | null>(null)
  const [heldOrders, setHeldOrders] = React.useState<HeldOrder[]>([])
  const [showHeldPanel, setShowHeldPanel] = React.useState(false)

  // Variant selection
  const [variantProduct, setVariantProduct] = React.useState<MenuItem | null>(null)
  const [isVariantOpen, setIsVariantOpen] = React.useState(false)

  const [storeLogo, setStoreLogo] = React.useState<string | null>(null)
  const [storeName, setStoreName] = React.useState<string>("")
  const [showDonation, setShowDonation] = React.useState(false)

  // Fetch settings (tax rate + invoice prefix + logo + donation) from API
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings')
        const raw = res.data.data || res.data.settings || {}
        if (raw.tax_rate) setTaxRate(parseInt(raw.tax_rate) || 5)
        if (raw.invoice_prefix) setInvoicePrefix(raw.invoice_prefix)
        if (raw.receipt_logo) setStoreLogo(raw.receipt_logo)
        if (raw.store_name) setStoreName(raw.store_name)
        setShowDonation(raw.receipt_show_donation === true || raw.receipt_show_donation === 'true')
      } catch {
        // fallback to defaults
      }
    }
    fetchSettings()
  }, [])

  const playBeep = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      if (success) {
        osc.frequency.value = 1050
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      } else {
        osc.frequency.value = 300
        osc.type = 'square'
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.35)
      }
    } catch { /* audio not supported */ }
  }

  // Barcode search function
  const handleBarcodeSearch = async (code: string) => {
    const scannedCode = code.trim()
    if (!scannedCode) return
    setBarcodeLoading(true)
    try {
      const res = await api.get(`/products/barcode/${scannedCode}`)
      const p = res.data.data
      const stock = parseInt(p.stock) || 0
      if (stock <= 0) {
        playBeep(false)
        toast({ title: "Out of Stock", description: `${p.name} ka stock khatam ho gaya`, variant: "destructive" })
      } else {
        playBeep(true)
        setMenuItems(prev => prev.map(m => m.id === p.id ? { ...m, stock: m.stock - 1 } : m))
        setCartItems(prev => ({ ...prev, [p.id.toString()]: (prev[p.id.toString()] || 0) + 1 }))
        setCart(prev => {
          const existing = prev.find(item => item.id === p.id.toString())
          if (existing) return prev.map(item => item.id === p.id.toString() ? { ...item, quantity: item.quantity + 1 } : item)
          return [...prev, { id: p.id.toString(), name: p.name, price: parseFloat(p.selling_price) || 0, quantity: 1, category: p.category || 'General' }]
        })
        setLastAddedItem(p.name)
        setShowAddedPopup(true)
        setTimeout(() => setShowAddedPopup(false), 1500)
      }
    } catch (err: any) {
      playBeep(false)
      if (err.response?.status === 404) {
        toast({
          title: "Barcode Nahi Mila",
          description: `"${scannedCode}" — is barcode ka koi product nahi mila`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Scan Error",
          description: "Server se connect nahi ho pa raha, dobara try karo",
          variant: "destructive",
        })
      }
    } finally {
      setBarcodeInput("")
      setBarcodeLoading(false)
      barcodeRef.current?.focus()
    }
  }

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────────
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // F2 — Search bar focus
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }

      // F4 — Payment dialog open (cart mein items hon toh)
      if (e.key === 'F4') {
        e.preventDefault()
        if (!isPaymentOpen && cart.length > 0) setIsPaymentOpen(true)
        return
      }

      // Esc — Dialog band karo ya cart clear karo
      if (e.key === 'Escape') {
        if (isPaymentOpen) { setIsPaymentOpen(false); return }
        if (isVariantOpen) { setIsVariantOpen(false); return }
        if (selectedCartId)  { setSelectedCartId(null); return }
        return
      }

      // + / = — selected item ki quantity badhaao
      if ((e.key === '+' || e.key === '=') && !isTyping && selectedCartId) {
        e.preventDefault()
        updateQuantity(selectedCartId, 1)
        return
      }

      // - — selected item ki quantity ghataao
      if (e.key === '-' && !isTyping && selectedCartId) {
        e.preventDefault()
        updateQuantity(selectedCartId, -1)
        return
      }

      // Arrow Up / Down — cart mein item select karo
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !isTyping && cart.length > 0) {
        e.preventDefault()
        const idx = selectedCartId ? cart.findIndex(i => i.id === selectedCartId) : -1
        if (e.key === 'ArrowDown') {
          setSelectedCartId(cart[Math.min(idx + 1, cart.length - 1)].id)
        } else {
          setSelectedCartId(cart[Math.max(idx - 1, 0)].id)
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart, isPaymentOpen, isVariantOpen, selectedCartId])

  // Fetch menu items from API
  React.useEffect(() => {
    const fetchMenu = async () => {
      try {
        setMenuLoading(true)
        const res = await api.get('/menu')
        const items = res.data.data.items || []
        // Keyword → food image
        const KEYWORD_IMGS: [string, string][] = [
          ["biryani",    "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=250&fit=crop"],
          ["rice",       "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=400&h=250&fit=crop"],
          ["burger",     "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=250&fit=crop"],
          ["pizza",      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=250&fit=crop"],
          ["karahi",     "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=250&fit=crop"],
          ["curry",      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=250&fit=crop"],
          ["chicken",    "https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=400&h=250&fit=crop"],
          ["naan",       "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=250&fit=crop"],
          ["roti",       "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=250&fit=crop"],
          ["bread",      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=250&fit=crop"],
          ["sandwich",   "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=250&fit=crop"],
          ["wrap",       "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=250&fit=crop"],
          ["shawarma",   "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=250&fit=crop"],
          ["salad",      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=250&fit=crop"],
          ["soup",       "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=250&fit=crop"],
          ["pasta",      "https://images.unsplash.com/photo-1551183053-bf91798d792b?w=400&h=250&fit=crop"],
          ["nihari",     "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=250&fit=crop"],
          ["halwa",      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop"],
          ["cake",       "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=250&fit=crop"],
          ["drink",      "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=250&fit=crop"],
          ["juice",      "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=250&fit=crop"],
          ["tea",        "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=250&fit=crop"],
          ["chai",       "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=250&fit=crop"],
          ["coffee",     "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=250&fit=crop"],
          ["fish",       "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=250&fit=crop"],
          ["mutton",     "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=250&fit=crop"],
          ["beef",       "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=250&fit=crop"],
          ["fries",      "https://images.unsplash.com/photo-1576107232684-1279f8dd7c4f?w=400&h=250&fit=crop"],
          ["desi",       "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=250&fit=crop"],
        ]
        // Fallback pool — general food, rotates by product id
        const FALLBACK_POOL = [
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop",
          "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=250&fit=crop",
          "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=250&fit=crop",
          "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=250&fit=crop",
          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop",
          "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=250&fit=crop",
          "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=250&fit=crop",
        ]
        const getImg = (name: string, id: number) => {
          const lower = name.toLowerCase()
          const match = KEYWORD_IMGS.find(([kw]) => lower.includes(kw))
          return match ? match[1] : FALLBACK_POOL[id % FALLBACK_POOL.length]
        }
        const menuData = items.map((item: any, index: number) => ({
          id: item.id || index + 1,
          name: item.name,
          category: item.category || 'General',
          price: parseFloat(item.price) || 0,
          stock: parseInt(item.stock) || 0,
          img: item.image || getImg(item.name || "", item.id || index),
          has_variants: item.has_variants || false,
          variants: item.variants || [],
        }))
        setMenuItems(menuData)

        // Populate categories dynamically
        const uniqueCategories: string[] = [...new Set(items.map((item: any) => item.category).filter(Boolean)) as Set<string>]
        
        const colors = [
          'from-yellow-500 to-orange-500',
          'from-blue-500 to-cyan-500',
          'from-pink-500 to-rose-500',
          'from-amber-500 to-orange-500',
          'from-green-500 to-emerald-500',
          'from-purple-500 to-indigo-500'
        ];

        const dynamicCats = uniqueCategories.map((catName, idx) => ({
          id: catName,
          name: catName,
          color: colors[idx % colors.length]
        }));
        
        setCategories([
          { id: 'all', nameKey: 'category.all', color: 'from-gray-500 to-gray-600' },
          ...dynamicCats
        ]);
      } catch (err) {
        // Fallback: use empty state
        setMenuItems([])
      } finally {
        setMenuLoading(false)
      }
    }
    fetchMenu()
  }, [])

  const filteredProducts = menuItems.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const addToCartWithVariant = (product: MenuItem, variant: ProductVariant) => {
    if (product.stock <= 0) {
      toast({ title: t('menu.outOfStock'), description: `${product.name} out of stock`, variant: "destructive" })
      return
    }
    const cartId = `${product.id}_${variant.id}`
    const displayName = `${product.name} — ${variant.name}`
    setMenuItems(prev => prev.map(m => m.id === product.id ? { ...m, stock: m.stock - 1 } : m))
    setCartItems(prev => ({ ...prev, [cartId]: (prev[cartId] || 0) + 1 }))
    setCart(prev => {
      const existing = prev.find(item => item.id === cartId)
      if (existing) return prev.map(item => item.id === cartId ? { ...item, quantity: item.quantity + 1 } : item)
      return [...prev, { id: cartId, name: displayName, price: parseFloat(String(variant.price)) || 0, quantity: 1, category: product.category, variantId: variant.id, variantName: variant.name }]
    })
    setLastAddedItem(displayName)
    setShowAddedPopup(true)
    setTimeout(() => setShowAddedPopup(false), 1000)
    setIsVariantOpen(false)
    setVariantProduct(null)
  }

  const addToCart = (product: typeof menuItems[0]) => {
    // If product has variants, show variant picker
    if (product.has_variants && product.variants.length > 0) {
      setVariantProduct(product)
      setIsVariantOpen(true)
      return
    }

    if (product.stock <= 0) {
      toast({
        title: t('menu.outOfStock'),
        description: `${product.name} ${t('menu.left').toLowerCase()}`,
        variant: "destructive",
      })
      return
    }

    // Stock ko 1 kam karo
    setMenuItems(prev => prev.map(m =>
      m.id === product.id ? { ...m, stock: m.stock - 1 } : m
    ))

    setCartItems(prev => {
      const current = prev[product.id.toString()] || 0
      return { ...prev, [product.id.toString()]: current + 1 }
    })
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id.toString())
      if (existing) {
        return prev.map(item => item.id === product.id.toString() ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { id: product.id.toString(), name: product.name, price: product.price, quantity: 1, category: product.category }]
    })
    
    // Show localized popup instead of global toast
    setLastAddedItem(product.name)
    setShowAddedPopup(true)
    setTimeout(() => setShowAddedPopup(false), 1000)
  }

  // Extract product ID from cartId (handles both "5" and "5_3" variant format)
  const getProductId = (cartId: string) => parseInt(cartId.split('_')[0])

  const updateQuantity = (id: string, delta: number) => {
    const cartItem = cart.find(i => i.id === id)
    if (!cartItem) return

    const menuItem = menuItems.find(m => m.id === getProductId(id))
    if (!menuItem) return

    // Agar delta positive hai aur stock nahi hai toh return
    if (delta > 0 && menuItem.stock <= 0) {
      toast({
        title: "Out of Stock",
        description: `Cannot add more. ${menuItem.name} is out of stock.`,
        variant: "destructive",
      })
      return
    }

    // Agar quantity 1 hai aur minus click kiya, toh item remove karo
    if (cartItem.quantity === 1 && delta === -1) {
      removeFromCart(id)
      return
    }

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    }))
    setCartItems(prev => {
      const current = prev[id] || 0
      return { ...prev, [id]: current + delta }
    })

    // Stock update karo
    setMenuItems(prev => prev.map(m => {
      if (m.id === getProductId(id)) {
        return delta > 0
          ? { ...m, stock: m.stock - 1 }  // Add more = stock -1
          : { ...m, stock: m.stock + 1 }  // Remove = stock +1
      }
      return m
    }))
  }

  const removeFromCart = (id: string) => {
    const cartItem = cart.find(i => i.id === id)
    if (cartItem) {
      // Stock wapas add karo
      setMenuItems(prev => prev.map(m =>
        m.id === getProductId(id) ? { ...m, stock: m.stock + cartItem.quantity } : m
      ))
    }

    setCart(prev => prev.filter(item => item.id !== id))
    setCartItems(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
    toast({
      title: t('msg.removed'),
      description: `${cartItem?.name || 'Item'} - ${t('cart.empty')}`,
      variant: "destructive",
      duration: 2000,
    })
  }

  const clearCart = () => {
    // Saara stock wapas karo
    setMenuItems(prev => {
      const updated = [...prev]
      cart.forEach(cartItem => {
        const idx = updated.findIndex(m => m.id.toString() === cartItem.id)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], stock: updated[idx].stock + cartItem.quantity }
        }
      })
      return updated
    })

    setCart([])
    setCartItems({})
    setDiscount(0)
    toast({
      title: t('msg.cleared'),
      description: `${t('cart.orderedItems')} - ${t('cart.empty')}`,
      duration: 2000,
    })
  }

  const holdCurrentCart = () => {
    if (cart.length === 0) {
      toast({ title: "Cart Khali Hai", description: "Hold karne ke liye pehle items add karo", variant: "destructive" })
      return
    }
    const heldSubtotal = cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
    setHeldOrders(prev => [...prev, {
      id: Date.now().toString(),
      cart: [...cart],
      cartItems: { ...cartItems },
      heldAt: new Date(),
      subtotal: heldSubtotal,
    }])
    // Cart clear karo — stock restore mat karo (items reserved hain)
    setCart([])
    setCartItems({})
    setDiscount(0)
    toast({ title: "Order Hold Pe Rakha!", description: `${cart.length} item(s) hold pe hain — naya customer shuru karo`, duration: 2500 })
  }

  const recallHeldOrder = (held: HeldOrder) => {
    if (cart.length > 0) {
      // Pehle current cart ko bhi hold karo
      const curSubtotal = cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
      setHeldOrders(prev => prev
        .filter(h => h.id !== held.id)
        .concat([{ id: Date.now().toString(), cart: [...cart], cartItems: { ...cartItems }, heldAt: new Date(), subtotal: curSubtotal }])
      )
    } else {
      setHeldOrders(prev => prev.filter(h => h.id !== held.id))
    }
    setCart(held.cart)
    setCartItems(held.cartItems)
    setDiscount(0)
    setShowHeldPanel(false)
    toast({ title: "Order Recall Ho Gaya!", description: `${held.cart.length} item(s) cart mein wapas`, duration: 2000 })
  }

  const discardHeldOrder = (held: HeldOrder) => {
    // Stock wapas karo
    setMenuItems(prev => {
      const updated = [...prev]
      held.cart.forEach(cartItem => {
        const idx = updated.findIndex(m => m.id.toString() === cartItem.id.split('-')[0])
        if (idx !== -1) updated[idx] = { ...updated[idx], stock: updated[idx].stock + cartItem.quantity }
      })
      return updated
    })
    setHeldOrders(prev => prev.filter(h => h.id !== held.id))
    toast({ title: "Order Cancel Kiya", description: "Held order discard ho gaya", duration: 2000 })
  }

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0)
  const tax = parseFloat((subtotal * (taxRate / 100)).toFixed(2))
  const donation = showDonation ? 1 : 0
  const total = subtotal + tax + donation

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: t('msg.cartEmpty'),
        description: t('msg.cartEmptyDesc'),
        variant: "destructive",
      })
      return
    }
    setIsPaymentOpen(true)
  }

  const handlePaymentComplete = async (customerData?: { name: string; phone: string; coupon?: AppliedCoupon; loyaltyPointsRedeemed?: number; splitPayments?: { method: string; amount: number }[]; paymentMethod?: string; amountPaid?: number }) => {
    if (cart.length === 0) {
      toast({
        title: t('msg.cartEmpty'),
        description: t('msg.cartEmptyDesc'),
        variant: "destructive",
      })
      return
    }

    try {
      // Create sale items for backend (extract product ID from variant cartId)
      const saleItems = cart.map(item => ({
        product_id: getProductId(item.id),
        quantity: item.quantity,
        price: item.price,
      }))

      const couponDiscount = customerData?.coupon?.discount ?? 0
      const loyaltyDiscount = customerData?.loyaltyPointsRedeemed ?? 0
      const finalTotal = total - couponDiscount - loyaltyDiscount

      const isSplit = !!(customerData?.splitPayments && customerData.splitPayments.length >= 2)
      const response = await api.post('/sales', {
        items: saleItems,
        payment_method: isSplit ? 'split' : selectedPaymentMethod,
        ...(isSplit && { payments: customerData!.splitPayments }),
        amount_paid: finalTotal,
        cash_received: customerData?.amountPaid ?? null,
        discount: 0,
        tax: tax,
        customer_name: customerData?.name,
        customer_phone: customerData?.phone,
        coupon_code: customerData?.coupon?.code ?? null,
        coupon_discount: couponDiscount,
        loyalty_points_redeem: loyaltyDiscount,
      })

      if (response.data.success) {
        const invoiceSeq = response.data.sale_number ?? response.data.sale_id
        const formattedOrderNumber = `${invoicePrefix}-${String(invoiceSeq).padStart(6, '0')}`

        const couponDiscount = customerData?.coupon?.discount ?? 0
        const loyaltyDiscount = customerData?.loyaltyPointsRedeemed ?? 0
        const orderData: OrderData = {
          cart: [...cart],
          subtotal,
          tax,
          donation,
          total: total - couponDiscount - loyaltyDiscount,
          paymentMethod: selectedPaymentMethod,
          orderNumber: formattedOrderNumber,
          customerName: customerData?.name,
          customerPhone: customerData?.phone,
          orderTime: new Date(),
          couponDiscount,
          couponCode: customerData?.coupon?.code,
          loyaltyDiscount,
          splitPayments: customerData?.splitPayments,
          amountPaid: customerData?.amountPaid,
        }
        setSavedOrder(orderData)
        setCart([])
        setCartItems({})
        setDiscount(0)
        setShowMobileCart(false)
        setOrderNumber('------')
        setIsPaymentOpen(false)    // close payment dialog immediately
        setIsPrintDialogOpen(true) // open print dialog immediately

        toast({ title: t('msg.paymentSuccess'), description: t('msg.orderPlaced') })

        const pointsEarned = response.data.points_earned ?? 0
        if (pointsEarned > 0 && customerData?.name) {
          setTimeout(() => {
            toast({
              title: `⭐ ${pointsEarned} Points Earned!`,
              description: `${customerData.name} ko ${pointsEarned} loyalty points mile — Total sale se`,
            })
          }, 600)
        }
      } else {
        toast({
          title: "Sale Failed",
          description: response.data.message || "Failed to complete sale",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Sale error:', error)
      toast({
        title: "Sale Failed",
        description: error.response?.data?.message || "Failed to complete sale",
        variant: "destructive",
      })
    }
  }

  return (
    <ProtectedRoute>
      <div className="h-[100dvh] w-full flex flex-col overflow-visible max-w-[100vw]" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header - Optimized for 320px+ screens */}
        <header className="bg-card border-b border-white px-2 xs:px-2.5 sm:px-4 md:px-6 py-2 xs:py-2.5 sm:py-3 flex-shrink-0 safe-top relative z-50">
        <div className="flex items-center justify-between gap-1.5 xs:gap-2 max-w-full overflow-x-visible">
          {/* Logo Section */}
          <div className="flex items-center gap-1.5 xs:gap-2 flex-shrink-0 min-w-0">
            {storeLogo ? (
              <img
                src={storeLogo}
                alt="Store Logo"
                className="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full object-cover border-2 border-primary/30 shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-lg text-white flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 md:w-6 md:h-6">
                  <path d="M3 18L5 6L9 12L12 4L15 12L19 6L21 18H3Z" fill="currentColor"/>
                </svg>
              </div>
            )}
            <div className="hidden xs:block min-w-0">
              <h1 className="text-xs xs:text-sm sm:text-base md:text-lg font-bold text-foreground leading-tight truncate">
                {storeName || t('app.title')}
              </h1>
              <p className="text-[7px] xs:text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground font-medium">{t('pos.terminal')}</p>
            </div>
          </div>

          {/* Search + Barcode - Hidden on mobile, shown on md+ */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-4 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder={`${t('header.search')} (F2)`}
                className="pl-10 h-10 text-sm border-white bg-muted/50 focus:bg-card focus:border-white focus:ring-2 focus:ring-white/20 rounded-full text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative w-44">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={barcodeRef}
                  placeholder="Scan barcode..."
                  className="pl-10 h-10 text-sm border-white bg-muted/50 focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-full text-foreground"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBarcodeSearch(barcodeInput) }}
                  disabled={barcodeLoading}
                />
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 xs:gap-2">

            {/* Mobile Cart Button */}
            <button
              className="lg:hidden relative w-10 h-10 xs:w-11 xs:h-11 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors active:scale-95 border-2 border-white/30"
              onClick={() => setShowMobileCart(!showMobileCart)}
              aria-label="Toggle cart"
            >
              <ShoppingCart className="w-5 h-5 text-primary" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 xs:w-6 xs:h-6 bg-primary text-white text-[10px] xs:text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                  {cart.length}
                </span>
              )}
            </button>

            <button
              className="hidden md:flex w-9 h-9 rounded-full bg-muted hover:bg-muted/80 items-center justify-center transition-colors relative"
              onClick={() => router.push('/notifications')}
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
            </button>
            <button 
              className="hidden md:flex w-9 h-9 rounded-full bg-muted hover:bg-muted/80 items-center justify-center transition-colors"
              onClick={() => router.push('/settings')}
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </button>
            <button 
              className="hidden md:flex w-9 h-9 rounded-full bg-muted hover:bg-destructive/20 items-center justify-center transition-colors group"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
            </button>
          </div>
        </div>

        {/* Mobile Search Bar - Optimized for small screens */}
        <div className="mt-1.5 xs:mt-2 md:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 xs:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 xs:h-4 xs:w-4 text-muted-foreground" />
            <Input
              placeholder={t('header.search.mobile')}
              className="pl-9 xs:pl-10 h-8 xs:h-9 text-xs xs:text-sm border-white bg-muted/50 focus:bg-card focus:border-white focus:ring-2 focus:ring-white/20 rounded-full text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        cart={cart}
        subtotal={subtotal}
        tax={tax}
        discount={discount}
        total={total}
        onComplete={handlePaymentComplete}
        onPaymentMethodChange={setSelectedPaymentMethod}
      />

      {/* Variant Selection Dialog */}
      {isVariantOpen && variantProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setIsVariantOpen(false)}>
          <div className="bg-background border border-white rounded-2xl shadow-2xl w-80 max-w-[92vw] p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">{variantProduct.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Select a variant to add to cart</p>
            <div className="space-y-2">
              {variantProduct.variants.map(variant => (
                <button
                  key={variant.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white hover:bg-primary/10 hover:border-primary transition-all text-left"
                  onClick={() => addToCartWithVariant(variantProduct, variant)}
                >
                  <span className="font-medium">{variant.name}</span>
                  <span className="font-bold text-primary">Rs. {Number(variant.price).toLocaleString()}</span>
                </button>
              ))}
            </div>
            <button className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsVariantOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ReceiptPrintDialog
        open={isPrintDialogOpen}
        onOpenChange={(open) => {
          setIsPrintDialogOpen(open)
          // Jab print dialog band ho to saved order clear karo
          if (!open) {
            setSavedOrder(null)
          }
        }}
        cart={savedOrder?.cart || cart}
        subtotal={savedOrder?.subtotal || subtotal}
        tax={savedOrder?.tax || tax}
        discount={savedOrder?.couponDiscount ?? 0}
        loyaltyDiscount={savedOrder?.loyaltyDiscount ?? 0}
        total={savedOrder?.total || total}
        paymentMethod={savedOrder?.paymentMethod || selectedPaymentMethod}
        orderNumber={savedOrder?.orderNumber || orderNumber}
        customerName={savedOrder?.customerName}
        customerPhone={savedOrder?.customerPhone}
        orderTime={savedOrder?.orderTime}
        splitPayments={savedOrder?.splitPayments}
        amountPaid={savedOrder?.amountPaid}
      />

      {/* Main Content - Optimized for 320px+ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 xs:gap-3 sm:gap-4 p-2 xs:p-3 sm:p-4 pb-16 xs:pb-20 lg:pb-4 min-h-0 overflow-hidden relative">
        {/* Mobile Cart Placeholder Bar - Shows when cart is closed and has items */}
        {!showMobileCart && cart.length > 0 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-white shadow-2xl safe-bottom">
            <div
              className="flex items-center justify-between p-3 xs:p-4 cursor-pointer active:bg-muted/50 transition-colors"
              onClick={() => setShowMobileCart(true)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm text-foreground">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{t('cart.total')}</p>
                  <p className="font-bold text-base text-primary">Rs. {total.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-primary font-semibold text-sm flex-shrink-0">
                <span>{t('payment.checkout')}</span>
                <ChevronUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Cart Overlay Background */}
        {showMobileCart && (
          <div className="fixed inset-0 bg-black/50 z-[9998] lg:hidden" onClick={() => setShowMobileCart(false)} />
        )}
        {/* Foodies Menu */}
        <div className={`lg:col-span-8 flex flex-col gap-2 xs:gap-3 sm:gap-4 min-h-0 ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>

          {/* Foodies Menu Section */}
          <Card className="border border-white bg-card rounded-xl xs:rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col relative z-0">
            {/* Local Added Popup */}
            {showAddedPopup && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
                <div className="bg-primary text-black px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white/20 backdrop-blur-md">
                  <div className="bg-black/20 rounded-full p-1">
                    <Plus className="w-3 h-3 text-black" />
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap">{t('msg.addedToCart')}: {lastAddedItem}</span>
                </div>
              </div>
            )}
            <CardHeader className="pb-2 xs:pb-3 border-b border-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm xs:text-base sm:text-lg font-bold text-foreground flex items-center gap-1.5 xs:gap-2">
                  {storeLogo ? (
                    <img src={storeLogo} alt="logo" className="h-7 w-7 xs:h-8 xs:w-8 rounded-full object-cover border border-white/20 flex-shrink-0" />
                  ) : (
                    <span className="text-base xs:text-lg sm:text-xl">🍦</span>
                  )}
                  <span className="hidden xs:inline">{storeName || t('menu.title')}</span>
                  <span className="xs:hidden">Menu</span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2 xs:p-3 sm:p-4 space-y-3 xs:space-y-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Category Tabs - Horizontally scrollable on mobile */}
              <div className="flex gap-1 xs:gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 xs:pb-2 flex-shrink-0 scrollbar-hide -mx-2 px-2 xs:mx-0 xs:px-0 snap-x snap-mandatory">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-shrink-0 snap-start px-3 xs:px-3.5 sm:px-4 py-2 xs:py-2.5 sm:py-3 rounded-lg xs:rounded-xl border-2 transition-all min-w-[80px] xs:min-w-[85px] sm:min-w-[100px] active:scale-95 touch-manipulation ${
                      selectedCategory === cat.id
                        ? `bg-gradient-to-r ${cat.color} border-transparent text-white shadow-lg scale-105`
                        : 'bg-card border-white text-muted-foreground hover:border-white'
                    }`}
                  >
                    <p className={`font-semibold text-[10px] xs:text-[11px] sm:text-sm whitespace-nowrap ${selectedCategory === cat.id ? 'text-white' : 'text-foreground'}`}>{cat.nameKey ? t(cat.nameKey as any) : cat.name}</p>
                    <p className={`text-[9px] xs:text-[10px] sm:text-[11px] mt-0.5 whitespace-nowrap ${selectedCategory === cat.id ? 'text-white/80' : 'text-muted-foreground'}`}>{cat.id === 'all' ? menuItems.length : menuItems.filter(m => m.category === cat.id).length} items</p>
                  </button>
                ))}
              </div>

              {/* Menu Grid - 1 col mobile, 2 col tablet, 3-4 col desktop */}
              <ScrollArea className="flex-1 min-h-0 scrollbar-thin relative z-[1]">
                {menuLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                ) : menuItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No menu items available</p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
                  {filteredProducts.map((product) => {
                    const quantity = cartItems[product.id.toString()] || 0
                    const isOutOfStock = product.stock <= 0

                    return (
                      <div
                        key={product.id}
                        className={`group relative flex flex-col text-left p-1.5 xs:p-2 sm:p-2.5 md:p-3 rounded-lg xs:rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                          isOutOfStock
                            ? 'opacity-60 border-white cursor-not-allowed'
                            : quantity > 0
                              ? 'border-white bg-primary/10 shadow-md'
                              : 'border-white hover:border-white bg-card hover:shadow-lg'
                        }`}
                        style={{ zIndex: 1, wordBreak: 'break-word' }}
                      >
                        <div className="relative h-28 xs:h-32 sm:h-36 md:h-40 mb-1.5 xs:mb-2 sm:mb-3 rounded-md xs:rounded-lg overflow-hidden bg-muted">
                          <Image
                            src={product.img}
                            alt={product.name}
                            fill
                            className={`object-cover group-hover:scale-110 transition-transform duration-300 ${isOutOfStock ? 'grayscale' : ''}`}
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                          />
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Badge className="bg-red-500 text-white text-[9px] xs:text-xs">❌ Out of Stock</Badge>
                            </div>
                          )}
                        </div>
                        <div className="mb-1.5 xs:mb-2 flex-1 min-h-0">
                          <Badge className={`text-[8px] xs:text-[9px] sm:text-[10px] mb-1 font-semibold border-0 ${
                            quantity > 0 ? 'bg-gradient-to-r from-primary to-secondary text-white' : 'bg-muted text-muted-foreground'
                          }`}>{product.category}</Badge>
                          <h3 className="font-semibold text-[10px] xs:text-xs sm:text-sm line-clamp-2 text-foreground leading-tight break-words break-all max-w-full">{product.name}</h3>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="min-w-0 flex-1">
                            <span className="text-primary font-bold text-[10px] xs:text-xs sm:text-sm">Rs. {product.price}.00</span>
                            <p className={`text-[8px] xs:text-[9px] sm:text-[10px] font-semibold truncate ${
                              isOutOfStock ? 'text-red-500' : product.stock <= 5 ? 'text-orange-500' : 'text-green-600'
                            }`}>
                              {isOutOfStock ? '❌ Out' : `✓ ${product.stock} left`}
                            </p>
                          </div>
                          {(quantity > 0 || !isOutOfStock) && (
                            <>
                              {quantity === 0 ? (
                                <div
                                  onClick={(e) => { e.stopPropagation(); addToCart(product) }}
                                  className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 flex items-center justify-center transition-all shadow-md cursor-pointer active:scale-90 flex-shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-0.5 xs:gap-1 bg-card rounded-full shadow-md border-2 border-white flex-shrink-0">
                                  <div
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(product.id.toString(), -1) }}
                                    className="w-6 h-6 xs:w-7 xs:h-7 rounded-full hover:bg-primary/10 flex items-center justify-center transition-colors cursor-pointer active:scale-90"
                                  >
                                    <Minus className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-primary" />
                                  </div>
                                  <span className="w-3.5 xs:w-4 text-center text-[10px] xs:text-xs font-bold text-primary">{quantity}</span>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(product.id.toString(), 1) }}
                                    className={`w-6 h-6 xs:w-7 xs:h-7 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                                      isOutOfStock 
                                        ? 'bg-muted opacity-50 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80'
                                    }`}
                                  >
                                    <Plus className={`w-2.5 h-2.5 xs:w-3 xs:h-3 ${isOutOfStock ? 'text-muted-foreground' : 'text-white'}`} />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Cart / Order Summary Sidebar */}
        <Card className={`lg:col-span-4 flex flex-col shadow-2xl border border-white overflow-hidden bg-card rounded-xl xs:rounded-2xl z-50 ${
          showMobileCart
            ? 'fixed inset-0 z-[9999] lg:static lg:z-auto m-0 rounded-none lg:rounded-2xl safe-bottom flex-col'
            : 'hidden lg:flex'
        }`}>
          {/* Mobile Close Button */}
          <div className="lg:hidden flex justify-end p-2 border-b border-white">
            <button
              onClick={() => setShowMobileCart(false)}
              className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center touch-target-sm active:scale-90"
              aria-label="Close cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="p-2 xs:p-3 md:p-4 border-b border-white flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm xs:text-base md:text-lg font-semibold text-foreground truncate">{t('cart.title')}</h3>
              <div className="flex gap-1.5 xs:gap-2 flex-shrink-0">
                {heldOrders.length > 0 && (
                  <button
                    onClick={() => setShowHeldPanel(true)}
                    className="relative flex items-center gap-1 px-2 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 transition-colors active:scale-90"
                    title="Held orders dekho"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-500">{heldOrders.length}</span>
                  </button>
                )}
                <button
                  onClick={clearCart}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/20 transition-colors active:scale-90"
                  aria-label={t('cart.clear')}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 xs:gap-x-4 gap-y-1">
              <p className="text-[10px] xs:text-xs md:text-sm text-muted-foreground">{t('cart.order')} {orderNumber}</p>
            </div>
          </div>

          {/* Ordered Items */}
          <CardContent className="flex-1 p-2 xs:p-3 md:p-4 min-h-0 overflow-y-auto flex flex-col">
            <ScrollArea className="flex-1 min-h-0 max-h-[40vh] scrollbar-thin">
              <div className="flex items-center justify-between mb-2 xs:mb-3">
                <h4 className="font-semibold text-xs xs:text-sm md:text-base text-foreground">{t('cart.orderedItems')}</h4>
                <span className="text-[10px] xs:text-xs md:text-sm text-muted-foreground">{cart.length}</span>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-6 xs:py-8 text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-[10px] xs:text-sm">{t('cart.empty')}</p>
                </div>
              ) : (
                <div className="space-y-1.5 xs:space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedCartId(item.id === selectedCartId ? null : item.id)}
                      className={`flex justify-between items-center p-2 xs:p-2.5 sm:p-3 rounded-lg xs:rounded-xl cursor-pointer transition-all ${
                        selectedCartId === item.id
                          ? 'bg-primary/15 border border-primary/40 ring-1 ring-primary/20'
                          : 'bg-muted/50 border border-transparent hover:bg-muted/70'
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-1.5 xs:mr-2">
                        <p className="font-medium text-xs xs:text-xs md:text-sm text-foreground truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-0.5 bg-card rounded-full shadow-sm border border-white">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1) }}
                              className="w-8 h-8 xs:w-9 xs:h-9 rounded-full hover:bg-primary/10 flex items-center justify-center transition-colors active:scale-90 touch-target-sm"
                            >
                              <Minus className="w-3 h-3 text-primary" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-foreground">{item.quantity}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1) }}
                              className="w-8 h-8 xs:w-9 xs:h-9 rounded-full hover:bg-primary/10 flex items-center justify-center transition-colors active:scale-90 touch-target-sm"
                            >
                              <Plus className="w-3 h-3 text-primary" />
                            </button>
                          </div>
                          <p className="text-[10px] md:text-xs text-muted-foreground">x Rs. {Number(item.price).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 xs:gap-2 flex-shrink-0">
                        <span className="font-bold text-primary text-xs xs:text-xs md:text-sm">Rs. {(Number(item.price) * item.quantity).toFixed(2)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromCart(item.id) }}
                          className="w-9 h-9 rounded-full hover:bg-destructive/20 flex items-center justify-center transition-colors active:scale-90 touch-target-sm"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Payment Summary */}
            <div className="mt-3 xs:mt-4 pt-3 xs:pt-4 border-t border-white flex-shrink-0">
              <h4 className="font-semibold text-xs xs:text-sm md:text-base text-foreground mb-2 xs:mb-3">{t('payment.summary')}</h4>
              <div className="space-y-1.5 xs:space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('payment.subtotal')}</span>
                  <span className="font-medium text-foreground">Rs. {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('payment.tax')} ({taxRate}%)</span>
                  <span className="font-medium text-foreground">Rs. {tax.toFixed(2)}</span>
                </div>
                {showDonation && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('payment.donation')}</span>
                    <span className="font-medium text-primary">Rs. 1.00</span>
                  </div>
                )}
              </div>
              <Separator className="my-2 xs:my-3" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-xs xs:text-sm md:text-base text-foreground">{t('payment.totalPayable')}</span>
                <span className="text-lg xs:text-lg md:text-xl font-bold text-primary">Rs. {total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col bg-muted/30 p-2 xs:p-3 md:p-4 space-y-2 xs:space-y-2.5 sm:space-y-3 border-t border-white flex-shrink-0 safe-bottom">
            {/* On-screen shortcut buttons — only on touch devices */}
            <div className="touch-shortcut-bar w-full gap-2 mb-1">
              <button
                onClick={() => searchRef.current?.focus()}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border bg-muted/50 text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
              >
                <Search className="w-3.5 h-3.5" />
                Search (F2)
              </button>
              <button
                onClick={() => { if (!isPaymentOpen && cart.length > 0) setIsPaymentOpen(true) }}
                disabled={cart.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-primary/30 bg-primary/10 text-xs font-medium text-primary active:scale-95 transition-transform disabled:opacity-40"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Pay Now (F4)
              </button>
            </div>
            {/* Action Buttons */}
            <div className="flex gap-1.5 xs:gap-2 w-full">
              <Button
                variant="outline"
                className="flex items-center justify-center gap-1 text-xs h-10 px-3 active:scale-95 touch-target-sm shrink-0"
                onClick={() => setIsPrintDialogOpen(true)}
                title="Print"
              >
                <Printer className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-1 text-xs h-10 px-3 active:scale-95 touch-target-sm shrink-0 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 disabled:opacity-40"
                disabled={cart.length === 0}
                onClick={holdCurrentCart}
                title="Hold Order"
              >
                <PauseCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Hold</span>
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-semibold text-xs md:text-sm h-10 active:scale-95 touch-target-sm"
                disabled={cart.length === 0}
                onClick={handleCheckout}
              >
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{t('payment.placeOrder')}</span>
                <span className="sm:hidden">{t('payment.checkout')}</span>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
      {/* ── Held Orders Dialog ── */}
      <Dialog open={showHeldPanel} onOpenChange={setShowHeldPanel}>
        <DialogContent className="sm:max-w-[420px] z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-amber-500" />
              Hold Pe Rakhe Orders ({heldOrders.length})
            </DialogTitle>
          </DialogHeader>
          {heldOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Koi held order nahi hai</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {heldOrders.map((held, idx) => (
                <div key={held.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-sm font-semibold text-foreground">Order #{idx + 1}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {held.heldAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">Rs. {held.subtotal.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">{held.cart.reduce((s, i) => s + i.quantity, 0)} items</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                    {held.cart.slice(0, 3).map(item => (
                      <div key={item.id} className="flex justify-between">
                        <span className="truncate pr-2">{item.name}{item.variantName ? ` (${item.variantName})` : ''}</span>
                        <span className="shrink-0">×{item.quantity}</span>
                      </div>
                    ))}
                    {held.cart.length > 3 && (
                      <p className="text-muted-foreground/70">+{held.cart.length - 3} aur items...</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                      onClick={() => recallHeldOrder(held)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Recall
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => discardHeldOrder(held)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </ProtectedRoute>
  )
}

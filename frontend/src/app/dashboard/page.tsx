"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Activity,
  Calendar,
  Loader2,
  CreditCard,
  User,
  Clock,
  Receipt,
  Printer,
  Undo2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AIInsights } from "@/components/dashboard/ai-insights"

import { DonutChart } from "@/components/DonutChart"
import { useLanguage } from "@/contexts/language-context"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import { printReturnReceipt, generateReceiptHTML } from "@/lib/print-receipt"

interface DashboardStats {
  todayRevenue: number
  todaySales: number
  totalCustomers: number
  lowStock: number
  weekRevenue: number
  monthRevenue: number
}

function parseSplitBreakdown(str?: string | null): { method: string; amount: number }[] | null {
  if (!str) return null
  return str.split('|').map(part => {
    const idx = part.indexOf(':')
    return { method: part.slice(0, idx), amount: parseFloat(part.slice(idx + 1)) }
  })
}

function getPaymentBadgeLabel(sale: any): string {
  if (sale.payment_method === 'split' && sale.split_breakdown) {
    const parts = parseSplitBreakdown(sale.split_breakdown)
    if (parts) return parts.map(p => p.method.charAt(0).toUpperCase() + p.method.slice(1)).join(' + ')
  }
  return sale.payment_method || 'cash'
}

export default function DashboardPage() {
  const { t, isRTL } = useLanguage()
  const { toast } = useToast()
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [recentSales, setRecentSales] = React.useState<any[]>([])
  const [topCategories, setTopCategories] = React.useState<any[]>([])
  const [dailySales, setDailySales] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedSale, setSelectedSale] = React.useState<any>(null)
  const [saleDetail, setSaleDetail] = React.useState<any>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [returnMode, setReturnMode] = React.useState(false)
  const [returnQtys, setReturnQtys] = React.useState<Record<number, number>>({})
  const [returnReason, setReturnReason] = React.useState('')
  const [returnLoading, setReturnLoading] = React.useState(false)
  const [existingReturns, setExistingReturns] = React.useState<{ returns: any[], returned_qtys: Record<number, number> }>({ returns: [], returned_qtys: {} })
  const [receiptStoreName, setReceiptStoreName] = React.useState("Elites POS")
  const [receiptLogoUrl, setReceiptLogoUrl]     = React.useState("")
  const [receiptFooterMsg, setReceiptFooterMsg] = React.useState("Thank you for your visit!")

  const openSaleDetail = async (sale: any) => {
    setSelectedSale(sale)
    setSaleDetail(null)
    setDetailLoading(true)
    setReturnMode(false)
    setReturnReason('')
    setReturnQtys({})
    setExistingReturns({ returns: [], returned_qtys: {} })
    try {
      const [detailRes, returnsRes] = await Promise.all([
        api.get(`/sales/${sale.id}`),
        api.get(`/sales/${sale.id}/returns`).catch(() => null)
      ])
      if (detailRes.data.success) setSaleDetail(detailRes.data.data)
      if (returnsRes?.data?.success) setExistingReturns(returnsRes.data.data)
    } catch {
      setSaleDetail({ sale, items: [] })
    } finally {
      setDetailLoading(false)
    }
  }

  const enterReturnMode = () => {
    const initial: Record<number, number> = {}
    saleDetail?.items?.forEach((item: any) => { initial[item.id] = 0 })
    setReturnQtys(initial)
    setReturnMode(true)
  }

  const printReturnSlip = (returnId: number, refundAmount: number, returnedItems: { product_name: string, quantity: number, price: number }[], reason: string, pointsReversed = 0, pointsRestored = 0) => {
    const itemsSubtotal = returnedItems.reduce((s, i) => s + i.quantity * i.price, 0)
    const taxRefunded   = parseFloat((refundAmount - itemsSubtotal).toFixed(2))
    printReturnReceipt({
      storeName:      receiptStoreName,
      logoUrl:        receiptLogoUrl || undefined,
      footerMsg:      receiptFooterMsg,
      returnId,
      saleId:         selectedSale?.id || 0,
      customerName:   selectedSale?.customer_name || undefined,
      reason:         reason || undefined,
      items:          returnedItems.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.price })),
      itemsSubtotal,
      taxRefunded:    taxRefunded > 0 ? taxRefunded : 0,
      refundTotal:    parseFloat(refundAmount.toString()),
      pointsRestored,
      pointsReversed,
    })
  }

  const processReturn = async () => {
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([sale_item_id, quantity]) => ({ sale_item_id: parseInt(sale_item_id), quantity }))

    if (items.length === 0) {
      toast({ title: "Select Items", description: "Return qty barho at least ek item ke liye", variant: "destructive" })
      return
    }

    setReturnLoading(true)
    try {
      const res = await api.post(`/sales/${selectedSale.id}/return`, { items, reason: returnReason })
      if (res.data.success) {
        const pointsReversed = res.data.points_reversed || 0
        const pointsRestored = res.data.points_restored || 0
        const refundAmt = parseFloat(res.data.refund_amount)

        const parts = [`Refund: Rs. ${refundAmt.toFixed(2)}`]
        if (pointsRestored > 0) parts.push(`+${pointsRestored} pts restored`)
        if (pointsReversed > 0) parts.push(`-${pointsReversed} pts reversed`)
        toast({ title: "Return Processed", description: parts.join(' • ') })

        const returnedItems = items.map(({ sale_item_id, quantity }) => {
          const item = saleDetail?.items?.find((i: any) => i.id === sale_item_id)
          return { product_name: item?.product_name || '—', quantity, price: parseFloat(item?.price || 0) }
        })
        printReturnSlip(res.data.return_id, refundAmt, returnedItems, returnReason, pointsReversed, pointsRestored)

        setReturnMode(false)
        setReturnQtys({})
        setReturnReason('')

        // Refresh return history in dialog + sales feed
        const [returnsRes] = await Promise.all([
          api.get(`/sales/${selectedSale.id}/returns`),
          fetchData(true),
        ])
        if (returnsRes.data.success) setExistingReturns(returnsRes.data.data)
      }
    } catch (err: any) {
      toast({ title: "Return Failed", description: err.response?.data?.message || "Error processing return", variant: "destructive" })
    } finally {
      setReturnLoading(false)
    }
  }

  const printReceipt = () => {
    const sale  = selectedSale
    const items = saleDetail?.items || []
    const saleData = saleDetail?.sale || sale || {}
    const subtotal  = parseFloat(saleData?.total || 0)
    const tax       = parseFloat(saleData?.tax   || 0)
    const discount  = parseFloat(saleData?.coupon_discount || 0)
    const loyaltyDiscount = parseFloat(saleData?.loyalty_points_redeemed || 0)
    const splitPayments = saleDetail?.payments?.length > 1
      ? saleDetail.payments.map((p: any) => ({ method: p.method, amount: parseFloat(p.amount) }))
      : undefined

    const html = generateReceiptHTML({
      storeName:      receiptStoreName,
      logoUrl:        receiptLogoUrl || undefined,
      footerMsg:      receiptFooterMsg,
      items:          items.map((i: any) => ({ name: i.product_name, quantity: i.quantity, price: parseFloat(i.price) })),
      invoiceNumber:  `INV-${String(sale?.id || 0).padStart(6, '0')}`,
      orderTime:      sale?.sale_date ? new Date(sale.sale_date) : undefined,
      customerName:   sale?.customer_name || undefined,
      orderType:      'POS',
      subtotal,
      tax,
      taxLabel:       'Tax',
      showTax:        tax > 0,
      discount,
      loyaltyDiscount,
      payMethod:      saleData?.payment_method || sale?.payment_method || 'cash',
      splitPayments,
    })
    const w = window.open('', '_blank', 'width=360,height=650')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 300)
  }

  React.useEffect(() => {
    setUserRole(localStorage.getItem('userRole') || 'cashier')
    // Fetch receipt settings for print functions
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace('/api', '')
    Promise.all([api.get('/settings'), api.get('/settings/receipt')]).then(([sRes, rRes]) => {
      const s = sRes.data.data || sRes.data
      if (s?.store_name) setReceiptStoreName(s.store_name)
      if (s?.receipt_logo) setReceiptLogoUrl(`${base}${s.receipt_logo}`)
      if (s?.receipt_footer_message) setReceiptFooterMsg(s.receipt_footer_message)
      if (rRes.data?.success && rRes.data?.data) {
        const d = rRes.data.data
        if (d.receipt_logo) setReceiptLogoUrl(`${base}${d.receipt_logo}`)
        if (d.receipt_footer_message) setReceiptFooterMsg(d.receipt_footer_message)
      }
    }).catch(() => {})
  }, [])

  const fetchData = React.useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await api.get('/dashboard/all')
      const { stats: statsData, recentSales: recentData, topCategories: categoriesData, dailySales: dailyData } = res.data.data
      setStats(statsData)
      setRecentSales(recentData || [])
      setTopCategories(categoriesData || [])
      setDailySales(dailyData || [])
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh sales feed every 30 seconds (silent — no loading spinner)
  React.useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Don't render until client-side hydration is complete
  if (userRole === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const statsData = stats || {
    todayRevenue: 0,
    todaySales: 0,
    totalCustomers: 0,
    lowStock: 0,
    weekRevenue: 0,
    monthRevenue: 0,
  }

  const displayStats = [
    {
      title: t('dashboard.totalRevenue'),
      value: `Rs. ${statsData.todayRevenue.toLocaleString()}`,
      change: "+0%",
      trend: "up" as const,
      icon: DollarSign,
    },
    {
      title: t('dashboard.salesCount'),
      value: statsData.todaySales.toString(),
      change: "+0%",
      trend: "up" as const,
      icon: ShoppingCart,
    },
    {
      title: t('dashboard.activeCustomers'),
      value: statsData.totalCustomers.toString(),
      change: "+0%",
      trend: "up" as const,
      icon: Users,
    },
    {
      title: t('dashboard.lowStock'),
      value: statsData.lowStock.toString(),
      change: "-0",
      trend: "down" as const,
      icon: Package,
    },
  ]

  const dailyRevenue = dailySales.length > 0 ? dailySales.map((d: any) => ({
    day: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
    revenue: parseFloat(d.revenue) || 0,
    orders: parseInt(d.sales_count) || 0,
  })) : [
    { day: "Mon", revenue: 0, orders: 0 },
  ]

  const maxRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1)

  const chartdata = topCategories.length > 0 ? topCategories.map((cat: any) => ({
    name: cat.category || 'Unknown',
    amount: parseFloat(cat.total_revenue) || 0,
  })) : []

  return (
    <ProtectedRoute>
      <div className="space-y-4 sm:space-y-6 overflow-visible px-3 sm:px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-primary">{t('dashboard.title')}</h1>
          {userRole === "admin" && (
            <p className="text-xs sm:text-sm text-muted-foreground">{t('dashboard.welcome')}</p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {displayStats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="flex items-center text-xs mt-1 flex-wrap">
                {stat.trend === "up" ? (
                  <span className="text-accent flex items-center font-semibold">
                    <ArrowUpRight className="mr-1 h-3 w-3 flex-shrink-0" />
                    {stat.change}
                  </span>
                ) : (
                  <span className="text-destructive flex items-center font-semibold">
                    <ArrowDownRight className="mr-1 h-3 w-3 flex-shrink-0" />
                    {stat.change}
                  </span>
                )}
                <span className="text-muted-foreground ml-1 sm:ml-2 hidden sm:inline">from last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Insights & Real-time Sales */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="min-w-0">
          <AIInsights data={{ stats: statsData, recentSales, topCategories }} />
        </div>
        <Card className="overflow-visible min-w-0 bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <span className="truncate">{t('dashboard.realtimeSales')}</span>
              </CardTitle>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold text-primary leading-tight">
                    Rs. {statsData.todayRevenue.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{statsData.todaySales} sales today</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 px-3">
              {recentSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No sales today</p>
                </div>
              ) : (
                <div className="space-y-1.5 overflow-y-auto max-h-[320px] pr-1">
                  {recentSales.map((sale: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => openSaleDetail(sale)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/8 hover:border-primary/20 border border-transparent transition-all duration-200 group text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <ShoppingCart className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold leading-none truncate text-foreground">
                          Invoice #{sale.id}{sale.table_name ? ` • Table ${sale.table_name}` : ''}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                          {sale.customer_name || 'Walk-in'} &nbsp;•&nbsp; {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-accent">
                          +Rs. {parseFloat(sale.grand_total || 0).toFixed(0)}
                        </span>
                        <span className="text-[9px] text-muted-foreground capitalize">{getPaymentBadgeLabel(sale)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Revenue & Top Categories */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <Card className="border-white bg-gradient-to-br from-card to-muted/30 overflow-visible">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                  <span className="truncate">{t('dashboard.dailyRevenue')}</span>
                </CardTitle>
                <Badge variant="secondary" className="text-xs flex-shrink-0">{t('dashboard.thisWeek')}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {/* Chart Area */}
                <div className="relative h-48 sm:h-56 lg:h-64 pt-28 sm:pt-32 pb-1">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[4, 3, 2, 1, 0].map((i) => (
                      <div key={i} className="w-full border-border/30 border-dashed border-t" />
                    ))}
                  </div>

                  <div className="relative h-full flex items-end gap-1 sm:gap-2 lg:gap-3">
                    {dailyRevenue.map((day, index) => {
                      const height = (day.revenue / maxRevenue) * 80
                      const isBest = day.revenue === maxRevenue

                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1 group relative">
                          {/* Bar Container */}
                          <div className="relative w-full flex justify-center">
                            <div
                              className={`w-full max-w-[20px] sm:max-w-[35px] lg:max-w-[50px] rounded-lg sm:rounded-xl transition-all duration-300 cursor-pointer relative ${
                                isBest
                                  ? 'bg-gradient-to-t from-primary via-primary/90 to-accent'
                                  : 'bg-gradient-to-t from-primary/60 to-primary/80'
                              } group-hover:shadow-[0_0_20px_-4px] group-hover:shadow-primary/50`}
                              style={{
                                height: `${height}px`,
                              }}
                            />

                            {/* Tooltip - positioned above each bar */}
                            <div className="absolute left-1/2 -translate-x-1/2 -top-12 sm:-top-16 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                              <div className="bg-card border border-border rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 shadow-xl inline-block">
                                <p className="text-[8px] sm:text-[10px] font-bold text-foreground whitespace-nowrap">Rs. {day.revenue.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>

                          {/* Day Label */}
                          <span className={`text-[8px] sm:text-[10px] lg:text-xs font-semibold transition-colors ${
                            isBest ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                          }`}>
                            {day.day}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 pt-3 sm:pt-5 border-t border-border bg-card/50 backdrop-blur rounded-xl p-2 sm:p-4 mt-2">
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 flex items-center justify-center gap-1 flex-wrap">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary/50 flex-shrink-0"></span>
                      <span>Avg Daily</span>
                    </p>
                    <p className="text-base sm:text-xl font-bold text-foreground">
                      Rs. {(dailyRevenue.reduce((a, b) => a + b.revenue, 0) / Math.max(dailyRevenue.length, 1)).toFixed(0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 flex items-center justify-center gap-1 flex-wrap">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent/50 flex-shrink-0"></span>
                      <span>Total Orders</span>
                    </p>
                    <p className="text-base sm:text-xl font-bold text-foreground">
                      {dailyRevenue.reduce((a, b) => a + b.orders, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 flex items-center justify-center gap-1 flex-wrap">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500/50 flex-shrink-0"></span>
                      <span>Best Day</span>
                    </p>
                    <p className="text-base sm:text-xl font-bold text-foreground">
                      Rs. {Math.max(...dailyRevenue.map(d => d.revenue)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0">
          <Card className="h-full overflow-visible">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                <span className="truncate">{t('dashboard.topCategories')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                className="mx-auto"
                data={chartdata}
                showLabel={true}
                valueFormatter={(number: number) =>
                  `Rs. ${Intl.NumberFormat("us").format(number).toString()}`
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => { if (!open) { setSelectedSale(null); setSaleDetail(null); setReturnMode(false); setReturnQtys({}); setReturnReason('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Sale #{selectedSale?.id} Details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="w-3 h-3" /> Customer
                  </div>
                  <p className="text-sm font-medium">{selectedSale?.customer_name || 'Walk-in'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CreditCard className="w-3 h-3" /> Payment
                  </div>
                  {saleDetail?.payments?.length > 0 ? (
                    <div className="space-y-0.5 pt-0.5">
                      {saleDetail.payments.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{p.method}</span>
                          <span className="text-sm font-semibold text-accent">Rs. {parseFloat(p.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium capitalize">{saleDetail?.sale?.payment_method || selectedSale?.payment_method || '—'}</p>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> Time
                  </div>
                  <p className="text-sm font-medium">{selectedSale?.sale_date ? new Date(selectedSale.sale_date).toLocaleString() : '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="w-3 h-3" /> Total
                  </div>
                  <p className="text-sm font-bold text-accent">Rs. {parseFloat(selectedSale?.grand_total || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Loyalty / Coupon summary */}
              {(parseFloat(saleDetail?.sale?.coupon_discount || 0) > 0 || parseFloat(saleDetail?.sale?.loyalty_points_redeemed || 0) > 0) && (
                <div className="flex flex-wrap gap-2">
                  {parseFloat(saleDetail?.sale?.coupon_discount || 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-xs bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 text-green-600">
                      <span>🏷️ Promo: -Rs. {parseFloat(saleDetail.sale.coupon_discount).toFixed(2)}</span>
                    </div>
                  )}
                  {parseFloat(saleDetail?.sale?.loyalty_points_redeemed || 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3 py-1 text-yellow-600">
                      <span>⭐ Points used: {saleDetail.sale.loyalty_points_redeemed} pts (-Rs. {parseFloat(saleDetail.sale.loyalty_points_redeemed).toFixed(2)})</span>
                    </div>
                  )}
                </div>
              )}

              {/* Items Table / Return Mode */}
              {returnMode ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Return Qty Select Karo</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Product</th>
                          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Sold</th>
                          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Avail</th>
                          <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Return</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleDetail?.items?.map((item: any) => {
                          const alreadyReturned = existingReturns.returned_qtys[item.id] || 0
                          const available = item.quantity - alreadyReturned
                          return (
                            <tr key={item.id} className="border-t border-border/50">
                              <td className="px-3 py-2 font-medium truncate max-w-[110px]">{item.product_name}</td>
                              <td className="px-2 py-2 text-center text-muted-foreground">{item.quantity}</td>
                              <td className={`px-2 py-2 text-center font-semibold ${available > 0 ? 'text-green-500' : 'text-red-400'}`}>{available}</td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={available}
                                  value={returnQtys[item.id] ?? 0}
                                  onChange={(e) => {
                                    const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), available)
                                    setReturnQtys(prev => ({ ...prev, [item.id]: val }))
                                  }}
                                  disabled={available === 0}
                                  className="w-14 text-center border border-border rounded px-1 py-1 bg-background text-sm disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reason (optional)</p>
                    <textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Return ka reason..."
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="bg-muted/30 rounded-lg px-4 py-3 flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">Estimated Refund</p>
                    <p className="text-lg font-bold text-accent">
                      Rs. {(saleDetail?.items?.reduce((sum: number, item: any) => sum + (returnQtys[item.id] || 0) * parseFloat(item.price), 0) || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items Purchased</p>
                  {saleDetail?.items?.length > 0 ? (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Product</th>
                            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {saleDetail.items.map((item: any, idx: number) => (
                            <tr key={idx} className="border-t border-border/50">
                              <td className="px-3 py-2 font-medium truncate max-w-[150px]">{item.product_name}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-accent font-semibold">Rs. {parseFloat(item.price).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No item details available</p>
                  )}
                  {existingReturns.returns.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Returns Made</p>
                      <div className="space-y-1">
                        {existingReturns.returns.map((ret: any) => (
                          <div key={ret.id} className="flex justify-between items-center text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5">
                            <span className="text-muted-foreground">Return #{ret.id} • {new Date(ret.return_date).toLocaleDateString()}{ret.reason ? ` — ${ret.reason}` : ''}</span>
                            <span className="text-red-400 font-bold">-Rs. {parseFloat(ret.refund_amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!detailLoading && (
            <DialogFooter>
              {returnMode ? (
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={() => setReturnMode(false)} className="flex-1" disabled={returnLoading}>
                    Cancel
                  </Button>
                  <Button onClick={processReturn} disabled={returnLoading} className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white">
                    {returnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                    Submit Return
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 w-full">
                  {saleDetail?.sale?.status !== 'cancelled' && (
                    <Button variant="outline" onClick={enterReturnMode} className="flex-1 gap-2">
                      <Undo2 className="w-4 h-4" />
                      Return Items
                    </Button>
                  )}
                  <Button onClick={printReceipt} className="flex-1 gap-2 bg-primary hover:bg-primary/90">
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </Button>
                </div>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

    </ProtectedRoute>
  )
}

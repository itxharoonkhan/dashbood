"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DollarSign, TrendingUp, ShoppingCart, Users, Calendar, Download, FileBarChart, Loader2, BarChart3 } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

export default function ReportsPage() {
  const router = useRouter()
  const [period, setPeriod] = React.useState("week")
  const { t, isRTL } = useLanguage()
  const [salesData, setSalesData] = React.useState<any[]>([])
  const [categoryData, setCategoryData] = React.useState<any[]>([])
  const [taxSummary, setTaxSummary] = React.useState<any>(null)
  const [profitLoss, setProfitLoss] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    if (role !== 'admin') router.replace('/dashboard')
  }, [router])

  React.useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/reports/all?period=${period}`)
        const { salesPerformance, categoryDistribution, taxSummary: taxData, profitLoss: profitData } = res.data.data
        setSalesData(salesPerformance || [])
        setCategoryData(categoryDistribution || [])
        setTaxSummary(taxData || {})
        setProfitLoss(profitData || {})
      } catch (err) {
        console.error('Failed to fetch reports:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [period])

  const totalSales = profitLoss?.total_revenue || salesData.reduce((sum: number, d: any) => sum + (parseFloat(d.revenue) || 0), 0)
  const totalOrders = salesData.reduce((sum: number, d: any) => sum + (parseInt(d.total_sales) || 0), 0)
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
  const profitMargin = profitLoss?.profit_margin || 0

  if (loading) {
    return (
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading reports...</span>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">{t('reports.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t('reports.today')}</SelectItem>
              <SelectItem value="week">{t('reports.thisWeek')}</SelectItem>
              <SelectItem value="month">{t('reports.thisMonth')}</SelectItem>
              <SelectItem value="year">{t('reports.thisYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 flex-shrink-0" onClick={async () => {
            try {
              const res = await api.get(`/reports/export-detail?period=${period}`)
              const rows = res.data.data

              if (!rows || rows.length === 0) return

              // Totals calculate karo
              const uniqueOrders = new Set(rows.map((r: any) => r.sale_id)).size
              const totalRevenue = [...new Set(rows.map((r: any) => r.sale_id))].reduce((sum: number, saleId) => {
                const row = rows.find((r: any) => r.sale_id === saleId)
                return sum + (parseFloat(row.order_total) || 0)
              }, 0)
              const totalItemsSold = rows.reduce((sum: number, r: any) => sum + (parseInt(r.quantity) || 0), 0)
              const totalTax = [...new Set(rows.map((r: any) => r.sale_id))].reduce((sum: number, saleId) => {
                const row = rows.find((r: any) => r.sale_id === saleId)
                return sum + (parseFloat(row.tax || 0) || 0)
              }, 0)
              const exportDate = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })

              const html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
                  <style>
                    body { font-family: Calibri, Arial, sans-serif; font-size: 11px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
                    th {
                      background-color: #1a5276;
                      color: white;
                      font-weight: bold;
                      border: 1px solid #1a5276;
                      padding: 10px 12px;
                      text-align: center;
                      font-size: 12px;
                      letter-spacing: 0.5px;
                    }
                    td { border: 1px solid #d5d8dc; padding: 8px 12px; font-size: 11px; vertical-align: middle; }
                    tr:nth-child(even) td { background-color: #eaf2ff; }
                    tr:nth-child(odd) td { background-color: #ffffff; }
                    .report-title { font-size: 22px; font-weight: bold; color: #1a5276; margin-bottom: 4px; }
                    .report-sub  { font-size: 13px; color: #666; margin-bottom: 16px; }
                    .summary-box { margin-top: 24px; border-collapse: collapse; width: 100%; }
                    .summary-label {
                      background-color: #1a5276;
                      color: white;
                      font-size: 15px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #1a5276;
                      text-align: left;
                      width: 50%;
                    }
                    .summary-value {
                      background-color: #d6eaf8;
                      color: #1a5276;
                      font-size: 18px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #1a5276;
                      text-align: right;
                      width: 50%;
                    }
                    .revenue-label {
                      background-color: #1e8449;
                      color: white;
                      font-size: 15px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #1e8449;
                      text-align: left;
                    }
                    .revenue-value {
                      background-color: #d5f5e3;
                      color: #1e8449;
                      font-size: 20px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #1e8449;
                      text-align: right;
                    }
                    .tax-label {
                      background-color: #7d6608;
                      color: white;
                      font-size: 15px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #7d6608;
                      text-align: left;
                    }
                    .tax-value {
                      background-color: #fef9e7;
                      color: #7d6608;
                      font-size: 18px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #7d6608;
                      text-align: right;
                    }
                    .items-label {
                      background-color: #6c3483;
                      color: white;
                      font-size: 15px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #6c3483;
                      text-align: left;
                    }
                    .items-value {
                      background-color: #f5eef8;
                      color: #6c3483;
                      font-size: 18px;
                      font-weight: bold;
                      padding: 12px 18px;
                      border: 2px solid #6c3483;
                      text-align: right;
                    }
                    .footer-note { font-size: 10px; color: #999; margin-top: 12px; }
                  </style>
                </head>
                <body>
                  <div class="report-title">Sales Detail Report &mdash; ${period.toUpperCase()}</div>
                  <div class="report-sub">Generated on: ${exportDate} &nbsp;|&nbsp; Elites POS System</div>

                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Customer Name</th>
                        <th>Customer Phone</th>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Unit Price (Rs.)</th>
                        <th>Item Total (Rs.)</th>
                        <th>Tax (Rs.)</th>
                        <th>Order Total (Rs.)</th>
                        <th>Payment Method</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows.map((row: any) => `
                        <tr>
                          <td><b>INV-${String(row.sale_id).padStart(6, '0')}</b></td>
                          <td>${row.date}</td>
                          <td>${row.customer_name}</td>
                          <td>${row.customer_phone}</td>
                          <td>${row.product_name}</td>
                          <td>${row.product_category || '-'}</td>
                          <td style="text-align:center;">${row.quantity}</td>
                          <td style="text-align:right;">${parseFloat(row.unit_price).toFixed(2)}</td>
                          <td style="text-align:right;">${parseFloat(row.item_total).toFixed(2)}</td>
                          <td style="text-align:right;">${parseFloat(row.tax || 0).toFixed(2)}</td>
                          <td style="text-align:right;"><b>${parseFloat(row.order_total).toFixed(2)}</b></td>
                          <td style="text-align:center;">${row.payment_method}</td>
                          <td style="text-align:center;">${row.status}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>

                  <br/>
                  <table class="summary-box">
                    <tr>
                      <td class="summary-label">📦 Total Orders</td>
                      <td class="summary-value">${uniqueOrders}</td>
                    </tr>
                    <tr>
                      <td class="items-label">🛍️ Total Items Sold</td>
                      <td class="items-value">${totalItemsSold}</td>
                    </tr>
                    <tr>
                      <td class="tax-label">🧾 Total Tax Collected</td>
                      <td class="tax-value">Rs. ${totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td class="revenue-label">💰 Total Revenue</td>
                      <td class="revenue-value">Rs. ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </table>

                  <div class="footer-note">* This report was auto-generated by Elites POS System. For internal use only.</div>
                </body>
                </html>
              `

              const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `sales_detail_${period}_${new Date().toISOString().split('T')[0]}.xls`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(url)
            } catch (err) {
              console.error('Export failed:', err)
            }
          }}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('reports.export')}</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">Rs. {totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <p className="flex items-center text-xs text-muted-foreground mt-1">Total revenue earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.totalOrders')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalOrders}</div>
            <p className="flex items-center text-xs text-muted-foreground mt-1">Total orders processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.profitMargin')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{parseFloat(profitMargin).toFixed(1)}%</div>
            <p className="flex items-center text-xs text-muted-foreground mt-1">Profit margin</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.avgOrderValue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">Rs. {avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <p className="flex items-center text-xs text-muted-foreground mt-1">Average order value</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 1: Daily Breakdown + Sales by Category side by side ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Daily Sales Breakdown */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Daily Sales Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            {salesData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 px-4">No sales data available</p>
            ) : (
              <>
                {/* Sticky header */}
                <div className="grid grid-cols-3 gap-4 px-4 py-2.5 bg-muted/50 border-y text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div>Day</div>
                  <div>Revenue</div>
                  <div>Orders</div>
                </div>
                {/* Scrollable rows — ~4-5 rows then scroll */}
                <ScrollArea className="h-[352px]">
                  <div className="divide-y">
                    {salesData.map((day: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-3 gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors text-sm">
                        <div className="font-medium text-foreground">
                          {new Date(day.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="font-semibold text-primary">
                          Rs. {(parseFloat(day.revenue) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-muted-foreground">{parseInt(day.total_sales) || 0}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sales by Category */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-primary" />
              Sales by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            {categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 px-4">No category data available</p>
            ) : (
              <>
                <ScrollArea className="h-[220px] px-4 pt-1">
                  <div className="space-y-2.5 pb-4">
                    {categoryData.map((cat: any, index: number) => {
                      const colors = ['bg-cyan-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-purple-500']
                      const color = colors[index % colors.length]
                      const value = cat.value ? (parseFloat(cat.value) / totalSales) * 100 : 0
                      return (
                        <div key={cat.name || index} className="group p-3 rounded-xl border border-white/50 hover:border-white/30 hover:bg-primary/5 transition-all duration-300">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shadow-md shrink-0`}>
                                <span className="text-white font-bold text-xs">{value.toFixed(0)}%</span>
                              </div>
                              <p className="font-semibold text-sm text-foreground">{cat.name || 'Unknown'}</p>
                            </div>
                            <p className="font-bold text-primary text-sm shrink-0">
                              Rs. {(parseFloat(cat.value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>

                {/* Total Amount Box */}
                <div className="mx-4 mb-4 mt-2 rounded-xl bg-gradient-to-br from-primary/8 to-secondary/8 border border-white/20 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Total Revenue</p>
                  <p className="text-xl font-extrabold text-primary leading-tight">
                    Rs. {totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  {profitLoss && (
                    <>
                      <Separator className="my-2 bg-primary/10" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Cost</p>
                          <p className="text-sm font-bold text-foreground">
                            Rs. {(parseFloat(profitLoss.total_cost) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Net Profit</p>
                          <p className="text-sm font-bold text-green-600">
                            Rs. {(parseFloat(profitLoss.gross_profit) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Sales Overview chart (full width) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Sales Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales data to display</p>
          ) : (
            <>
              <div className="mb-3 text-xs text-muted-foreground">
                <span>{salesData.length} day{salesData.length !== 1 ? 's' : ''} of data</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={salesData.map((day: any) => ({
                    label: new Date(day.date).toLocaleDateString('en', salesData.length <= 14 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
                    revenue: parseFloat(day.revenue) || 0,
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval={salesData.length <= 14 ? 0 : salesData.length <= 31 ? 2 : 6}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-xs text-muted-foreground mb-1">{label}</p>
                            <p className="text-sm font-bold text-foreground">
                              Rs. {(payload[0].value as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Revenue Summary bar ── */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-4 border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-extrabold text-primary">Rs. {totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        {profitLoss && (
          <>
            <Separator orientation="vertical" className="hidden sm:block h-12 bg-border" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-lg font-bold text-foreground">Rs. {(parseFloat(profitLoss.total_cost) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-12 bg-border" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className="text-lg font-bold text-green-600">Rs. {(parseFloat(profitLoss.gross_profit) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
          </>
        )}
      </div>

      </div>
    </ProtectedRoute>
  )
}

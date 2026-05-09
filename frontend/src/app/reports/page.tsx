"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DollarSign, TrendingUp, ShoppingCart, Users, Calendar, Download, FileBarChart, Loader2 } from "lucide-react"
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
  const [returnsData, setReturnsData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  // Check if user is admin
  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    if (role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [router])

  React.useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        // Use consolidated endpoint to avoid 429 errors
        const res = await api.get(`/reports/all?period=${period}`)
        const { salesPerformance, categoryDistribution, taxSummary: taxData, profitLoss: profitData } = res.data.data

        setSalesData(salesPerformance || [])
        setCategoryData(categoryDistribution || [])
        setTaxSummary(taxData || {})
        setProfitLoss(profitData || {})

        const returnsRes = await api.get('/sales/returns/list').catch(() => null)
        if (returnsRes?.data?.success) setReturnsData(returnsRes.data.data)
      } catch (err) {
        console.error('Failed to fetch reports:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [period])

  const totalSales = profitLoss?.total_revenue || salesData.reduce((sum: number, d: any) => sum + (parseFloat(d.revenue) || 0), 0)
  const maxSales = salesData.length > 0 ? Math.max(...salesData.map((d: any) => parseFloat(d.revenue) || 0)) : 1

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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily Breakdown Table */}
        <Card>
          <CardHeader><CardTitle>Daily Sales Breakdown</CardTitle></CardHeader>
          <CardContent>
            {salesData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No sales data available</p>
            ) : (
              <div className="rounded-md border border-white">
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 font-medium text-sm">
                  <div>Day</div>
                  <div>Revenue</div>
                  <div>Orders</div>
                </div>
                <div className="divide-y">
                  {salesData.map((day: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-3 gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                      <div className="font-medium">{new Date(day.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="font-semibold text-primary">Rs. {(parseFloat(day.revenue) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="text-muted-foreground">{parseInt(day.total_sales) || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Chart */}
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
              <div className="h-64 flex items-end gap-2 pt-4">
                {salesData.map((day: any, index: number) => {
                  const revenue = parseFloat(day.revenue) || 0
                  const height = (revenue / maxSales) * 200
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="relative w-full flex justify-center">
                        <div
                          className="w-full max-w-[50px] bg-gradient-to-t from-primary/80 to-primary rounded-t-lg transition-all duration-300 group-hover:from-primary group-hover:to-secondary cursor-pointer relative"
                          style={{ height: `${height}px` }}
                        >
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-card border border-white rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg whitespace-nowrap z-10">
                            <p className="text-xs font-bold text-foreground">Rs. {revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1">
        {/* Category Breakdown */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-primary" />
              Sales by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No category data available</p>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Scrollable Category List */}
                <ScrollArea className="h-[300px] w-full pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                      {categoryData.map((cat: any, index: number) => {
                        const colors = ['bg-cyan-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-purple-500']
                        const color = colors[index % colors.length]
                        const value = cat.value ? (parseFloat(cat.value) / totalSales) * 100 : 0
                        return (
                          <div key={cat.name || index} className="group p-3 rounded-xl border border-white/50 hover:border-white/30 hover:bg-primary/5 transition-all duration-300">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                                  <span className="text-white font-bold text-xs">{value.toFixed(0)}%</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">{cat.name || 'Unknown'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary text-sm">Rs. {(parseFloat(cat.value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
                              <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${value}%` }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </ScrollArea>

                {/* Centered Revenue Box */}
                <div className="flex justify-center">
                  <div className="w-full max-w-sm bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-4 border border-white/20 text-center shadow-inner">
                    <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                    <p className="text-2xl font-extrabold text-primary mb-1">Rs. {totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    {profitLoss && (
                      <>
                        <Separator className="my-3 bg-primary/10" />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Total Cost</p>
                            <p className="text-base font-bold text-foreground">Rs. {(parseFloat(profitLoss.total_cost) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Net Profit</p>
                            <p className="text-base font-bold text-green-600">Rs. {(parseFloat(profitLoss.gross_profit) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Return History */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-red-500" />
            Return History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {returnsData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Koi return nahi mila</p>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-5 gap-3 p-3 bg-muted/50 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                <div>Return #</div>
                <div>Sale #</div>
                <div>Customer</div>
                <div>Date</div>
                <div className="text-right">Refund</div>
              </div>
              <div className="divide-y divide-border">
                {returnsData.map((ret: any) => (
                  <div key={ret.id} className="grid grid-cols-5 gap-3 p-3 items-center hover:bg-muted/20 transition-colors text-sm">
                    <div className="font-semibold text-muted-foreground">#{ret.id}</div>
                    <div className="font-medium">Sale #{ret.sale_id}</div>
                    <div className="text-muted-foreground truncate">{ret.customer_name || 'Walk-in'}</div>
                    <div className="text-muted-foreground">{new Date(ret.return_date).toLocaleDateString()}</div>
                    <div className="text-right font-bold text-red-500">-Rs. {parseFloat(ret.refund_amount).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-muted/30 flex justify-between items-center text-sm font-semibold border-t border-border">
                <span>Total Returns: {returnsData.length}</span>
                <span className="text-red-500">Total Refunded: Rs. {returnsData.reduce((s: number, r: any) => s + parseFloat(r.refund_amount || 0), 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </ProtectedRoute>
  )
}

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Tag, Hash, BarChart3, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

export default function CouponReportsPage() {
  const router = useRouter()
  const [period, setPeriod] = React.useState("week")
  const [couponReports, setCouponReports] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    if (role !== 'admin') router.replace('/dashboard')
  }, [router])

  React.useEffect(() => {
    setLoading(true)
    api.get(`/coupons/reports?period=${period}`)
      .then(res => { if (res.data?.success) setCouponReports(res.data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">Coupon Reports</h1>
            <p className="text-sm text-muted-foreground">Track coupon usage and discounts given</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !couponReports ? (
          <p className="text-center text-muted-foreground py-12">No coupon data available</p>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Total Coupons Used",
                  value: parseInt(couponReports.summary?.total_uses) || 0,
                  icon: Hash,
                  color: "text-purple-400",
                },
                {
                  label: "Total Discount Given",
                  value: `Rs. ${parseFloat(couponReports.summary?.total_discount || 0).toFixed(2)}`,
                  icon: Tag,
                  color: "text-green-400",
                },
                {
                  label: "Unique Coupons Used",
                  value: parseInt(couponReports.summary?.unique_coupons_used) || 0,
                  icon: BarChart3,
                  color: "text-blue-400",
                },
              ].map(stat => (
                <Card key={stat.label} className="border border-white">
                  <CardContent className="p-4 flex items-center gap-3">
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                    <div>
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Top Coupons Table */}
            <Card className="border border-white">
              <CardHeader className="pb-3 border-b border-white">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Top Coupons by Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!couponReports.topCoupons || couponReports.topCoupons.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No coupon usage data for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white bg-muted/30">
                          <th className="text-left p-4 font-medium text-muted-foreground">Code</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Value</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Times Used</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Discount Given</th>
                          <th className="text-left p-4 font-medium text-muted-foreground">Avg Order Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {couponReports.topCoupons.map((c: any) => (
                          <tr key={c.id} className="border-b border-white hover:bg-muted/20 transition-colors">
                            <td className="p-4">
                              <span className="font-mono font-bold text-primary">{c.code}</span>
                            </td>
                            <td className="p-4 capitalize text-muted-foreground">{c.type}</td>
                            <td className="p-4 font-medium">
                              {c.type === "percentage" ? `${c.value}%` : `Rs. ${c.value}`}
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-foreground">{parseInt(c.usage_count) || 0}</span>
                            </td>
                            <td className="p-4 text-green-500 font-semibold">
                              Rs. {parseFloat(c.total_discount || 0).toFixed(2)}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              Rs. {parseFloat(c.avg_order_value || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

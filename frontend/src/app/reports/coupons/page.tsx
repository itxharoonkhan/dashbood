"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subMonths, subDays } from "date-fns"
import { type DateRange } from "react-day-picker"
import { Tag, Hash, BarChart3, Loader2, Calendar, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarUI } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

type ActiveRange = { from: Date; to: Date; label: string }

function getPresets(): { label: string; from: Date; to: Date }[] {
  const now = new Date()
  return [
    { label: "Today",         from: now,                                               to: now },
    { label: "Yesterday",     from: subDays(now, 1),                                   to: subDays(now, 1) },
    { label: "This Week",     from: startOfWeek(now, { weekStartsOn: 1 }),             to: now },
    { label: "Last Week",     from: startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), to: endOfWeek(subDays(now, 7), { weekStartsOn: 1 }) },
    { label: "This Month",    from: startOfMonth(now),                                 to: now },
    { label: "Last Month",    from: startOfMonth(subMonths(now, 1)),                   to: endOfMonth(subMonths(now, 1)) },
    { label: "Last 3 Months", from: startOfMonth(subMonths(now, 2)),                   to: now },
    { label: "This Year",     from: startOfYear(now),                                  to: now },
  ]
}

export default function CouponReportsPage() {
  const router = useRouter()
  const [couponReports, setCouponReports] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const [activeRange, setActiveRange] = React.useState<ActiveRange>(() => {
    try {
      const saved = localStorage.getItem('pos_coupons_range')
      if (saved) {
        const p = JSON.parse(saved)
        return { from: new Date(p.from), to: new Date(p.to), label: p.label }
      }
    } catch {}
    const now = new Date()
    return { from: startOfMonth(now), to: now, label: "This Month" }
  })
  const [calRange, setCalRange] = React.useState<DateRange | undefined>(() => {
    try {
      const saved = localStorage.getItem('pos_coupons_range')
      if (saved) {
        const p = JSON.parse(saved)
        return { from: new Date(p.from), to: new Date(p.to) }
      }
    } catch {}
    const now = new Date()
    return { from: startOfMonth(now), to: now }
  })

  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    if (role !== 'admin') router.replace('/dashboard')
  }, [router])

  React.useEffect(() => {
    localStorage.setItem('pos_coupons_range', JSON.stringify({
      from: activeRange.from.toISOString(),
      to:   activeRange.to.toISOString(),
      label: activeRange.label,
    }))
  }, [activeRange])

  React.useEffect(() => {
    setLoading(true)
    const startDate = format(activeRange.from, 'yyyy-MM-dd')
    const endDate   = format(activeRange.to,   'yyyy-MM-dd')
    api.get(`/coupons/reports?startDate=${startDate}&endDate=${endDate}`)
      .then(res => { if (res.data?.success) setCouponReports(res.data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeRange])

  const applyPreset = (preset: { label: string; from: Date; to: Date }) => {
    setActiveRange({ from: preset.from, to: preset.to, label: preset.label })
    setCalRange({ from: preset.from, to: preset.to })
    setPickerOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalRange(range)
  }

  const applyCalendar = () => {
    if (!calRange?.from || !calRange?.to) return
    const label = `${format(calRange.from, 'MMM d')} – ${format(calRange.to, 'MMM d, yyyy')}`
    setActiveRange({ from: calRange.from, to: calRange.to, label })
    setPickerOpen(false)
  }

  React.useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Enter') applyCalendar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pickerOpen, calRange])

  const presets = getPresets()

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">Coupon Reports</h1>
            <p className="text-sm text-muted-foreground">Track coupon usage and discounts given</p>
          </div>

          {/* Date Range Picker */}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 w-full sm:w-auto justify-between min-w-[180px]">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate text-sm">{activeRange.label}</span>
                <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex flex-col sm:flex-row">
                <div className="flex flex-col border-b sm:border-b-0 sm:border-r p-3 gap-0.5 sm:min-w-[148px]">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">Quick Select</p>
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className={`text-left text-sm px-3 py-1.5 rounded-md hover:bg-accent transition-colors ${
                        activeRange.label === preset.label
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="p-2 flex flex-col items-center">
                  <CalendarUI
                    mode="range"
                    selected={calRange}
                    onSelect={handleCalendarSelect}
                    numberOfMonths={1}
                    captionLayout="dropdown"
                    fromYear={2026}
                    toYear={new Date().getFullYear()}
                    endMonth={new Date()}
                    disabled={{ after: new Date() }}
                  />
                  <div className="flex items-center justify-between w-full px-3 pb-3 pt-1 gap-3">
                    <p className="text-xs text-muted-foreground">
                      {calRange?.from && !calRange?.to ? "Select an end date" : calRange?.from && calRange?.to ? `${format(calRange.from, 'MMM d')} – ${format(calRange.to, 'MMM d')}` : "Select a date range"}
                    </p>
                    <Button size="sm" onClick={applyCalendar} disabled={!calRange?.from || !calRange?.to} className="h-7 px-4">
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
                { label: "Total Coupons Used",   value: parseInt(couponReports.summary?.total_uses) || 0,                                    icon: Hash,     color: "text-purple-400" },
                { label: "Total Discount Given",  value: `Rs. ${parseFloat(couponReports.summary?.total_discount || 0).toFixed(2)}`,          icon: Tag,      color: "text-green-400" },
                { label: "Unique Coupons Used",   value: parseInt(couponReports.summary?.unique_coupons_used) || 0,                           icon: BarChart3, color: "text-blue-400" },
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
                            <td className="p-4"><span className="font-mono font-bold text-primary">{c.code}</span></td>
                            <td className="p-4 capitalize text-muted-foreground">{c.type}</td>
                            <td className="p-4 font-medium">{c.type === "percentage" ? `${c.value}%` : `Rs. ${c.value}`}</td>
                            <td className="p-4"><span className="font-bold text-foreground">{parseInt(c.usage_count) || 0}</span></td>
                            <td className="p-4 text-green-500 font-semibold">Rs. {parseFloat(c.total_discount || 0).toFixed(2)}</td>
                            <td className="p-4 text-muted-foreground">Rs. {parseFloat(c.avg_order_value || 0).toFixed(2)}</td>
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

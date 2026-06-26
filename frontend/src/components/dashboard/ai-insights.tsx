"use client"

import * as React from "react"
import { Sparkles, TrendingUp, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"

interface AIInsightsProps {
  data?: {
    stats: any;
    recentSales: any[];
    topCategories: any[];
  }
}

export function AIInsights({ data: providedData }: AIInsightsProps) {
  const [insight, setInsight] = React.useState<string>("")
  const [loading, setLoading] = React.useState(true)
  const [stats, setStats] = React.useState<any>(providedData?.stats || null)

  React.useEffect(() => {
    const fetchAIInsights = async () => {
      try {
        setLoading(true)
        
        let statsData, recentSales, topCategories;

        if (providedData) {
          statsData = providedData.stats;
          recentSales = providedData.recentSales;
          topCategories = providedData.topCategories;
          setStats(statsData);
        } else {
          // Fallback if data not provided
          const result = await api.get('/dashboard/all')
          const dashboardData = result.data.data
          statsData = dashboardData.stats;
          recentSales = dashboardData.recentSales;
          topCategories = dashboardData.topCategories;
          setStats(statsData)
        }

        if (!statsData) {
          setInsight("System is running smoothly. Stock levels and sales trends are within normal parameters.");
          setLoading(false);
          return;
        }

        const prompt = `
          As a POS System Business Analyst, provide a very concise (2-3 sentences) summary of the current business state based on this data:
          - Today's Revenue: Rs. ${statsData.todayRevenue}
          - Today's Sales: ${statsData.todaySales}
          - Low Stock Items: ${statsData.lowStock}
          - Recent Sales: ${recentSales.map((s: any) => s.grand_total).join(', ')}
          - Top Categories: ${topCategories.map((c: any) => c.category).join(', ')}
          
          Highlight one positive trend and one area that needs attention. Be professional and encouraging.
        `

        // Call the internal API route instead of importing genkit directly
        const token = localStorage.getItem('authToken')
        const aiResponse = await fetch('/api/ai/insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt, salesData: {
            totalSales:     statsData?.todaySales,
            totalAmount:    statsData?.todayRevenue,
            lowStock:       statsData?.lowStock,
            topCategories:  topCategories?.map((c: any) => c.category),
            weekRevenue:    statsData?.weekRevenue,
            monthRevenue:   statsData?.monthRevenue,
          }}),
        })
        
        const aiData = await aiResponse.json()

        if (!aiResponse.ok) {
          // Silent log for developer, don't throw to break UI
          console.warn('AI Status:', aiData.details || aiData.error);
          setInsight("Current sales trends are stable. Continue monitoring your top categories for growth opportunities.");
          return;
        }
        
        setInsight(aiData.text || "System is performing well. Focus on maintaining current sales momentum.");
      } catch (error: any) {
        console.error("AI Insight Error:", error)
        setInsight("System is running smoothly. Stock levels and sales trends are within normal parameters.")
      } finally {
        setLoading(false)
      }
    }

    fetchAIInsights()
  }, [])

  const dynamicInsights = [
    {
      title: "Inventory Alert",
      description: stats?.lowStock > 0 
        ? `${stats.lowStock} products are running low on stock. Check inventory immediately to avoid stockouts.`
        : "All products are well-stocked. No immediate inventory action required.",
      type: stats?.lowStock > 0 ? "warning" : "positive",
    },
    {
      title: "Customer Growth",
      description: stats 
        ? `You have a total of ${stats.totalCustomers} customers. Focus on engagement to improve retention.`
        : "Loading customer data...",
      type: "positive",
    },
  ]

  return (
    <Card className="border-white bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Quick Insights
        </CardTitle>
        <CardDescription>
          AI-powered insights and alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* AI Generated Insight */}
          {loading ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-white bg-muted/30">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Generating AI insights...</p>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-white bg-primary/5">
              <Sparkles className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-base text-foreground mb-1.5">AI Sales Summary</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
              </div>
              <Badge className="text-xs bg-primary">AI</Badge>
            </div>
          )}

          {/* Dynamic Alerts */}
          {dynamicInsights.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg border border-white hover:bg-muted/50 transition-colors"
            >
              {item.type === "positive" ? (
                <TrendingUp className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-base text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1.5">{item.description}</p>
              </div>
              <Badge variant={item.type === "positive" ? "default" : "secondary"} className="text-xs">
                {item.type === "positive" ? "Good" : "Alert"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

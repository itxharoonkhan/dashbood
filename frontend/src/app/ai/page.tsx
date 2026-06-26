"use client"

import * as React from "react"
import { Sparkles, Send, Loader2, RotateCcw, Bot, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

interface Message {
  id: number
  role: 'user' | 'ai'
  text: string
  isAiGenerated?: boolean
  ts: Date
}

const QUICK_PROMPTS = [
  "What were today's top selling products?",
  "How is our revenue trending this week?",
  "Which product categories need restocking?",
  "Give me a summary of this month's performance.",
  "What are the busiest hours of the day?",
  "Suggest ways to increase customer retention.",
]

function AIContent() {
  const { toast } = useToast()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [dashboardData, setDashboardData] = React.useState<any>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    api.get('/dashboard/all').then(r => setDashboardData(r.data)).catch(() => {})
  }, [])

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (prompt?: string) => {
    const text = (prompt || input).trim()
    if (!text || loading) return

    const userMsg: Message = { id: Date.now(), role: 'user', text, ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const salesData = dashboardData ? {
        totalSales: dashboardData.stats?.todaySales,
        totalAmount: dashboardData.stats?.todayRevenue,
        lowStock: dashboardData.stats?.lowStock,
        topCategories: dashboardData.topCategories?.map((c: any) => c.category),
        weekRevenue: dashboardData.stats?.weekRevenue,
        monthRevenue: dashboardData.stats?.monthRevenue,
      } : undefined

      const res = await api.post('/ai/insights', { prompt: text, salesData })
      const aiMsg: Message = {
        id: Date.now() + 1,
        role: 'ai',
        text: res.data.insight || res.data.text || 'No response generated.',
        isAiGenerated: res.data.isAiGenerated,
        ts: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      toast({ title: 'AI request failed', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setLoading(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  const clear = () => setMessages([])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">AI Insights</h1>
            <p className="text-sm text-muted-foreground">Ask anything about your business data</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clear}>
            <RotateCcw className="h-4 w-4 mr-2" /> Clear Chat
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6 py-10">
              <div className="p-5 bg-primary/10 rounded-full">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Elites POS AI Assistant</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  I can analyze your sales, inventory, and business data. Ask me anything!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="text-left text-xs border rounded-lg p-2.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="p-2 bg-primary/10 rounded-full h-8 w-8 shrink-0 flex items-center justify-center mt-1">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-xs text-muted-foreground">
                      {msg.ts.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'ai' && (
                      <Badge variant={msg.isAiGenerated ? 'default' : 'secondary'} className="text-xs py-0 px-1.5">
                        {msg.isAiGenerated ? 'AI' : 'Fallback'}
                      </Badge>
                    )}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="p-2 bg-primary rounded-full h-8 w-8 shrink-0 flex items-center justify-center mt-1">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="p-2 bg-primary/10 rounded-full h-8 w-8 shrink-0 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your sales, inventory, customers..."
              className="resize-none min-h-[44px] max-h-32"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="shrink-0 h-11 w-11">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Press Enter to send, Shift+Enter for new line</p>
        </div>
      </Card>
    </div>
  )
}

export default function AIPage() {
  return (
    <ProtectedRoute>
      <AIContent />
    </ProtectedRoute>
  )
}

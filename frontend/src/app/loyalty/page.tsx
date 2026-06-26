"use client"

import * as React from "react"
import { Heart, Search, Phone, User, Star, ArrowUpCircle, ArrowDownCircle, Clock, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"

interface LoyaltyCustomer {
  id: number
  name: string
  phone: string
  loyalty_points: number
}

interface LoyaltyTransaction {
  id: number
  type: 'earn' | 'redeem' | 'expire' | 'reverse'
  points: number
  balance_after: number
  note: string | null
  created_at: string
  sale?: { sale_number: number } | null
}

const TX_COLORS: Record<string, string> = {
  earn: 'text-green-600',
  redeem: 'text-blue-600',
  expire: 'text-red-500',
  reverse: 'text-orange-500',
}

const TX_ICONS: Record<string, React.ReactNode> = {
  earn: <ArrowUpCircle className="h-4 w-4 text-green-600" />,
  redeem: <ArrowDownCircle className="h-4 w-4 text-blue-600" />,
  expire: <Clock className="h-4 w-4 text-red-500" />,
  reverse: <ArrowDownCircle className="h-4 w-4 text-orange-500" />,
}

function LoyaltyContent() {
  const { toast } = useToast()
  const [phone, setPhone] = React.useState('')
  const [searching, setSearching] = React.useState(false)
  const [customer, setCustomer] = React.useState<LoyaltyCustomer | null>(null)
  const [transactions, setTransactions] = React.useState<LoyaltyTransaction[]>([])
  const [searched, setSearched] = React.useState(false)

  const search = async () => {
    if (!phone.trim()) {
      toast({ title: 'Enter a phone number', variant: 'destructive' })
      return
    }
    setSearching(true)
    setSearched(true)
    try {
      const res = await api.get(`/loyalty/lookup?phone=${encodeURIComponent(phone.trim())}`)
      const cust = res.data.data as LoyaltyCustomer
      setCustomer(cust)
      const txRes = await api.get(`/loyalty/customer/${cust.id}`)
      setTransactions(txRes.data.data?.transactions || [])
    } catch (err: any) {
      setCustomer(null)
      setTransactions([])
      if (err?.response?.status === 404) {
        toast({ title: 'Customer not found', description: 'No customer with this phone number.', variant: 'destructive' })
      }
    } finally {
      setSearching(false)
    }
  }

  const earnTotal = transactions.filter(t => t.type === 'earn').reduce((s, t) => s + t.points, 0)
  const redeemTotal = transactions.filter(t => t.type === 'redeem').reduce((s, t) => s + t.points, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Loyalty Program</h1>
          <p className="text-sm text-muted-foreground">Search customer loyalty points and transaction history</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> Search by Phone Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 max-w-md">
            <Input
              placeholder="e.g. 03001234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <Button onClick={search} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Result */}
      {searched && !searching && customer && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardContent className="flex items-center gap-6 p-6">
              <div className="p-4 bg-primary/10 rounded-full">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{customer.name}</h2>
                <p className="text-muted-foreground">{customer.phone}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1.5">
                  <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                  <span className="text-3xl font-bold">{customer.loyalty_points.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">Available Points</p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">+{earnTotal.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">-{redeemTotal.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Redeemed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{transactions.length}</p>
                <p className="text-sm text-muted-foreground">Transactions</p>
              </CardContent>
            </Card>
          </div>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
              ) : (
                <div className="divide-y">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center gap-4 px-6 py-3">
                      <div className="shrink-0">{TX_ICONS[tx.type]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="capitalize font-medium text-sm">{tx.type}</span>
                          {tx.sale && (
                            <span className="text-xs text-muted-foreground">• Invoice #{tx.sale.sale_number}</span>
                          )}
                        </div>
                        {tx.note && <p className="text-xs text-muted-foreground">{tx.note}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${TX_COLORS[tx.type]}`}>
                          {tx.type === 'earn' ? '+' : '-'}{tx.points}
                        </p>
                        <p className="text-xs text-muted-foreground">Bal: {tx.balance_after}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {searched && !searching && !customer && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <User className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No customer found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different phone number.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function LoyaltyPage() {
  return (
    <ProtectedRoute>
      <LoyaltyContent />
    </ProtectedRoute>
  )
}

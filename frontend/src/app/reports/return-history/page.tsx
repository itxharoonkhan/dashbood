"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, RotateCcw, Search, Loader2, Printer, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export default function ReturnHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [returnsData, setReturnsData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [storeName, setStoreName] = React.useState("Elites POS")

  const [returnDialogOpen, setReturnDialogOpen] = React.useState(false)
  const [returnSaleId, setReturnSaleId] = React.useState("")
  const [fetchingSale, setFetchingSale] = React.useState(false)
  const [fetchedSale, setFetchedSale] = React.useState<any>(null)
  const [returnItems, setReturnItems] = React.useState<any[]>([])
  const [returnReason, setReturnReason] = React.useState("")
  const [processingReturn, setProcessingReturn] = React.useState(false)
  const [returnResult, setReturnResult] = React.useState<any>(null)

  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    if (role !== 'admin') router.replace('/dashboard')
  }, [router])

  React.useEffect(() => {
    api.get('/settings').then(res => {
      const name = res.data?.data?.store_name || res.data?.settings?.store_name
      if (name) setStoreName(name)
    }).catch(() => {})

    api.get('/sales/returns/list')
      .then(res => { if (res.data?.success) setReturnsData(res.data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const resetReturnDialog = () => {
    setReturnSaleId("")
    setFetchedSale(null)
    setReturnItems([])
    setReturnReason("")
    setReturnResult(null)
  }

  const fetchSaleForReturn = async () => {
    const id = returnSaleId.replace(/\D/g, '')
    if (!id) return
    setFetchingSale(true)
    try {
      const [saleRes, retRes] = await Promise.all([
        api.get(`/sales/${id}`),
        api.get(`/sales/${id}/returns`),
      ])
      const { sale, items } = saleRes.data.data
      const { returned_qtys } = retRes.data.data
      setFetchedSale(sale)
      setReturnItems(
        items
          .map((i: any) => ({
            sale_item_id: i.id,
            product_name: i.product_name,
            price: parseFloat(i.price),
            original_qty: i.quantity,
            max_qty: i.quantity - (returned_qtys[i.id] || 0),
            return_qty: 0,
          }))
          .filter((i: any) => i.max_qty > 0)
      )
    } catch (err: any) {
      toast({ title: "Not Found", description: err.response?.data?.message || "Sale not found", variant: "destructive" })
    } finally {
      setFetchingSale(false)
    }
  }

  const processReturn = async () => {
    const selected = returnItems.filter(i => i.return_qty > 0)
    if (selected.length === 0) {
      toast({ title: "Select items", description: "At least one item with quantity > 0", variant: "destructive" })
      return
    }
    setProcessingReturn(true)
    try {
      const id = returnSaleId.replace(/\D/g, '')
      const res = await api.post(`/sales/${id}/return`, {
        items: selected.map(i => ({ sale_item_id: i.sale_item_id, quantity: i.return_qty })),
        reason: returnReason,
      })
      setReturnResult({
        refund_amount: res.data.refund_amount,
        points_reversed: res.data.points_reversed || 0,
        points_restored: res.data.points_restored || 0,
        return_id: res.data.return_id,
        returned_items: selected,
      })
      const returnsRes = await api.get('/sales/returns/list').catch(() => null)
      if (returnsRes?.data?.success) setReturnsData(returnsRes.data.data)
      toast({ title: "Return Processed", description: `Refund: Rs. ${parseFloat(res.data.refund_amount).toFixed(2)}` })
    } catch (err: any) {
      toast({ title: "Return Failed", description: err.response?.data?.message || "Failed to process return", variant: "destructive" })
    } finally {
      setProcessingReturn(false)
    }
  }

  const printReturnReceipt = () => {
    if (!returnResult || !fetchedSale) return
    const itemsHtml = returnResult.returned_items.map((item: any) => `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin:4px 0">
        <span style="flex:1">${item.product_name}</span>
        <span style="margin:0 8px">x${item.return_qty}</span>
        <span style="font-weight:bold">Rs. ${(item.price * item.return_qty).toFixed(2)}</span>
      </div>
    `).join('')
    const saleNum = `INV-${String(fetchedSale.id).padStart(6, '0')}`
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Return Receipt #${returnResult.return_id}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;max-width:80mm;margin:0 auto;padding:10mm;font-size:12px}
        .center{text-align:center}.divider{border-top:1px dashed #000;margin:8px 0}
        .row{display:flex;justify-content:space-between;font-size:11px;margin:3px 0}
      </style>
    </head><body>
      <div class="center" style="margin-bottom:12px">
        <h1 style="font-size:18px;font-weight:bold">${storeName}</h1>
        <p style="font-size:12px;font-weight:bold;margin-top:4px">*** RETURN RECEIPT ***</p>
        <p style="font-size:10px;color:#666;margin-top:4px">${new Date().toLocaleString()}</p>
      </div>
      <div class="divider"></div>
      <div style="font-size:11px;margin:8px 0">
        <div>Return #: ${returnResult.return_id}</div>
        <div>Orig. Sale: ${saleNum}</div>
        ${fetchedSale.customer_name ? `<div>Customer: ${fetchedSale.customer_name}</div>` : ''}
        ${fetchedSale.customer_phone ? `<div>Phone: ${fetchedSale.customer_phone}</div>` : ''}
        ${returnReason ? `<div>Reason: ${returnReason}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div style="margin:8px 0">
        <div style="font-size:11px;font-weight:bold;margin-bottom:6px">RETURNED ITEMS:</div>
        ${itemsHtml}
      </div>
      <div class="divider"></div>
      <div style="margin:8px 0">
        <div class="row"><span>Refund Amount:</span><span style="font-weight:bold;color:#c00">Rs. ${parseFloat(returnResult.refund_amount).toFixed(2)}</span></div>
        ${returnResult.points_restored > 0 ? `<div class="row"><span>&#9733; Loyalty Pts Restored:</span><span style="font-weight:bold;color:#16a34a">+${returnResult.points_restored} pts</span></div>` : ''}
        ${returnResult.points_reversed > 0 ? `<div class="row"><span>&#9733; Loyalty Pts Reversed:</span><span style="font-weight:bold;color:#b45309">-${returnResult.points_reversed} pts</span></div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="center" style="margin-top:12px;font-size:10px">
        <p style="font-weight:bold">Return processed successfully</p>
        <p style="margin-top:4px">Please come again</p>
      </div>
      <script>window.onload=function(){window.print();window.onfocus=function(){setTimeout(function(){window.close()},500)}}</script>
    </body></html>`)
    printWindow.document.close()
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">Return History</h1>
            <p className="text-sm text-muted-foreground">View and process all customer returns</p>
          </div>
          <Button size="sm" variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => { resetReturnDialog(); setReturnDialogOpen(true) }}>
            <RotateCcw className="w-4 h-4" />
            Process Return
          </Button>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-red-500" />
              All Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : returnsData.length === 0 ? (
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

        {/* Process Return Dialog */}
        <Dialog open={returnDialogOpen} onOpenChange={(open) => { setReturnDialogOpen(open); if (!open) resetReturnDialog() }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-red-500" />
                Process Return
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {!returnResult && (
                <>
                  <div className="space-y-2">
                    <Label>Sale ID or Invoice Number</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. 123 or INV-000123"
                        value={returnSaleId}
                        onChange={e => { setReturnSaleId(e.target.value); setFetchedSale(null); setReturnItems([]) }}
                        onKeyDown={e => e.key === 'Enter' && fetchSaleForReturn()}
                      />
                      <Button type="button" variant="outline" onClick={fetchSaleForReturn} disabled={fetchingSale || !returnSaleId.trim()} className="shrink-0">
                        {fetchingSale ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {fetchedSale && (
                    <>
                      <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sale #</span>
                          <span className="font-medium">INV-{String(fetchedSale.id).padStart(6, '0')}</span>
                        </div>
                        {fetchedSale.customer_name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Customer</span>
                            <span className="font-medium">{fetchedSale.customer_name}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Original Total</span>
                          <span className="font-medium">Rs. {parseFloat(fetchedSale.final_total).toFixed(2)}</span>
                        </div>
                        {parseFloat(fetchedSale.loyalty_points_redeemed || 0) > 0 && (
                          <div className="flex justify-between text-yellow-600">
                            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Points Used</span>
                            <span>{fetchedSale.loyalty_points_redeemed} pts</span>
                          </div>
                        )}
                      </div>

                      {returnItems.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-4">All items already returned</p>
                      ) : (
                        <div className="space-y-2">
                          <Label>Select Items to Return</Label>
                          <div className="space-y-2">
                            {returnItems.map((item, idx) => (
                              <div key={item.sale_item_id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                                  <p className="text-xs text-muted-foreground">Rs. {item.price.toFixed(2)} × max {item.max_qty}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button type="button" size="icon" variant="outline" className="h-7 w-7"
                                    onClick={() => setReturnItems(prev => prev.map((r, i) => i === idx ? { ...r, return_qty: Math.max(0, r.return_qty - 1) } : r))}>
                                    –
                                  </Button>
                                  <span className="w-6 text-center text-sm font-bold">{item.return_qty}</span>
                                  <Button type="button" size="icon" variant="outline" className="h-7 w-7"
                                    onClick={() => setReturnItems(prev => prev.map((r, i) => i === idx ? { ...r, return_qty: Math.min(r.max_qty, r.return_qty + 1) } : r))}>
                                    +
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Reason (Optional)</Label>
                        <Input placeholder="e.g. Defective item, wrong size..." value={returnReason} onChange={e => setReturnReason(e.target.value)} />
                      </div>

                      {returnItems.some(i => i.return_qty > 0) && (() => {
                        const selected = returnItems.filter(i => i.return_qty > 0)
                        const refundSubtotal = selected.reduce((s, i) => s + i.price * i.return_qty, 0)
                        return (
                          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm space-y-1">
                            <div className="flex justify-between font-medium text-red-500">
                              <span>Estimated Refund</span>
                              <span>Rs. {refundSubtotal.toFixed(2)}+</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Final amount includes proportional tax adjustment</p>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </>
              )}

              {returnResult && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center py-4 gap-3">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <RotateCcw className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold">Return Processed!</h3>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Return #</span>
                      <span className="font-bold">{returnResult.return_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Refund Amount</span>
                      <span className="font-bold text-red-500">Rs. {parseFloat(returnResult.refund_amount).toFixed(2)}</span>
                    </div>
                    {returnResult.points_restored > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Loyalty Points Restored</span>
                        <span className="font-bold">+{returnResult.points_restored} pts</span>
                      </div>
                    )}
                    {returnResult.points_reversed > 0 && (
                      <div className="flex justify-between text-yellow-600">
                        <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Loyalty Points Reversed</span>
                        <span className="font-bold">-{returnResult.points_reversed} pts</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Returned Items</p>
                    {returnResult.returned_items.map((item: any) => (
                      <div key={item.sale_item_id} className="flex justify-between text-sm">
                        <span>{item.product_name} × {item.return_qty}</span>
                        <span className="font-medium">Rs. {(item.price * item.return_qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 pt-2 gap-2">
              {!returnResult ? (
                <>
                  <Button variant="outline" onClick={() => { setReturnDialogOpen(false); resetReturnDialog() }}>Cancel</Button>
                  <Button
                    onClick={processReturn}
                    disabled={processingReturn || !fetchedSale || !returnItems.some(i => i.return_qty > 0)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {processingReturn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                    Process Return
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setReturnDialogOpen(false); resetReturnDialog() }}>Close</Button>
                  <Button onClick={printReturnReceipt} className="gap-2">
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}

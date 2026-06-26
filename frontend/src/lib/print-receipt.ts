export interface ReceiptLineItem {
  name: string
  quantity: number
  price: number
  notes?: string
}

export interface PrintReceiptOptions {
  storeName: string
  logoUrl?: string
  footerMsg?: string
  items: ReceiptLineItem[]
  invoiceNumber: string | number
  orderTime?: Date
  // Order context
  tableName?: string
  pax?: number
  waiterName?: string
  orderType?: string
  // Customer
  customerName?: string
  customerPhone?: string
  // Totals
  subtotal: number
  tax?: number          // absolute Rs. amount
  taxLabel?: string     // e.g. "Tax (17%)" or "Tax"
  showTax?: boolean
  donation?: number     // absolute Rs. amount (default 1)
  showDonation?: boolean
  discount?: number
  loyaltyDiscount?: number
  // Payment
  payMethod?: string
  amountPaid?: number
  finalTotal?: number   // actual charged amount — used for change calculation
  splitPayments?: { method: string; amount: number }[]
}

export function generateReceiptHTML(opts: PrintReceiptOptions): string {
  const {
    storeName,
    logoUrl = '',
    footerMsg = 'Thank you for your visit!',
    items,
    invoiceNumber,
    orderTime,
    tableName,
    pax,
    waiterName,
    orderType = 'POS',
    customerName,
    customerPhone,
    subtotal,
    tax = 0,
    taxLabel = 'Tax',
    showTax = false,
    donation = 1,
    showDonation = false,
    discount = 0,
    loyaltyDiscount = 0,
    payMethod,
    amountPaid = 0,
    finalTotal,
    splitPayments = [],
  } = opts

  const taxAmt      = showTax ? tax : 0
  const donationAmt = showDonation ? donation : 0
  const displayTotal = parseFloat((subtotal + taxAmt + donationAmt - discount - loyaltyDiscount).toFixed(2))
  const total        = finalTotal ?? displayTotal
  const change       = amountPaid > total ? parseFloat((amountPaid - total).toFixed(2)) : 0

  const now     = orderTime || new Date()
  const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  const itemRows = items.map(i => `
    <tr>
      <td class="td-name">${i.name}${i.notes ? `<br/><span class="note">* ${i.notes}</span>` : ''}</td>
      <td class="td-center">x${i.quantity}</td>
      <td class="td-right">Rs.&nbsp;${(i.price * i.quantity).toLocaleString()}</td>
    </tr>`).join('')

  const infoRows = [
    tableName  ? `<div class="row"><span>Table:</span><span class="bold">${tableName}</span></div>` : '',
    pax        ? `<div class="row"><span>Guests:</span><span>${pax}</span></div>` : '',
    waiterName ? `<div class="row"><span>Waiter:</span><span>${waiterName}</span></div>` : '',
                 `<div class="row"><span>Type:</span><span>${orderType}</span></div>`,
    customerName  ? `<div class="row"><span>Customer:</span><span>${customerName}</span></div>` : '',
    customerPhone ? `<div class="row"><span>Phone:</span><span>${customerPhone}</span></div>` : '',
  ].filter(Boolean).join('\n')

  const splitRows = splitPayments.length >= 2 ? `
    <div class="row bold" style="margin-top:4px;">Payment Breakdown</div>
    ${splitPayments.map(p => {
      const label = p.method === 'cash' ? 'Cash' : p.method === 'card' ? 'Card' : 'Wallet'
      return `<div class="row"><span>${label}:</span><span>Rs.&nbsp;${p.amount.toLocaleString()}</span></div>`
    }).join('')}
    ${(() => {
      const paidSum = splitPayments.reduce((s, p) => s + p.amount, 0)
      const ch = parseFloat((paidSum - total).toFixed(2))
      return ch > 0
        ? `<div class="row bold"><span>Change:</span><span>Rs.&nbsp;${ch.toLocaleString()}</span></div>`
        : ''
    })()}
  ` : ''

  const payRows = amountPaid > 0 && splitPayments.length < 2 ? `
    <div class="row"><span>Payment:</span><span style="text-transform:capitalize">${payMethod || ''}</span></div>
    <div class="row"><span>Received:</span><span>Rs.&nbsp;${amountPaid.toLocaleString()}</span></div>
    ${change > 0 ? `<div class="row bold"><span>Change:</span><span>Rs.&nbsp;${change.toLocaleString()}</span></div>` : ''}
  ` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${invoiceNumber}</title>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',Courier,monospace; width:280px; padding:10px; font-size:12px; background:#fff; }
    .header { text-align:center; margin-bottom:10px; }
    .logo-wrap { width:72px; height:72px; border-radius:50%; overflow:hidden; margin:0 auto 8px; border:2px solid #eee; }
    .logo      { width:100%; height:100%; object-fit:cover; display:block; }
    .store  { font-size:20px; font-weight:bold; margin-bottom:2px; }
    .sub    { font-size:10px; color:#666; }
    .dashed { border-top:1px dashed #000; margin:6px 0; }
    .solid  { border-top:2px solid #000; margin:6px 0; }
    .row    { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
    .bold   { font-weight:bold; }
    .green  { color:#16a34a; }
    .amber  { color:#d97706; }
    .purple { color:#7c3aed; }
    table   { width:100%; border-collapse:collapse; margin:4px 0; }
    th      { font-size:11px; font-weight:bold; padding:3px 0; border-bottom:1px solid #000; }
    td      { font-size:11px; padding:3px 0; vertical-align:top; }
    .td-name   { width:55%; }
    .td-center { width:15%; text-align:center; }
    .td-right  { width:30%; text-align:right; }
    .note      { font-size:10px; font-style:italic; color:#666; }
    .total-row { display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin:4px 0; }
    .footer    { text-align:center; font-size:10px; margin-top:8px; color:#555; }
    @media print { @page { margin:0; } body { padding:4px; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<div class="logo-wrap"><img src="${logoUrl}" class="logo" alt="logo"/></div>` : ''}
    <div class="store">${storeName}</div>
    <div class="sub">${dateStr}&nbsp;&nbsp;${timeStr}</div>
  </div>

  <div class="dashed"></div>
  <div class="row"><span>Invoice #:</span><span class="bold">${invoiceNumber}</span></div>
  ${infoRows}
  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="dashed"></div>
  <div class="row"><span>Subtotal:</span><span>Rs.&nbsp;${subtotal.toLocaleString()}</span></div>
  ${showTax      ? `<div class="row"><span>${taxLabel}:</span><span>Rs.&nbsp;${taxAmt.toFixed(2)}</span></div>` : ''}
  ${discount > 0 ? `<div class="row green"><span>Promo Code:</span><span>-Rs.&nbsp;${discount.toFixed(2)}</span></div>` : ''}
  ${loyaltyDiscount > 0 ? `<div class="row amber"><span>Loyalty Points:</span><span>-Rs.&nbsp;${loyaltyDiscount.toFixed(2)}</span></div>` : ''}
  ${showDonation  ? `<div class="row purple"><span>Donation:</span><span>Rs.&nbsp;${donationAmt.toFixed(2)}</span></div>` : ''}
  <div class="solid"></div>
  <div class="total-row"><span>TOTAL</span><span>Rs.&nbsp;${(finalTotal ?? displayTotal).toLocaleString()}</span></div>
  <div class="dashed"></div>

  ${splitRows}
  ${payRows}

  <div class="footer">${footerMsg}</div>
</body>
</html>`
}

export function printReceipt(opts: PrintReceiptOptions): void {
  const html = generateReceiptHTML(opts)
  const w = window.open('', '_blank', 'width=360,height=650')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 300)
}

// ─── Return Receipt ───────────────────────────────────────────────────────────

export interface ReturnReceiptOptions {
  storeName: string
  logoUrl?: string
  footerMsg?: string
  returnId: number
  saleId: number | string
  customerName?: string
  reason?: string
  returnDate?: Date
  items: { name: string; quantity: number; price: number }[]
  itemsSubtotal: number
  taxRefunded?: number
  refundTotal: number
  pointsRestored?: number
  pointsReversed?: number
}

export function printReturnReceipt(opts: ReturnReceiptOptions): void {
  const {
    storeName,
    logoUrl = '',
    footerMsg = 'Thank you for your visit!',
    returnId,
    saleId,
    customerName,
    reason,
    returnDate,
    items,
    itemsSubtotal,
    taxRefunded = 0,
    refundTotal,
    pointsRestored = 0,
    pointsReversed = 0,
  } = opts

  const now     = returnDate || new Date()
  const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  const itemRows = items.map((i, idx) => `
    <tr style="${idx > 0 ? 'border-top:1px dotted #ccc;' : ''}">
      <td class="td-name">${i.name}</td>
      <td class="td-center">x${i.quantity}</td>
      <td class="td-right">Rs.&nbsp;${(i.price * i.quantity).toLocaleString()}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Return Receipt - RTN-${returnId}</title>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',Courier,monospace; width:300px; padding:10px; font-size:12px; background:#fff; }
    .header { text-align:center; margin-bottom:10px; }
    .logo-wrap { width:72px; height:72px; border-radius:50%; overflow:hidden; margin:0 auto 8px; border:2px solid #eee; }
    .logo      { width:100%; height:100%; object-fit:cover; display:block; }
    .store  { font-size:20px; font-weight:bold; margin-bottom:2px; }
    .sub    { font-size:10px; color:#666; }
    .return-badge { display:inline-block; border:2px solid #dc2626; color:#dc2626; font-weight:bold; font-size:13px; letter-spacing:2px; padding:2px 8px; margin:6px 0; }
    .dashed { border-top:1px dashed #000; margin:6px 0; }
    .solid  { border-top:2px solid #000; margin:6px 0; }
    .row    { display:flex; justify-content:space-between; font-size:11px; margin:2px 0; }
    .bold   { font-weight:bold; }
    .green  { color:#16a34a; }
    .amber  { color:#d97706; }
    .red    { color:#dc2626; }
    table   { width:100%; border-collapse:collapse; margin:4px 0; }
    th      { font-size:11px; font-weight:bold; padding:3px 0; border-bottom:1px solid #000; }
    td      { font-size:11px; padding:3px 0; vertical-align:top; }
    .td-name   { width:55%; }
    .td-center { width:15%; text-align:center; }
    .td-right  { width:30%; text-align:right; }
    .total-row { display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin:4px 0; color:#dc2626; }
    .footer    { text-align:center; font-size:10px; margin-top:8px; color:#555; }
    @media print { @page { margin:0; } body { padding:4px; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<div class="logo-wrap"><img src="${logoUrl}" class="logo" alt="logo"/></div>` : ''}
    <div class="store">${storeName}</div>
    <div class="sub">${dateStr}&nbsp;&nbsp;${timeStr}</div>
    <div class="return-badge">RETURN RECEIPT</div>
  </div>

  <div class="dashed"></div>
  <div class="row"><span>Return #:</span><span class="bold red">RTN-${returnId}</span></div>
  <div class="row"><span>Sale #:</span><span class="bold">INV-${String(saleId).padStart(6, '0')}</span></div>
  ${customerName ? `<div class="row"><span>Customer:</span><span>${customerName}</span></div>` : ''}
  ${reason       ? `<div class="row"><span>Reason:</span><span>${reason}</span></div>` : ''}
  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="dashed"></div>
  <div class="row"><span>Items Subtotal:</span><span>Rs.&nbsp;${itemsSubtotal.toFixed(2)}</span></div>
  ${taxRefunded > 0 ? `<div class="row"><span>Tax (Refunded):</span><span>Rs.&nbsp;${taxRefunded.toFixed(2)}</span></div>` : ''}
  <div class="row" style="color:#888;font-size:10px;"><span>Donation:</span><span>Non-refundable</span></div>
  ${pointsRestored > 0 ? `<div class="row green"><span>&#9733; Points Restored:</span><span>+${pointsRestored} pts</span></div>` : ''}
  ${pointsReversed > 0 ? `<div class="row amber"><span>&#9733; Points Reversed:</span><span>-${pointsReversed} pts</span></div>` : ''}
  <div class="solid"></div>
  <div class="total-row"><span>REFUND TOTAL</span><span>Rs.&nbsp;${refundTotal.toFixed(2)}</span></div>
  <div class="dashed"></div>

  <div class="footer">
    <p>Stock restored &#10003;</p>
    <p style="margin-top:4px;">${footerMsg}</p>
  </div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=360,height=650')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 300)
}

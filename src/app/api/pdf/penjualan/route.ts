import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const BULAN: Record<string, string> = {
  '1': 'Januari', '2': 'Februari', '3': 'Maret', '4': 'April',
  '5': 'Mei', '6': 'Juni', '7': 'Juli', '8': 'Agustus',
  '9': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}
function fmtDateTime(d: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(d))
}
function getPaymentDisplay(method: string, keterangan?: string | null) {
  if (keterangan) {
    const match = keterangan.match(/(?:Bank|Akun):\s*([^|]+)/i);
    if (match) {
      return `${method} - ${match[1].trim().toUpperCase()}`;
    }
  }
  return method;
}

const baseStyle = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
  .page { width: 297mm; min-height: 210mm; padding: 15mm 15mm 12mm 15mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #2563eb; padding-bottom: 12px; margin-bottom: 12px; }
  .company-name { font-size: 20px; font-weight: 700; color: #1e3a8a; }
  .company-sub { font-size: 10px; color: #64748b; margin-top: 3px; }
  .report-title { font-size: 15px; font-weight: 700; color: #1e3a8a; text-align: right; }
  .report-period { font-size: 10px; color: #475569; margin-top: 4px; text-align: right; }
  .report-date { font-size: 9px; color: #94a3b8; margin-top: 3px; text-align: right; }
  .summary { display: flex; gap: 10px; margin: 12px 0; }
  .summary-box { flex: 1; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 9px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-left-width: 4px; border-left-color: #3b82f6; }
  .summary-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .summary-value { font-size: 14px; font-weight: 700; color: #1e3a8a; margin-top: 3px; }
  .summary-box.green { border-left-color: #16a34a; }
  .summary-box.green .summary-value { color: #15803d; }
  .summary-box.red { border-left-color: #dc2626; }
  .summary-box.red .summary-value { color: #b91c1c; }
  .summary-box.orange { border-left-color: #d97706; }
  .summary-box.orange .summary-value { color: #92400e; }
  .section-title { font-size: 11px; font-weight: 700; color: #1e3a8a; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #3b82f6; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #1e3a8a; color: #fff; }
  thead th { padding: 7px 9px; text-align: left; font-weight: 600; white-space: nowrap; letter-spacing: 0.2px; }
  tbody tr { background: #fff; }
  tbody tr:nth-child(even) { background: #f0f6ff; }
  tbody td { padding: 5px 9px; border-bottom: 1px solid #dde5f0; vertical-align: top; color: #111; }
  tfoot tr { background: #1e3a8a; color: #fff; font-weight: 700; }
  tfoot td { padding: 8px 9px; color: #fff !important; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .mono { font-family: monospace; font-size: 9px; color: #334155; }
  .green { color: #15803d; font-weight: 600; }
  .red { color: #b91c1c; font-weight: 600; }
  .footer { margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; }
  .footer-note { font-size: 9px; color: #94a3b8; }
  .print-bar { text-align: center; padding: 16px; background: #f8fafc; border-bottom: 2px solid #2563eb; }
  .btn-print { background: #1e40af; color: #fff; border: none; padding: 10px 28px; font-size: 13px; border-radius: 6px; cursor: pointer; font-weight: 600; letter-spacing: 0.3px; }
  .btn-print:hover { background: #1e3a8a; }
  @media print {
    .print-bar { display: none !important; }
    .page { width: 100%; min-height: auto; padding: 10mm; margin: 0; }
    @page { size: A4 landscape; margin: 8mm; }
    body { margin: 0; padding: 0; min-height: auto; }
  }
`

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const now = new Date()
  const m = searchParams.get('m') || String(now.getMonth() + 1)
  const y = searchParams.get('y') || String(now.getFullYear())

  const startDate = new Date(Number(y), Number(m) - 1, 1).toISOString()
  const endDate = new Date(Number(y), Number(m), 0, 23, 59, 59, 999).toISOString()

  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select(`id, kode_penjualan, tanggal, customer_name, total, discount, payment_method, keterangan, sale_items ( qty, laba_kotor )`)
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)
    .eq('status_transaksi', 'PAID')
    .order('tanggal', { ascending: true })

  let totalTransaksi = 0, totalPenjualan = 0, totalLabaKotor = 0, totalQty = 0, totalDiskon = 0
  const rows = (sales || []).map((s, i) => {
    totalTransaksi++
    totalPenjualan += s.total
    const trueDiscount = s.discount && s.discount > 0 ? s.discount : 0
    totalDiskon += trueDiscount
    let qty = 0, laba = 0
    s.sale_items?.forEach((it: any) => { qty += it.qty; laba += it.laba_kotor })
    totalQty += qty; totalLabaKotor += laba
    return { ...s, total_qty: qty, total_laba: laba, no: i + 1, trueDiscount }
  })

  const printDate = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(now)
  const periodeLabel = `${BULAN[m]} ${y}`

  const tableRows = rows.map(r => `
    <tr>
      <td class="center">${r.no}</td>
      <td>${fmtDateTime(r.tanggal)}</td>
      <td class="mono">${r.kode_penjualan}</td>
      <td>${r.customer_name || '—'}</td>
      <td class="center">${r.total_qty}</td>
      <td class="right">${formatRp(r.total + r.trueDiscount)}</td>
      <td class="right red">${r.trueDiscount ? formatRp(r.trueDiscount) : '—'}</td>
      <td class="right bold">${formatRp(r.total)}</td>
      <td class="right green">${formatRp(r.total_laba)}</td>
      <td class="center">${getPaymentDisplay(r.payment_method, r.keterangan)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Laporan Penjualan — ${periodeLabel}</title>
<style>${baseStyle}</style></head><body>
<div class="print-bar"><button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>
<div class="page">
  <div class="header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="/logo.png" alt="Logo" style="height: 45px; width: auto;" />
      <div>
        <div class="company-name">PT. PAGARUYUNG MITRA PERSADA (AKI MART)</div>
        <div class="company-sub">Distributor Aki &amp; Aksesori Kendaraan</div>
      </div>
    </div>
    <div>
      <div class="report-title">LAPORAN PENJUALAN</div>
      <div class="report-period">Periode: ${periodeLabel}</div>
      <div class="report-date">Dicetak: ${printDate}</div>
    </div>
  </div>
  <div class="summary">
    <div class="summary-box"><div class="summary-label">Total Transaksi</div><div class="summary-value">${totalTransaksi}</div></div>
    <div class="summary-box"><div class="summary-label">Total Qty Terjual</div><div class="summary-value">${totalQty}</div></div>
    <div class="summary-box green"><div class="summary-label">Total Penjualan</div><div class="summary-value">${formatRp(totalPenjualan)}</div></div>
    <div class="summary-box red"><div class="summary-label">Total Diskon</div><div class="summary-value">${formatRp(totalDiskon)}</div></div>
    <div class="summary-box green"><div class="summary-label">Laba Kotor</div><div class="summary-value">${formatRp(totalLabaKotor)}</div></div>
  </div>
  <div class="section-title">Rincian Transaksi Penjualan</div>
  <table>
    <thead><tr>
      <th class="center" style="width:30px">No</th>
      <th>Tanggal</th><th>Kode Bon</th><th>Customer</th>
      <th class="center">Qty</th><th class="right">Subtotal</th>
      <th class="right">Diskon</th><th class="right">Total</th>
      <th class="right">Laba Kotor</th><th class="center">Metode Bayar</th>
    </tr></thead>
    <tbody>${tableRows || '<tr><td colspan="10" class="center" style="padding:20px;color:#999">Tidak ada data transaksi pada periode ini</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right">TOTAL</td>
      <td class="center">${totalQty}</td>
      <td class="right">${formatRp(totalPenjualan + totalDiskon)}</td>
      <td class="right">${formatRp(totalDiskon)}</td>
      <td class="right">${formatRp(totalPenjualan)}</td>
      <td class="right">${formatRp(totalLabaKotor)}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="footer">
    <div class="footer-note">* Laporan digenerate otomatis oleh sistem PT. Pagaruyung Mitra Persada (Aki Mart)</div>
    <div class="footer-note">Halaman 1 dari 1</div>
  </div>
</div></body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

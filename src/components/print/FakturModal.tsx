'use client'

import { useRef, useEffect } from 'react'
import { formatRupiah, getBestDateForDisplay } from '@/lib/utils'

interface FakturSaleItem {
  qty: number
  harga_jual: number
  subtotal: number
  products: {
    merk: string
    kategori: string
    type: string | null
    kode_baterai: string | null
    kapasitas_ah: number
    kode_produk: string
  } | null
}

interface FakturSaleData {
  id: string
  kode_penjualan: string
  tanggal: string
  created_at?: string
  customer_name: string | null
  subtotal: number
  discount: number
  total: number
  payment_method: string
  keterangan: string | null
  include_air_aki?: boolean
  jumlah_air_aki?: number
  harga_air_aki?: number
  harga_jual_air_aki?: number
  sale_items: FakturSaleItem[]
}

interface FakturModalProps {
  isOpen: boolean
  onClose: () => void
  sale: FakturSaleData | null
  autoPrint?: boolean
}

export function FakturModal({ isOpen, onClose, sale, autoPrint = false }: FakturModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && sale && autoPrint) {
      const timer = setTimeout(() => {
        window.print()
      }, 800) // Naikkan delay agar logo sempat ter-load sempurna

      const handleAfterPrint = () => {
        onClose()
      }

      window.addEventListener('afterprint', handleAfterPrint)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('afterprint', handleAfterPrint)
      }
    }
  }, [isOpen, sale, autoPrint, onClose])

  if (!isOpen || !sale) return null

  const tanggalTransaksi = getBestDateForDisplay(sale.tanggal, sale.created_at)

  const tanggalCetak = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())

  const containerClass = autoPrint
    ? 'fixed left-[-9999px] top-0'
    : 'fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:items-start'

  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let totalItemDiscount = 0;

  const displayItems = sale.sale_items?.map(item => {
    const itemDiscount = (item.qty * item.harga_jual) - item.subtotal;
    totalItemDiscount += itemDiscount;
    
    let displayHargaSatuan = item.harga_jual;
    let displaySubtotal = item.qty * item.harga_jual;
    
    if (itemDiscount < 0) {
      // Markup: fold into price
      displayHargaSatuan = item.qty > 0 ? item.subtotal / item.qty : 0;
      displaySubtotal = item.subtotal;
    } else {
      calculatedDiscount += itemDiscount;
    }
    calculatedSubtotal += displaySubtotal;
    
    return {
      ...item,
      displayHargaSatuan,
      displaySubtotal
    };
  }) || [];

  let subtotalAir = 0;
  if (sale.include_air_aki && (sale.jumlah_air_aki ?? 0) > 0) {
    const qtyAir = sale.jumlah_air_aki ?? 0;
    subtotalAir = qtyAir * (sale.harga_jual_air_aki ?? sale.harga_air_aki ?? 0);
    calculatedSubtotal += subtotalAir;
  }

  const globalDiscount = sale.discount - totalItemDiscount;
  if (globalDiscount > 0) {
    calculatedDiscount += globalDiscount;
  } else if (globalDiscount < 0) {
    calculatedSubtotal += Math.abs(globalDiscount);
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 8.27in 5.5in;
            margin: 0.2in 0.5in;
          }
          body * { visibility: hidden; }
          #faktur-print-area, #faktur-print-area * { visibility: visible; }
          #faktur-print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
          }
        }
      `}</style>

      <div
        ref={overlayRef}
        className={containerClass}
        onClick={(e) => {
          if (!autoPrint && e.target === overlayRef.current) onClose()
        }}
      >
        {/* Backdrop */}
        {!autoPrint && <div className="absolute inset-0 bg-black/40 backdrop-blur-sm print:hidden" />}

        {/* Modal Container */}
        <div className={`relative w-full max-w-2xl bg-white rounded-2xl print:rounded-none print:shadow-none print:max-w-none print:w-full ${!autoPrint ? 'shadow-2xl' : ''}`}>

          {/* Faktur Content */}
          <div id="faktur-print-area" className={`px-6 py-5 overflow-y-auto print:max-h-none print:overflow-visible print:px-0 print:py-0 ${!autoPrint ? 'max-h-[85vh]' : ''}`}>
            <div className="font-mono text-sm print:text-[10pt] text-black">

              {/* Header Toko: logo kiri, info toko kanan */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-black border-dashed">
                {/* Logo */}
                <img
                  src="/logo.png"
                  alt="PT Pagaruyung Mitra Persada"
                  width={60}
                  height={60}
                  fetchPriority="high"
                  style={{ objectFit: 'contain', width: 60, height: 60 }}
                />
                {/* Info toko di kanan logo */}
                <div>
                  <h1 className="text-xl font-bold tracking-wide leading-tight print:text-[14pt]">AKI MART</h1>
                  <p className="text-[10px] text-black leading-tight">PT Pagaruyung Mitra Persada</p>
                  <p className="text-[10px] text-black leading-tight mt-0.5">Balik Alam, Mandau, Bengkalis, Riau — Jl. Hangtuah</p>
                  <p className="text-[10px] text-black leading-tight">Telp: 082172140997</p>
                </div>
              </div>

              {/* Info Transaksi */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4 print:text-[9pt]">
                <div>
                  <span className="text-black">No. Bon:</span>
                  <span className="ml-2 font-semibold">{sale.kode_penjualan}</span>
                </div>
                <div className="text-right">
                  <span className="text-black">Tgl. Transaksi:</span>
                  <span className="ml-2">{tanggalTransaksi}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-black">Tgl. Cetak:</span>
                  <span className="ml-2">{tanggalCetak}</span>
                </div>
                <div>
                  <span className="text-black">Customer:</span>
                  <span className="ml-2">{sale.customer_name || 'Umum'}</span>
                </div>
                <div className="text-right">
                  <span className="text-black">Bayar:</span>
                  <span className="ml-2">{sale.payment_method}</span>
                </div>

              </div>

              {/* Separator */}
              <div className="border-t border-black border-dashed mb-3" />

              {/* Tabel Item */}
              <table className="w-full text-xs print:text-[9pt]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="text-left py-1 font-semibold">Produk</th>
                    <th className="text-center py-1 font-semibold w-10">Qty</th>
                    <th className="text-right py-1 font-semibold">Harga Satuan</th>
                    <th className="text-right py-1 font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, idx) => {
                    const product = item.products
                    const name = product
                      ? product.kategori === 'Air Aki'
                        ? product.merk
                        : [product.merk, product.kategori, product.type, product.kode_baterai, `${product.kapasitas_ah}AH`].filter(Boolean).join(' ')
                      : 'Produk'
                    return (
                      <tr key={idx}>
                        <td className="py-1.5 pr-2">{name}</td>
                        <td className="py-1.5 text-center">{item.qty}</td>
                        <td className="py-1.5 text-right">{formatRupiah(item.displayHargaSatuan)}</td>
                        <td className="py-1.5 text-right font-medium">{formatRupiah(item.displaySubtotal)}</td>
                      </tr>
                    )
                  })}
                  {sale.include_air_aki && (sale.jumlah_air_aki ?? 0) > 0 && (() => {
                    const qtyAir = sale.jumlah_air_aki ?? 0
                    const hargaSatuanAir = qtyAir > 0 ? subtotalAir / qtyAir : 0
                    return (
                      <tr>
                        <td className="py-1.5 pr-2">Air Aki (Tambahan)</td>
                        <td className="py-1.5 text-center">{qtyAir}</td>
                        <td className="py-1.5 text-right">{formatRupiah(hargaSatuanAir)}</td>
                        <td className="py-1.5 text-right font-medium">{formatRupiah(subtotalAir)}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>

              {/* Separator */}
              <div className="border-t border-black border-dashed my-3" />

              {/* Totals */}
              <div className="space-y-1 text-xs print:text-[9pt]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(calculatedSubtotal)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between">
                    <span>Diskon</span>
                    <span>- {formatRupiah(calculatedDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black print:text-[11pt]">
                  <span>TOTAL</span>
                  <span>{formatRupiah(sale.total)}</span>
                </div>
              </div>
              {/* Note pajak */}
              <p className="text-[9px] text-gray-500 mt-1 print:text-[8pt]">*harga sudah termasuk pajak</p>

              {/* Keterangan */}
              {sale.keterangan && (
                <div className="mt-3 text-xs text-black print:hidden">
                  <span className="font-semibold">Catatan:</span> {sale.keterangan}
                </div>
              )}

              {/* Tanda Tangan */}
              <div className="mt-8 flex justify-around text-xs text-black print:text-[9pt]">
                <div className="text-center w-32">
                  <p>Diterima oleh,</p>
                  <div className="h-16"></div>
                  <p>(......................................)</p>
                </div>
                <div className="text-center w-32">
                  <p>Hormat kami,</p>
                  <div className="h-16"></div>
                  <p>(......................................)</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

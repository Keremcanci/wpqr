"use client"

import { useEffect, useState, useCallback } from "react"
import { X, RefreshCw, CheckCircle } from "lucide-react"
import { useSocket } from "@/hooks/useSocket"
import api from "@/lib/api"
import type { Account } from "./AccountCard"

interface Props {
  account: Account | null
  onClose: () => void
  onConnected: (accountId: string) => void
}

export default function QRModal({ account, onClose, onConnected }: Props) {
  const [qr, setQR] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(60)
  const [connected, setConnected] = useState(false)

  const reconnect = useCallback(async () => {
    if (!account) return
    setQR(null)
    setCountdown(60)
    try {
      await api.post(`/api/accounts/${account.id}/reconnect`)
    } catch {
      // sessiz geç
    }
  }, [account])

  // Socket.io olayları
  useSocket({
    "account:qr": (data: unknown) => {
      const d = data as { accountId: string; qr: string }
      if (d.accountId === account?.id) {
        setQR(d.qr)
        setCountdown(60)
      }
    },
    "account:status": (data: unknown) => {
      const d = data as { accountId: string; status: string }
      if (d.accountId === account?.id && d.status === "connected") {
        setConnected(true)
        onConnected(account!.id)
        setTimeout(onClose, 1500)
      }
    },
  })

  // 60 saniyelik geri sayım
  useEffect(() => {
    if (!qr || connected) return
    if (countdown <= 0) {
      setQR(null)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [qr, countdown, connected])

  // Modal açılınca reconnect başlat
  useEffect(() => {
    if (account) reconnect()
  }, [account, reconnect])

  if (!account) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
        {/* Kapat */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-bold text-neutral-900">WhatsApp Bağla</h2>
        <p className="text-sm text-neutral-500 mt-1 mb-5">{account.phone}</p>

        {/* İçerik */}
        <div className="flex flex-col items-center gap-4">
          {connected ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CheckCircle size={56} className="text-green-500" />
              <p className="font-semibold text-green-700">Bağlantı Kuruldu!</p>
            </div>
          ) : qr ? (
            <>
              {/* QR görüntüsü */}
              <div className="border-4 border-neutral-800 rounded-xl overflow-hidden">
                <img src={qr} alt="WhatsApp QR" width={220} height={220} />
              </div>
              {/* Geri sayım */}
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${countdown > 20 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {countdown}
                </div>
                <span className="text-neutral-500">saniye içinde süresi dolacak</span>
              </div>
              <button
                onClick={reconnect}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <RefreshCw size={13} /> QR'ı Yenile
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-neutral-500">QR kod hazırlanıyor...</p>
            </div>
          )}
        </div>

        {/* Talimat */}
        {qr && !connected && (
          <ol className="mt-5 text-xs text-neutral-500 space-y-1 list-decimal list-inside">
            <li>WhatsApp → Bağlantılı Cihazlar</li>
            <li>Cihaz Ekle seçin</li>
            <li>QR kodu telefonla tarayın</li>
          </ol>
        )}
      </div>
    </div>
  )
}

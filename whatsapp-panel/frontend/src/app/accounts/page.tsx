"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, RefreshCw } from "lucide-react"
import api from "@/lib/api"
import { useSocket } from "@/hooks/useSocket"
import AccountCard, { type Account } from "@/components/AccountCard"
import QRModal from "@/components/QRModal"

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [qrTarget, setQRTarget] = useState<Account | null>(null)

  // Yeni hesap ekleme formu
  const [addOpen, setAddOpen] = useState(false)
  const [phone, setPhone] = useState("")
  const [label, setLabel] = useState("")
  const [isBackup, setIsBackup] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Account[]>("/api/accounts")
      setAccounts(res.data)
    } catch {
      // sessiz
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Gerçek zamanlı durum güncellemesi
  useSocket({
    "account:status": (data: unknown) => {
      const d = data as { accountId: string; status: string }
      setAccounts((prev) =>
        prev.map((a) => a.id === d.accountId ? { ...a, status: d.status as Account["status"] } : a)
      )
    },
    "account:qr": (data: unknown) => {
      const d = data as { accountId: string }
      setAccounts((prev) =>
        prev.map((a) => a.id === d.accountId ? { ...a, status: "qr_pending" } : a)
      )
    },
    "account:backup_activated": (data: unknown) => {
      const d = data as { accountId: string }
      setAccounts((prev) =>
        prev.map((a) => a.id === d.accountId ? { ...a, isBackup: false } : a)
      )
    },
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setAdding(true)
    try {
      const res = await api.post<Account>("/api/accounts", { phone: phone.trim(), label: label.trim() || null, isBackup })
      setAccounts((prev) => [...prev, res.data])
      setPhone("")
      setLabel("")
      setIsBackup(false)
      setAddOpen(false)
      if (!isBackup) setQRTarget(res.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg || "Hesap eklenemedi")
    } finally {
      setAdding(false)
    }
  }

  async function handleReconnect(id: string) {
    try {
      await api.post(`/api/accounts/${id}/reconnect`)
    } catch {
      alert("Yeniden bağlanma başlatılamadı")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu hesabı silmek istediğinizden emin misiniz?")) return
    try {
      await api.delete(`/api/accounts/${id}`)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      alert("Hesap silinemedi")
    }
  }

  function handleConnected(accountId: string) {
    setAccounts((prev) =>
      prev.map((a) => a.id === accountId ? { ...a, status: "connected" } : a)
    )
  }

  const connected = accounts.filter((a) => a.status === "connected").length
  const banned = accounts.filter((a) => a.status === "banned").length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Hesaplar</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {accounts.length} hesap · {connected} bağlı{banned > 0 ? ` · ${banned} ban yedi` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Yenile
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
          >
            <Plus size={14} />
            Hesap Ekle
          </button>
        </div>
      </div>

      {/* Hesap Kartları */}
      {loading ? (
        <div className="text-sm text-neutral-400 py-12 text-center">Yükleniyor...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <p className="text-lg font-medium">Henüz hesap yok</p>
          <p className="text-sm mt-1">Hesap Ekle butonuna tıklayarak WhatsApp hesabı ekleyin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onQR={setQRTarget}
              onReconnect={handleReconnect}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Yeni Hesap Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Yeni Hesap Ekle</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Telefon Numarası <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+905xxxxxxxxx"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Etiket</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Opsiyonel açıklama"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBackup}
                  onChange={(e) => setIsBackup(e.target.checked)}
                  className="rounded"
                />
                Yedek hesap olarak ekle
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-2 rounded-lg bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? "Ekleniyor..." : "Ekle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      <QRModal
        account={qrTarget}
        onClose={() => setQRTarget(null)}
        onConnected={handleConnected}
      />
    </div>
  )
}

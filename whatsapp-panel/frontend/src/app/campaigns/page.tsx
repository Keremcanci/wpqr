"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Plus, RefreshCw, Send, Clock, CheckCircle, XCircle, Loader } from "lucide-react"
import api from "@/lib/api"
import { useSocket } from "@/hooks/useSocket"

interface Campaign {
  id: string
  name: string
  status: "pending" | "running" | "completed" | "failed"
  totalCount: number
  sentCount: number
  failCount: number
  createdAt: string
  template?: { name: string }
}

const STATUS_MAP = {
  pending:   { label: "Bekliyor",    icon: Clock,         cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  running:   { label: "Çalışıyor",   icon: Loader,        cls: "text-blue-600 bg-blue-50 border-blue-200" },
  completed: { label: "Tamamlandı",  icon: CheckCircle,   cls: "text-green-600 bg-green-50 border-green-200" },
  failed:    { label: "Durduruldu",  icon: XCircle,       cls: "text-red-600 bg-red-50 border-red-200" },
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Campaign[]>("/api/campaigns")
      setCampaigns(res.data)
    } catch { /* sessiz */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useSocket({
    "campaign:progress": (data: unknown) => {
      const d = data as { campaignId: string; sentCount: number; failCount: number }
      setCampaigns((prev) =>
        prev.map((c) => c.id === d.campaignId ? { ...c, sentCount: d.sentCount, failCount: d.failCount, status: "running" } : c)
      )
    },
    "campaign:completed": (data: unknown) => {
      const d = data as { campaignId: string }
      setCampaigns((prev) =>
        prev.map((c) => c.id === d.campaignId ? { ...c, status: "completed" } : c)
      )
    },
  })

  async function handleStop(e: React.MouseEvent, id: string) {
    e.preventDefault()
    if (!confirm("Kampanyayı durdurmak istediğinizden emin misiniz?")) return
    try {
      await api.post(`/api/campaigns/${id}/stop`)
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "failed" } : c))
    } catch {
      alert("Durdurma başarısız")
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Kampanyalar</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{campaigns.length} kampanya</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Yenile
          </button>
          <Link
            href="/campaigns/new"
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
          >
            <Plus size={14} /> Yeni Kampanya
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400 py-12 text-center">Yükleniyor...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Send size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Henüz kampanya yok</p>
          <p className="text-sm mt-1">Yeni Kampanya butonuna tıklayarak başlayın</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const s = STATUS_MAP[c.status] ?? STATUS_MAP.pending
            const Icon = s.icon
            const pct = c.totalCount > 0 ? Math.round((c.sentCount / c.totalCount) * 100) : 0
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="block bg-white rounded-xl border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-neutral-900 truncate">{c.name}</h3>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>
                        <Icon size={11} className={c.status === "running" ? "animate-spin" : ""} />
                        {s.label}
                      </span>
                    </div>
                    {c.template && (
                      <p className="text-xs text-neutral-400 mb-2">Şablon: {c.template.name}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            c.status === "completed" ? "bg-green-500" :
                            c.status === "failed" ? "bg-red-400" : "bg-blue-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500 shrink-0">
                        {c.sentCount}/{c.totalCount}
                        {c.failCount > 0 && <span className="text-red-500 ml-1">({c.failCount} hata)</span>}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-neutral-400">
                      {new Date(c.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                    {c.status === "running" && (
                      <button
                        onClick={(e) => handleStop(e, c.id)}
                        className="text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 rounded-lg px-2 py-1 transition-colors"
                      >
                        Durdur
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

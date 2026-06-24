"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock,
  Loader, Send, AlertTriangle, StopCircle
} from "lucide-react"
import api from "@/lib/api"
import { useSocket } from "@/hooks/useSocket"

interface Message {
  id: string
  toPhone: string
  status: "pending" | "sent" | "failed"
  error: string | null
  sentAt: string | null
}

interface Campaign {
  id: string
  name: string
  status: "pending" | "running" | "completed" | "failed"
  totalCount: number
  sentCount: number
  failCount: number
  createdAt: string
  template: { id: string; name: string; body: string } | null
  messages: Message[]
}

const STATUS_MAP = {
  pending:   { label: "Bekliyor",   icon: Clock,       cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  running:   { label: "Çalışıyor",  icon: Loader,      cls: "text-blue-600 bg-blue-50 border-blue-200" },
  completed: { label: "Tamamlandı", icon: CheckCircle, cls: "text-green-600 bg-green-50 border-green-200" },
  failed:    { label: "Durduruldu", icon: XCircle,     cls: "text-red-600 bg-red-50 border-red-200" },
}

const MSG_STATUS = {
  pending: { icon: Clock,         cls: "text-neutral-400" },
  sent:    { icon: CheckCircle,   cls: "text-green-600" },
  failed:  { icon: AlertTriangle, cls: "text-red-500" },
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [filter, setFilter] = useState<"all" | "sent" | "failed" | "pending">("all")

  const load = useCallback(async () => {
    try {
      const res = await api.get<Campaign>(`/api/campaigns/${id}`)
      setCampaign(res.data)
    } catch { /* sessiz */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Canlı Socket.io güncellemeleri
  useSocket({
    "campaign:progress": (data: unknown) => {
      const d = data as { campaignId: string; sentCount: number; failCount: number; message?: Message }
      if (d.campaignId !== id) return
      setCampaign((prev) => {
        if (!prev) return prev
        let messages = prev.messages
        if (d.message) {
          const exists = prev.messages.find((m) => m.id === d.message!.id)
          messages = exists
            ? prev.messages.map((m) => m.id === d.message!.id ? d.message! : m)
            : [d.message, ...prev.messages].slice(0, 200)
        }
        return { ...prev, sentCount: d.sentCount, failCount: d.failCount, status: "running", messages }
      })
    },
    "campaign:completed": (data: unknown) => {
      const d = data as { campaignId: string }
      if (d.campaignId !== id) return
      setCampaign((prev) => prev ? { ...prev, status: "completed" } : prev)
    },
    "campaign:error": (data: unknown) => {
      const d = data as { campaignId: string; message?: Message; reason?: string }
      if (d.campaignId !== id) return
      if (d.reason === 'limit') {
        alert('Tüm WhatsApp hesapları günlük gönderim limitine ulaştı. Kampanya duraklatıldı.')
        setCampaign((prev) => prev ? { ...prev, status: "failed" } : prev)
        return
      }
      setCampaign((prev) => {
        if (!prev || !d.message) return prev
        const exists = prev.messages.find((m) => m.id === d.message!.id)
        const messages = exists
          ? prev.messages.map((m) => m.id === d.message!.id ? d.message! : m)
          : [d.message, ...prev.messages].slice(0, 200)
        return { ...prev, messages }
      })
    },
  })

  async function handleStop() {
    if (!campaign || !confirm("Kampanyayı durdurmak istediğinizden emin misiniz?")) return
    setStopping(true)
    try {
      await api.post(`/api/campaigns/${id}/stop`)
      setCampaign((prev) => prev ? { ...prev, status: "failed" } : prev)
    } catch { alert("Durdurma başarısız") }
    finally { setStopping(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-400">
        <RefreshCw size={24} className="animate-spin" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="text-center py-24 text-neutral-400">
        <p className="text-lg font-medium">Kampanya bulunamadı</p>
        <button onClick={() => router.push("/campaigns")} className="text-sm text-blue-600 mt-2 hover:underline">
          Geri dön
        </button>
      </div>
    )
  }

  const s = STATUS_MAP[campaign.status] ?? STATUS_MAP.pending
  const StatusIcon = s.icon
  const pct = campaign.totalCount > 0
    ? Math.min(100, Math.round((campaign.sentCount / campaign.totalCount) * 100))
    : 0
  const filtered = campaign.messages.filter((m) => filter === "all" || m.status === filter)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Geri butonu */}
      <button
        onClick={() => router.push("/campaigns")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={15} /> Kampanyalar
      </button>

      {/* Üst bilgi kartı */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">{campaign.name}</h2>
            {campaign.template && (
              <p className="text-sm text-neutral-400 mt-0.5">Şablon: {campaign.template.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium ${s.cls}`}>
              <StatusIcon size={14} className={campaign.status === "running" ? "animate-spin" : ""} />
              {s.label}
            </span>
            {campaign.status === "running" && (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <StopCircle size={14} />
                {stopping ? "Durduruluyor..." : "Durdur"}
              </button>
            )}
          </div>
        </div>

        {/* İlerleme çubuğu */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">İlerleme</span>
            <span className="font-semibold text-neutral-900">{pct}%</span>
          </div>
          <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                campaign.status === "completed" ? "bg-green-500" :
                campaign.status === "failed" ? "bg-red-400" : "bg-blue-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Sayılar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Toplam", value: campaign.totalCount, cls: "text-neutral-900" },
            { label: "Gönderildi", value: campaign.sentCount, cls: "text-green-700" },
            { label: "Hatalı", value: campaign.failCount, cls: campaign.failCount > 0 ? "text-red-600" : "text-neutral-400" },
            { label: "Kalan", value: Math.max(0, campaign.totalCount - campaign.sentCount - campaign.failCount), cls: "text-blue-600" },
          ].map((item) => (
            <div key={item.label} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 text-center">
              <p className={`text-2xl font-bold ${item.cls}`}>{item.value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Başlangıç tarihi */}
        <p className="text-xs text-neutral-400">
          Başlatıldı: {new Date(campaign.createdAt).toLocaleString("tr-TR")}
        </p>
      </div>

      {/* Mesaj listesi */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {/* Filtre bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-1">
            <Send size={15} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">Mesajlar</span>
            <span className="text-xs text-neutral-400 ml-1">({campaign.messages.length} kayıt)</span>
          </div>
          <div className="flex gap-1">
            {(["all", "sent", "failed", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  filter === f
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                {f === "all" ? "Tümü" : f === "sent" ? "Gönderildi" : f === "failed" ? "Hatalı" : "Bekliyor"}
              </button>
            ))}
          </div>
        </div>

        {/* Tablo */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">
            {campaign.messages.length === 0 ? "Mesaj yok" : "Bu filtrede sonuç yok"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs text-neutral-500 font-medium">Telefon</th>
                  <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium">Durum</th>
                  <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium">Gönderim Zamanı</th>
                  <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium">Hata</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((msg) => {
                  const ms = MSG_STATUS[msg.status] ?? MSG_STATUS.pending
                  const MsgIcon = ms.icon
                  return (
                    <tr key={msg.id} className="border-t border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-2.5 font-mono text-neutral-700">{msg.toPhone}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${ms.cls}`}>
                          <MsgIcon size={12} />
                          {msg.status === "sent" ? "Gönderildi" : msg.status === "failed" ? "Hatalı" : "Bekliyor"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-400">
                        {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString("tr-TR") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-red-500 max-w-xs truncate">
                        {msg.error || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Yenile butonu */}
      <div className="flex justify-center">
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <RefreshCw size={13} /> Yenile
        </button>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Smartphone, CheckCircle, ShieldOff, Send, BarChart2, RefreshCw } from "lucide-react"
import api from "@/lib/api"

interface HourlyStat { hour: number; count: number }

interface DashboardData {
  accounts: { total: number; connected: number; banned: number; backup: number; activeSessions: number }
  campaigns: { total: number; running: number }
  today: { sent: number; failed: number }
  hourlyStats: HourlyStat[]
}

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  color: string
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 border border-neutral-200">
      <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-neutral-500">{label}</p>
        <p className="text-2xl font-bold text-neutral-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const EMPTY: DashboardData = {
  accounts: { total: 0, connected: 0, banned: 0, backup: 0, activeSessions: 0 },
  campaigns: { total: 0, running: 0 },
  today: { sent: 0, failed: 0 },
  hourlyStats: [],
}

function buildActivityChart(hourlyStats: HourlyStat[]) {
  const map = new Map(hourlyStats.map(s => [s.hour, s.count]))
  return Array.from({ length: 24 }, (_, i) => ({
    saat: `${i.toString().padStart(2, "0")}:00`,
    gönderilen: map.get(i) ?? 0,
  }))
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<DashboardData>("/api/dashboard")
      setData(res.data)
      setLastUpdated(new Date())
    } catch {
      // backend erişilemiyorsa sessiz geç
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 15_000)
    return () => clearInterval(id)
  }, [fetchData])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Dashboard</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {lastUpdated
              ? `Son güncelleme: ${lastUpdated.toLocaleTimeString("tr-TR")}`
              : "Yükleniyor..."}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Yenile
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Toplam Hesap"
          value={data.accounts.total}
          sub={`${data.accounts.connected} bağlı · ${data.accounts.backup} yedek`}
          icon={<Smartphone size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Bağlı Hesap"
          value={data.accounts.connected}
          sub={`${data.accounts.activeSessions} aktif oturum`}
          icon={<CheckCircle size={20} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Bugün Gönderilen"
          value={data.today.sent}
          sub={data.today.failed > 0 ? `${data.today.failed} başarısız` : "Hata yok"}
          icon={<Send size={20} className="text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          label="Aktif Kampanya"
          value={data.campaigns.running}
          sub={`${data.campaigns.total} toplam`}
          icon={<BarChart2 size={20} className="text-orange-600" />}
          color="bg-orange-50"
        />
      </div>

      {/* Ban Uyarısı */}
      {data.accounts.banned > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <ShieldOff size={16} />
          <span>
            <strong>{data.accounts.banned}</strong> hesap ban yedi. Hesaplar sayfasından durumu kontrol edin.
          </span>
        </div>
      )}

      {/* Aktivite Grafiği */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
        <h3 className="text-base font-semibold text-neutral-800 mb-4">Bugünkü Aktivite</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={buildActivityChart(data.hourlyStats ?? [])} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="saat" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Line type="monotone" dataKey="gönderilen" stroke="#3b82f6" strokeWidth={2} dot={false} name="Gönderilen" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hesap Özeti */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
        <h3 className="text-base font-semibold text-neutral-800 mb-3">Hesap Durumu</h3>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { label: "Bağlı", value: data.accounts.connected, color: "text-green-600" },
            { label: "Bağlı Değil", value: data.accounts.total - data.accounts.connected - data.accounts.banned, color: "text-yellow-600" },
            { label: "Ban Yemiş", value: data.accounts.banned, color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-neutral-50 py-3 px-2 border border-neutral-100">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-neutral-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

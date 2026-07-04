"use client"

import { useEffect, useState } from "react"
import { Save, Eye, EyeOff } from "lucide-react"
import api from "@/lib/api"

interface Settings {
  PROXY_API_KEY: string
  PROXY_USERNAME: string
  PROXY_PASSWORD: string
  PROXY_PORT: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    PROXY_API_KEY: "",
    PROXY_USERNAME: "",
    PROXY_PASSWORD: "",
    PROXY_PORT: "9000",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    api.get<Settings>("/api/settings").then(res => {
      setSettings(res.data)
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post("/api/settings", settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert("Kaydetme başarısız")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Ayarlar</h2>
        <p className="text-sm text-neutral-500 mt-1">Proxy ve bağlantı ayarları</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
        <h3 className="text-base font-semibold text-neutral-800 border-b border-neutral-100 pb-3">
          9Proxy Ayarları
        </h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={settings.PROXY_API_KEY}
              onChange={e => setSettings(s => ({ ...s, PROXY_API_KEY: e.target.value }))}
              placeholder="9Proxy API key"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setShowApiKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">Kullanıcı Adı</label>
          <input
            type="text"
            value={settings.PROXY_USERNAME}
            onChange={e => setSettings(s => ({ ...s, PROXY_USERNAME: e.target.value }))}
            placeholder="9Proxy kullanıcı adı"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">Şifre</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={settings.PROXY_PASSWORD}
              onChange={e => setSettings(s => ({ ...s, PROXY_PASSWORD: e.target.value }))}
              placeholder="9Proxy şifre"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">Port</label>
          <input
            type="number"
            value={settings.PROXY_PORT}
            onChange={e => setSettings(s => ({ ...s, PROXY_PORT: e.target.value }))}
            placeholder="9000"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-neutral-400">Varsayılan: 9000</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-neutral-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          <Save size={14} />
          {saving ? "Kaydediliyor..." : saved ? "Kaydedildi!" : "Kaydet"}
        </button>
      </form>
    </div>
  )
}

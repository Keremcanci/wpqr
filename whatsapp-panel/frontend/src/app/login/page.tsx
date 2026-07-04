"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await api.post<{ token: string }>("/api/auth/login", { username, password })
      localStorage.setItem("wp_token", res.data.token)
      router.push("/")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || "Giriş başarısız")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 w-full max-w-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">WA Panel</p>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">Giriş Yap</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              required
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-900 text-white text-sm py-2.5 rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  )
}

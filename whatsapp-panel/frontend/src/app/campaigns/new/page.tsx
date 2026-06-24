"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, ChevronLeft, Send, FileText, Upload, Eye, CheckCircle, RefreshCw } from "lucide-react"
import api from "@/lib/api"
import ExcelUpload, { type Recipient } from "@/components/ExcelUpload"

interface Template {
  id: string
  name: string
  body: string
}

const STEPS = ["Şablon", "Alıcılar", "Önizleme", "Gönder"] as const

function fillBody(body: string, variables: Record<string, string | undefined>): string {
  return body
    .replace(/\{isim\}/gi, variables.isim || "")
    .replace(/\{soyisim\}/gi, variables.soyisim || "")
    .replace(/\{telefon\}/gi, variables.telefon || "")
    .replace(/\{tarih\}/gi, new Date().toLocaleDateString("tr-TR"))
    .replace(/\{[^}]+\}/g, (m) => `[${m.slice(1, -1)}]`)
}

export default function NewCampaignPage() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [campaignName, setCampaignName] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get<Template[]>("/api/templates")
      setTemplates(res.data)
    } catch { /* sessiz */ }
    finally { setLoadingTemplates(false) }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  function canNext() {
    if (step === 0) return !!selectedTemplate
    if (step === 1) return recipients.length > 0
    if (step === 2) return !!campaignName.trim()
    return false
  }

  async function handleSend() {
    if (!selectedTemplate || recipients.length === 0 || !campaignName.trim()) return
    setSending(true)
    try {
      await api.post("/api/campaigns", {
        name: campaignName.trim(),
        templateId: selectedTemplate.id,
        recipients,
      })
      setSent(true)
      setTimeout(() => router.push("/campaigns"), 2000)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg || "Kampanya başlatılamadı")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-24 gap-4">
        <CheckCircle size={64} className="text-green-500" />
        <h2 className="text-2xl font-bold text-neutral-900">Kampanya Başlatıldı!</h2>
        <p className="text-sm text-neutral-500">Kampanyalar sayfasına yönlendiriliyorsunuz...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Başlık */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Yeni Kampanya</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Toplu WhatsApp mesajı gönderin</p>
      </div>

      {/* Adım göstergesi */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${i === step ? "bg-neutral-900 text-white" : i < step ? "bg-green-100 text-green-700" : "text-neutral-400"}`}
            >
              {i < step ? <CheckCircle size={14} /> : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${i === step ? "bg-white text-neutral-900" : "bg-neutral-200 text-neutral-500"}`}
                >
                  {i + 1}
                </span>
              )}
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 ${i < step ? "bg-green-300" : "bg-neutral-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Adım içerikleri */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">

        {/* Adım 1: Şablon Seç */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-neutral-700 font-medium">
              <FileText size={18} />
              <span>Mesaj Şablonu Seçin</span>
            </div>
            {loadingTemplates ? (
              <div className="text-sm text-neutral-400 py-8 text-center">Şablonlar yükleniyor...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Henüz şablon yok</p>
                <p className="text-sm mt-1">Önce Şablonlar sayfasından bir şablon oluşturun</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {templates.map((t) => {
                  const active = selectedTemplate?.id === t.id
                  const vars = [...new Set(t.body.match(/\{[^}]+\}/g) || [])]
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`text-left p-4 rounded-xl border-2 transition-all
                        ${active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-neutral-900">{t.name}</span>
                        {active && <CheckCircle size={18} className="text-neutral-900 shrink-0" />}
                      </div>
                      <p className="text-sm text-neutral-500 mt-1 line-clamp-2 whitespace-pre-wrap">{t.body}</p>
                      {vars.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vars.map((v) => (
                            <span key={v} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{v}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Adım 2: Excel Yükle */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-neutral-700 font-medium">
              <Upload size={18} />
              <span>Alıcı Listesi Yükleyin</span>
            </div>
            <ExcelUpload onResult={setRecipients} />
            {recipients.length > 0 && (
              <p className="text-sm text-green-700 font-medium">
                {recipients.length} alıcı yüklendi
              </p>
            )}
          </div>
        )}

        {/* Adım 3: Önizleme */}
        {step === 2 && selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-neutral-700 font-medium">
              <Eye size={18} />
              <span>Önizleme ve Kampanya Adı</span>
            </div>

            {/* Kampanya adı */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Kampanya Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="örn. Haziran Kampanyası"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            {/* Özet */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Şablon", value: selectedTemplate.name },
                { label: "Alıcı Sayısı", value: `${recipients.length} kişi` },
                { label: "Tahmini Süre", value: `~${Math.ceil(recipients.length * 5.5 / 60)} dk` },
              ].map((item) => (
                <div key={item.label} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <p className="text-xs text-neutral-400">{item.label}</p>
                  <p className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Mesaj önizlemesi */}
            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">Örnek Mesaj</p>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
                  {recipients[0]
                    ? fillBody(selectedTemplate.body, recipients[0].variables)
                    : fillBody(selectedTemplate.body, { isim: "Ahmet", soyisim: "Yılmaz" })}
                </p>
                {recipients[0] && (
                  <p className="text-xs text-neutral-400 mt-2">→ {recipients[0].phone}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Adım 4: Gönder onayı */}
        {step === 3 && selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-neutral-700 font-medium">
              <Send size={18} />
              <span>Gönderim Onayı</span>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              {[
                ["Kampanya Adı", campaignName],
                ["Şablon", selectedTemplate.name],
                ["Toplam Alıcı", `${recipients.length} kişi`],
                ["Mesaj Gecikmesi", "3–8 saniye arası rastgele"],
                ["Tahmini Süre", `~${Math.ceil(recipients.length * 5.5 / 60)} dakika`],
              ].map(([k, v], i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 text-sm
                  ${i > 0 ? "border-t border-neutral-100" : ""}`}
                >
                  <span className="text-neutral-500">{k}</span>
                  <span className="font-medium text-neutral-900">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              Kampanya başladıktan sonra mesajlar sıraya alınır. Bağlı WhatsApp hesapları üzerinden sıralı olarak gönderilir.
            </div>

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {sending ? (
                <><RefreshCw size={16} className="animate-spin" /> Başlatılıyor...</>
              ) : (
                <><Send size={16} /> Kampanyayı Başlat</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigasyon */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : router.push("/campaigns")}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
        >
          <ChevronLeft size={15} />
          {step === 0 ? "Geri Dön" : "Önceki"}
        </button>

        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            Sonraki <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

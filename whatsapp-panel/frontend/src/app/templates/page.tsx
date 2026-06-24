"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Pencil, Trash2, RefreshCw, X, Check, FileText } from "lucide-react"
import api from "@/lib/api"
import TemplateEditor from "@/components/TemplateEditor"

interface Template {
  id: string
  name: string
  body: string
  createdAt: string
}

interface FormState {
  name: string
  body: string
}

const EMPTY_FORM: FormState = { name: "", body: "" }

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // null = kapalı | "new" = yeni | Template = düzenle
  const [modal, setModal] = useState<null | "new" | Template>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Template[]>("/api/templates")
      setTemplates(res.data)
    } catch { /* sessiz */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm(EMPTY_FORM)
    setModal("new")
  }

  function openEdit(t: Template) {
    setForm({ name: t.name, body: t.body })
    setModal(t)
  }

  function closeModal() {
    setModal(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      if (modal === "new") {
        const res = await api.post<Template>("/api/templates", form)
        setTemplates((p) => [res.data, ...p])
      } else if (modal && typeof modal === "object") {
        const res = await api.put<Template>(`/api/templates/${modal.id}`, form)
        setTemplates((p) => p.map((t) => (t.id === modal.id ? res.data : t)))
      }
      closeModal()
    } catch {
      alert("Kaydetme başarısız")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" şablonunu silmek istediğinizden emin misiniz?`)) return
    try {
      await api.delete(`/api/templates/${id}`)
      setTemplates((p) => p.filter((t) => t.id !== id))
    } catch {
      alert("Silme başarısız")
    }
  }

  // Şablondaki değişkenleri çıkar
  function extractVars(body: string) {
    return [...new Set(body.match(/\{[^}]+\}/g) || [])]
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Şablonlar</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{templates.length} şablon</p>
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
            onClick={openNew}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
          >
            <Plus size={14} /> Şablon Ekle
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-sm text-neutral-400 py-12 text-center">Yükleniyor...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Henüz şablon yok</p>
          <p className="text-sm mt-1">Şablon Ekle butonuna tıklayarak mesaj şablonu oluşturun</p>
          <p className="text-xs mt-2 text-neutral-300">
            Değişkenler için <code className="bg-neutral-100 px-1 rounded">{"{isim}"}</code>,{" "}
            <code className="bg-neutral-100 px-1 rounded">{"{soyisim}"}</code> kullanın
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => {
            const vars = extractVars(t.body)
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 flex flex-col gap-3"
              >
                {/* Başlık */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-neutral-900 truncate">{t.name}</h3>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Mesaj önizleme */}
                <p className="text-sm text-neutral-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {t.body}
                </p>

                {/* Değişkenler + tarih */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
                  <div className="flex flex-wrap gap-1">
                    {vars.length > 0 ? (
                      vars.map((v) => (
                        <span key={v} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {v}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-400">Değişken yok</span>
                    )}
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">
                    {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ekle / Düzenle Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Modal başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900">
                {modal === "new" ? "Yeni Şablon" : "Şablonu Düzenle"}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Şablon adı */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Şablon Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="örn. Hoş Geldin Mesajı"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              {/* Mesaj içeriği */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Mesaj İçeriği <span className="text-red-500">*</span>
                </label>
                <TemplateEditor
                  value={form.body}
                  onChange={(v) => setForm((f) => ({ ...f, body: v }))}
                  placeholder={"Merhaba {isim},\n\nKampanyamıza hoş geldiniz!"}
                />
                <p className="text-xs text-neutral-400 mt-1.5">
                  Değişkenler: <code className="bg-neutral-100 px-1 rounded">{"{isim}"}</code>{" "}
                  <code className="bg-neutral-100 px-1 rounded">{"{soyisim}"}</code>{" "}
                  <code className="bg-neutral-100 px-1 rounded">{"{telefon}"}</code>{" "}
                  <code className="bg-neutral-100 px-1 rounded">{"{tarih}"}</code>
                </p>
              </div>

              {/* Aksiyonlar */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim() || !form.body.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

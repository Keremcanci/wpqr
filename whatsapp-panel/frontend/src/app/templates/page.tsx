"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Plus, Pencil, Trash2, RefreshCw, X, Check, FileText, Image, Upload, XCircle } from "lucide-react"
import api from "@/lib/api"
import TemplateEditor from "@/components/TemplateEditor"
import { useToast } from "@/components/Toast"
import { useConfirm } from "@/components/ConfirmDialog"

interface Template {
  id: string
  name: string
  body: string
  imageUrl: string | null
  createdAt: string
}

interface FormState {
  name: string
  body: string
  imageUrl: string | null
}

const EMPTY_FORM: FormState = { name: "", body: "", imageUrl: null }

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // null = kapalı | "new" = yeni | Template = düzenle
  const [modal, setModal] = useState<null | "new" | Template>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const { toast } = useToast()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setForm({ name: t.name, body: t.body, imageUrl: t.imageUrl ?? null })
    setModal(t)
  }

  function closeModal() {
    setModal(null)
    setForm(EMPTY_FORM)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await api.post<{ imageUrl: string }>("/api/upload/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setForm((f) => ({ ...f, imageUrl: res.data.imageUrl }))
    } catch {
      toast("Görsel yükleme başarısız", "error")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeImage() {
    setForm((f) => ({ ...f, imageUrl: null }))
    if (fileInputRef.current) fileInputRef.current.value = ""
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
    } catch (err: any) {
      toast(err?.response?.data?.error || "Kaydetme başarısız", "error")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({ title: "Şablonu Sil", message: `"${name}" şablonu silinecek.`, confirmLabel: "Sil" })
    if (!ok) return
    try {
      await api.delete(`/api/templates/${id}`)
      setTemplates((p) => p.filter((t) => t.id !== id))
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Silme başarısız"
      toast(msg, "error")
    }
  }

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
                {/* Görsel önizleme */}
                {t.imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 h-32">
                    <img
                      src={t.imageUrl}
                      alt="Şablon görseli"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Başlık */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {t.imageUrl && <Image size={13} className="text-blue-500 shrink-0" />}
                    <h3 className="font-semibold text-neutral-900 truncate">{t.name}</h3>
                  </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-bold text-neutral-900">
                {modal === "new" ? "Yeni Şablon" : "Şablonu Düzenle"}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
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

              {/* Görsel */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Görsel <span className="text-neutral-400 font-normal">(isteğe bağlı)</span>
                </label>

                {form.imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                    <img
                      src={form.imageUrl}
                      alt="Yüklenen görsel"
                      className="w-full h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-white rounded-full p-0.5 shadow-sm hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-colors text-neutral-400 hover:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw size={20} className="animate-spin" />
                        <span className="text-sm">Yükleniyor...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span className="text-sm">Görsel yükle</span>
                        <span className="text-xs">JPG, PNG, GIF — maks. 5 MB</span>
                      </>
                    )}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
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

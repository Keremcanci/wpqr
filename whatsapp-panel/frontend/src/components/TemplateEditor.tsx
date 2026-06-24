"use client"

import { useState } from "react"
import { Eye, Code } from "lucide-react"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

// {değişken} ifadelerini renkli span ile sarar (önizleme için)
function highlightVars(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[^}]+\})/g)
  return parts.map((part, i) =>
    /^\{[^}]+\}$/.test(part) ? (
      <span key={i} className="bg-blue-100 text-blue-700 font-medium rounded px-0.5">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

// Önizleme: değişkenleri örnek değerlerle doldur
function fillPreview(text: string): string {
  return text
    .replace(/\{isim\}/gi, "Ahmet")
    .replace(/\{soyisim\}/gi, "Yılmaz")
    .replace(/\{telefon\}/gi, "+905321234567")
    .replace(/\{tarih\}/gi, new Date().toLocaleDateString("tr-TR"))
    .replace(/\{[^}]+\}/g, (m) => `[${m.slice(1, -1)}]`)
}

export default function TemplateEditor({ value, onChange, placeholder }: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit")

  const vars = [...new Set((value.match(/\{[^}]+\}/g) || []))]

  return (
    <div className="border border-neutral-300 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-200 bg-neutral-50">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-white border-b-2 border-neutral-900 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "edit" ? <Code size={12} /> : <Eye size={12} />}
            {t === "edit" ? "Düzenle" : "Önizleme"}
          </button>
        ))}
        {vars.length > 0 && (
          <div className="ml-auto flex items-center gap-1 px-3">
            {vars.map((v) => (
              <span key={v} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* İçerik */}
      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="w-full px-4 py-3 text-sm font-mono resize-none outline-none bg-white"
        />
      ) : (
        <div className="px-4 py-3 min-h-[144px] bg-white">
          {value ? (
            <div className="space-y-2">
              {/* Vurgulamalı orijinal */}
              <div className="text-xs text-neutral-400 mb-1">Şablon:</div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {highlightVars(value)}
              </p>
              {/* Doldurulmuş önizleme */}
              <div className="border-t border-neutral-100 pt-2 mt-2">
                <div className="text-xs text-neutral-400 mb-1">Örnek çıktı:</div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
                    {fillPreview(value)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400 italic">Önizlemek için metin girin.</p>
          )}
        </div>
      )}
    </div>
  )
}

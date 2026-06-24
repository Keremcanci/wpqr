"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileSpreadsheet, X, AlertTriangle, CheckCircle } from "lucide-react"
import api from "@/lib/api"

export interface Recipient {
  phone: string
  variables: { isim?: string; soyisim?: string; [k: string]: string | undefined }
}

interface UploadResult {
  total: number
  valid: number
  invalidCount: number
  recipients: Recipient[]
  invalidRows: { row: number; value: string }[]
}

interface Props {
  onResult: (recipients: Recipient[]) => void
}

export default function ExcelUpload({ onResult }: Props) {
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await api.post<UploadResult>("/api/upload/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setResult(res.data)
      onResult(res.data.recipients)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || "Dosya yüklenemedi")
      onResult([])
    } finally {
      setUploading(false)
    }
  }, [onResult])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
    onDrop: (files) => files[0] && upload(files[0]),
  })

  function reset() {
    setResult(null)
    setError(null)
    setFileName(null)
    onResult([])
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {!result && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-blue-400 bg-blue-50" : "border-neutral-300 hover:border-neutral-400 bg-neutral-50"}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-neutral-500">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Yükleniyor...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-neutral-500">
              <Upload size={32} className="text-neutral-400" />
              <p className="font-medium text-sm">
                {isDragActive ? "Dosyayı bırakın" : "Excel / CSV dosyasını sürükleyin"}
              </p>
              <p className="text-xs text-neutral-400">veya tıklayarak seçin · .xlsx .xls .csv · max 10MB</p>
              <p className="text-xs text-neutral-400 mt-1">
                A kolonu: telefon · B kolonu: isim · C kolonu: soyisim
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} />
          {error}
          <button onClick={reset} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sonuç */}
      {result && (
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          {/* Özet */}
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet size={16} className="text-green-600" />
              <span className="font-medium text-neutral-700">{fileName}</span>
            </div>
            <button onClick={reset} className="text-neutral-400 hover:text-neutral-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="px-4 py-3 flex gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-green-700">
              <CheckCircle size={14} />
              <span><strong>{result.valid}</strong> geçerli numara</span>
            </div>
            {result.invalidCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertTriangle size={14} />
                <span><strong>{result.invalidCount}</strong> geçersiz satır</span>
              </div>
            )}
          </div>

          {/* Önizleme tablosu */}
          <div className="max-h-48 overflow-y-auto border-t border-neutral-100">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-neutral-500 font-medium">#</th>
                  <th className="text-left px-4 py-2 text-neutral-500 font-medium">Telefon</th>
                  <th className="text-left px-4 py-2 text-neutral-500 font-medium">İsim</th>
                  <th className="text-left px-4 py-2 text-neutral-500 font-medium">Soyisim</th>
                </tr>
              </thead>
              <tbody>
                {result.recipients.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-neutral-50 hover:bg-neutral-50">
                    <td className="px-4 py-1.5 text-neutral-400">{i + 1}</td>
                    <td className="px-4 py-1.5 font-mono text-neutral-700">{r.phone}</td>
                    <td className="px-4 py-1.5 text-neutral-600">{r.variables.isim || "—"}</td>
                    <td className="px-4 py-1.5 text-neutral-600">{r.variables.soyisim || "—"}</td>
                  </tr>
                ))}
                {result.recipients.length > 50 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-center text-neutral-400">
                      ... ve {result.recipients.length - 50} kişi daha
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Geçersiz satırlar */}
          {result.invalidRows.length > 0 && (
            <div className="border-t border-neutral-100 px-4 py-2 bg-red-50">
              <p className="text-xs text-red-600 font-medium mb-1">Geçersiz satırlar:</p>
              <p className="text-xs text-red-500">
                {result.invalidRows.slice(0, 5).map(r => `Satır ${r.row}: "${r.value}"`).join(" · ")}
                {result.invalidRows.length > 5 && ` · ve ${result.invalidRows.length - 5} tane daha`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, createContext, useContext, useCallback, useRef } from "react"
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++counter.current
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }, [])

  const remove = (id: number) => setToasts((p) => p.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm max-w-sm pointer-events-auto animate-in slide-in-from-bottom-2 duration-200 ${
              t.type === "success"
                ? "bg-green-600 text-white"
                : t.type === "error"
                ? "bg-red-600 text-white"
                : "bg-neutral-800 text-white"
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {t.type === "success" ? (
                <CheckCircle size={16} />
              ) : t.type === "error" ? (
                <XCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 mt-0.5 opacity-70 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

"use client"

import { createContext, useContext, useState, useCallback, useRef } from "react"
import { AlertTriangle } from "lucide-react"

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({ message: "" })
  const resolveRef = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options)
    setOpen(true)
    return new Promise((resolve) => { resolveRef.current = resolve })
  }, [])

  function respond(answer: boolean) {
    setOpen(false)
    resolveRef.current(answer)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`shrink-0 p-2 rounded-full ${opts.danger !== false ? "bg-red-50" : "bg-neutral-100"}`}>
                <AlertTriangle size={18} className={opts.danger !== false ? "text-red-500" : "text-neutral-500"} />
              </div>
              <div>
                {opts.title && <p className="font-semibold text-neutral-900 mb-1">{opts.title}</p>}
                <p className="text-sm text-neutral-600 leading-snug">{opts.message}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => respond(false)}
                className="flex-1 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => respond(true)}
                className={`flex-1 py-2 rounded-lg text-sm text-white transition-colors ${
                  opts.danger !== false
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-neutral-900 hover:bg-neutral-700"
                }`}
              >
                {opts.confirmLabel ?? "Evet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

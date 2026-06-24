"use client"

import { Smartphone, Wifi, WifiOff, ShieldOff, Clock, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Account {
  id: string
  phone: string
  label: string | null
  status: "connected" | "disconnected" | "banned" | "qr_pending"
  isBackup: boolean
  dailySent: number
  dailyLimit: number
  lastSentAt: string | null
  proxyHost: string | null
  proxyPort: number | null
}

interface Props {
  account: Account
  onQR: (account: Account) => void
  onReconnect: (id: string) => void
  onDelete: (id: string) => void
}

const STATUS = {
  connected:    { label: "Bağlı",       color: "bg-green-100 text-green-700",  icon: Wifi },
  disconnected: { label: "Bağlı Değil", color: "bg-yellow-100 text-yellow-700", icon: WifiOff },
  banned:       { label: "Ban Yedi",    color: "bg-red-100 text-red-700",      icon: ShieldOff },
  qr_pending:   { label: "QR Bekliyor", color: "bg-blue-100 text-blue-700",    icon: Clock },
}

export default function AccountCard({ account, onQR, onReconnect, onDelete }: Props) {
  const s = STATUS[account.status] ?? STATUS.disconnected
  const Icon = s.icon
  const limitPct = account.dailyLimit > 0
    ? Math.min(100, Math.round((account.dailySent / account.dailyLimit) * 100))
    : 0

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 flex flex-col gap-3">
      {/* Üst satır */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Smartphone size={16} className="text-neutral-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-neutral-900 truncate">{account.phone}</p>
            {account.label && (
              <p className="text-xs text-neutral-400 truncate">{account.label}</p>
            )}
          </div>
        </div>
        <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0", s.color)}>
          <Icon size={11} />
          {s.label}
        </span>
      </div>

      {/* Günlük limit progress */}
      <div>
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>Günlük Gönderim</span>
          <span>{account.dailySent} / {account.dailyLimit}</span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", limitPct >= 90 ? "bg-red-500" : limitPct >= 60 ? "bg-yellow-400" : "bg-green-500")}
            style={{ width: `${limitPct}%` }}
          />
        </div>
      </div>

      {/* Proxy bilgisi */}
      {account.proxyHost && (
        <p className="text-xs text-neutral-400 truncate">
          🔒 {account.proxyHost}:{account.proxyPort}
        </p>
      )}

      {/* Yedek badge */}
      {account.isBackup && (
        <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full w-fit">
          Yedek Hesap
        </span>
      )}

      {/* Aksiyonlar */}
      <div className="flex gap-2 pt-1 border-t border-neutral-100">
        {account.status !== "connected" && (
          <button
            onClick={() => account.status === "qr_pending" ? onQR(account) : onReconnect(account.id)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {account.status === "qr_pending" ? (
              <><Clock size={12} /> QR Göster</>
            ) : (
              <><RefreshCw size={12} /> Bağlan</>
            )}
          </button>
        )}
        <button
          onClick={() => onDelete(account.id)}
          className="flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

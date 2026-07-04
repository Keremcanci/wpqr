"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Smartphone, FileText, Send, BarChart2, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Hesaplar", icon: Smartphone },
  { href: "/templates", label: "Şablonlar", icon: FileText },
  { href: "/campaigns/new", label: "Gönder", icon: Send },
  { href: "/campaigns", label: "Kampanyalar", icon: BarChart2 },
  { href: "/settings", label: "Ayarlar", icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  // En uzun uyan href = en spesifik eşleşme → sadece o aktif
  const activeHref = links
    .filter(({ href }) => pathname === href || pathname.startsWith(href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <aside className="w-56 shrink-0 bg-neutral-900 text-white flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-neutral-700">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">WA Panel</p>
        <h1 className="text-lg font-bold mt-0.5">Bulk Mesaj</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeHref === href
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-neutral-700 text-xs text-neutral-500">
        v1.0.0
      </div>
    </aside>
  )
}

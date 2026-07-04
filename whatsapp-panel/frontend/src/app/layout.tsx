import type { Metadata } from "next"
import "./globals.css"
import LayoutShell from "@/components/LayoutShell"

export const metadata: Metadata = {
  title: "WhatsApp Bulk Panel",
  description: "Toplu WhatsApp mesaj yönetim paneli",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="h-full bg-neutral-100 text-neutral-900 antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}

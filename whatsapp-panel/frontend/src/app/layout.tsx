import type { Metadata } from "next"
import "./globals.css"
import LayoutShell from "@/components/LayoutShell"
import { ToastProvider } from "@/components/Toast"
import { ConfirmProvider } from "@/components/ConfirmDialog"

export const metadata: Metadata = {
  title: "WhatsApp Bulk Panel",
  description: "Toplu WhatsApp mesaj yönetim paneli",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="h-full bg-neutral-100 text-neutral-900 antialiased">
        <ToastProvider>
          <ConfirmProvider>
            <LayoutShell>{children}</LayoutShell>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  )
}

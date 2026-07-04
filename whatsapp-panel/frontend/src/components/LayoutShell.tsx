"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Sidebar from "./Sidebar"

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  const isLoginPage = pathname === "/login"

  useEffect(() => {
    const token = localStorage.getItem("wp_token")
    if (!token && !isLoginPage) {
      router.replace("/login")
    } else {
      setReady(true)
    }
  }, [pathname, router, isLoginPage])

  if (isLoginPage) return <>{children}</>
  if (!ready) return null

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

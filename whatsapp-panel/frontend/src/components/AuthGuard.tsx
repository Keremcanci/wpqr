"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("wp_token")
    if (!token && pathname !== "/login") {
      router.replace("/login")
    } else {
      setChecked(true)
    }
  }, [pathname, router])

  if (!checked && pathname !== "/login") return null
  return <>{children}</>
}

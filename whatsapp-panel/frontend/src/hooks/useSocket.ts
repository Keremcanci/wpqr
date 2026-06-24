"use client"

import { useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"

let _socket: Socket | null = null

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", {
      transports: ["websocket"],
    })
  }
  return _socket
}

export function useSocket(
  events: Record<string, (...args: unknown[]) => void>
) {
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    const socket = getSocket()

    const handlers: Record<string, (...args: unknown[]) => void> = {}
    for (const [event, handler] of Object.entries(eventsRef.current)) {
      handlers[event] = (...args) => eventsRef.current[event]?.(...args)
      socket.on(event, handlers[event])
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler)
      }
    }
  }, [])
}

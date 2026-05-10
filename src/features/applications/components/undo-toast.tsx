'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/ui/button'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onTimeout: () => void
  timeoutMs?: number
}

export function UndoToast({
  message,
  onUndo,
  onTimeout,
  timeoutMs = 10_000,
}: UndoToastProps) {
  const [remaining, setRemaining] = useState(Math.ceil(timeoutMs / 1000))
  const hasTimedOut = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval)
          return 0
        }
        return r - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (remaining <= 0 && !hasTimedOut.current) {
      hasTimedOut.current = true
      onTimeout()
    }
  }, [remaining, onTimeout])

  const handleUndo = useCallback(() => {
    onUndo()
  }, [onUndo])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-4 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg">
      <span>{message}</span>
      <span className="tabular-nums text-background/60">{remaining}s</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleUndo}
        className="font-semibold"
      >
        Undo
      </Button>
    </div>
  )
}

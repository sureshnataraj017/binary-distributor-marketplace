import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  openDelay?: number
  closeDelay?: number
}

const MARGIN = 8

/**
 * Hover/focus popup rendered in a portal, so it is never scaled by the zoomable canvas or clipped by it.
 * The popup itself is hoverable, which lets people move onto it and click links (e.g. retailers).
 */
export function Tooltip({ content, children, openDelay = 180, closeDelay = 160 }: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<number>(undefined)
  const closeTimer = useRef<number>(undefined)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }

  const close = useCallback(() => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setAnchor(null)
    setPosition(null)
  }, [])

  const show = () => {
    clearTimers()
    if (anchor) return
    openTimer.current = window.setTimeout(() => {
      if (triggerRef.current) setAnchor(triggerRef.current.getBoundingClientRect())
    }, openDelay)
  }

  const hide = () => {
    clearTimers()
    closeTimer.current = window.setTimeout(close, closeDelay)
  }

  // Place the popup beside the trigger, flipping/clamping so it stays inside the viewport.
  useLayoutEffect(() => {
    if (!anchor || !popupRef.current) return
    const { width, height } = popupRef.current.getBoundingClientRect()
    let left = anchor.right + MARGIN
    if (left + width > window.innerWidth - MARGIN) left = anchor.left - width - MARGIN
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))
    const top = Math.max(MARGIN, Math.min(anchor.top, window.innerHeight - height - MARGIN))
    setPosition({ left, top })
  }, [anchor])

  // The canvas moves under a stale popup when panning/zooming, so dismiss it then.
  useEffect(() => {
    if (!anchor) return
    const onPointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('resize', close)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [anchor, close])

  useEffect(() => clearTimers, [])

  return (
    <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {anchor &&
        createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            onMouseEnter={clearTimers}
            onMouseLeave={hide}
            style={{
              position: 'fixed',
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="z-50 w-72 rounded-xl border border-line-strong bg-surface p-3 text-sm shadow-xl"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  )
}

import { useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { kNumberUrl } from '../lib/modelAnchors'

function linkifyNotes(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /FDA\s+(K\d{6,})/gi
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(text)) !== null) {
    const kn = match[1].toUpperCase()
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    parts.push(
      <a
        key={key++}
        href={kNumberUrl(kn)}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto font-medium text-blue-300 underline hover:text-blue-200"
        onClick={(e) => e.stopPropagation()}
      >
        {kn}
      </a>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : [text]
}

type TooltipPosition = { top: number; right: number }

export function NotesTooltip({ notes }: { notes: string }) {
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null)

  if (!notes.trim()) return null

  const handleMouseEnter = (event: MouseEvent<SVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({
      top: rect.top,
      right: window.innerWidth - rect.left + 8,
    })
  }

  return (
    <>
      <Info
        size={14}
        className="cursor-help text-slate-400 hover:text-slate-600"
        aria-label="View enrichment notes and FDA citations"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-auto fixed z-50 max-w-sm rounded bg-gray-900 p-2.5 text-xs leading-relaxed text-white shadow-lg"
            style={{ top: tooltip.top, right: tooltip.right }}
          >
            {linkifyNotes(notes)}
          </div>,
          document.body,
        )}
    </>
  )
}

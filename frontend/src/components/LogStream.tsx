import { useEffect, useRef, useState } from 'react'

interface Props {
  ticketId: string
  isActive: boolean
}

export default function LogStream({ ticketId, isActive }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!isActive && lines.length === 0) return

    const token = localStorage.getItem('token') ?? ''
    const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/tickets/${ticketId}/logs?token=${encodeURIComponent(token)}`

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      const raw: string = e.data || ''
      // Each message may have trailing \n; split and filter empties
      const newLines = raw.split('\n').filter((l) => l.length > 0)
      setLines((prev) => [...prev, ...newLines])
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [ticketId, isActive])

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  if (!isActive && lines.length === 0) return null

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-700">部署日志</h3>
        {connected && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            实时连接中
          </span>
        )}
      </div>
      <div className="bg-gray-900 rounded-lg p-4 h-72 overflow-y-auto log-terminal">
        {lines.length === 0 ? (
          <p className="text-gray-500 text-sm">等待日志...</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="text-green-400 whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

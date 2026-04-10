import type { TicketStatus } from '../api/tickets'

interface Props {
  status: TicketStatus
}

const statusConfig: Record<TicketStatus, { label: string; dot: string; text: string; bg: string }> = {
  draft:     { label: '草稿',   dot: 'bg-gray-400',       text: 'text-gray-600',       bg: 'bg-gray-100' },
  pending:   { label: '待审批', dot: 'bg-amber-500',      text: 'text-amber-600',      bg: 'bg-amber-50' },
  approved:  { label: '已批准', dot: 'bg-emerald-500',    text: 'text-emerald-600',    bg: 'bg-emerald-50' },
  rejected:  { label: '已驳回', dot: 'bg-red-500',        text: 'text-red-600',        bg: 'bg-red-50' },
  deploying: { label: '部署中', dot: 'bg-brand-red',      text: 'text-brand-red',      bg: 'bg-red-50' },
  done:      { label: '完成',   dot: 'bg-emerald-500',    text: 'text-emerald-600',    bg: 'bg-emerald-50' },
  failed:    { label: '失败',   dot: 'bg-red-500',        text: 'text-red-600',        bg: 'bg-red-50' },
}

export default function StatusBadge({ status }: Props) {
  const cfg = statusConfig[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

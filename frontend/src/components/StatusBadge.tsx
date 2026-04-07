import type { TicketStatus } from '../api/tickets'

interface Props {
  status: TicketStatus
}

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  draft:     { label: '草稿',   className: 'bg-gray-100 text-gray-700' },
  pending:   { label: '待审批', className: 'bg-yellow-100 text-yellow-800' },
  approved:  { label: '已批准', className: 'bg-blue-100 text-blue-800' },
  rejected:  { label: '已驳回', className: 'bg-red-100 text-red-800' },
  deploying: { label: '部署中', className: 'bg-purple-100 text-purple-800' },
  done:      { label: '完成',   className: 'bg-green-100 text-green-800' },
  failed:    { label: '失败',   className: 'bg-red-100 text-red-800' },
}

export default function StatusBadge({ status }: Props) {
  const cfg = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

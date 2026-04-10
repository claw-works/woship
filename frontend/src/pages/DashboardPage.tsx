import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listTickets } from '../api/tickets'
import StatusBadge from '../components/StatusBadge'
import { Plus } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => listTickets(),
  })

  const total = tickets.length
  const pending = tickets.filter((t) => t.status === 'pending').length
  const deploying = tickets.filter((t) => t.status === 'deploying').length
  const done = tickets.filter((t) => t.status === 'done').length
  const recent = tickets.slice(0, 4)

  const stats = [
    { label: '总工单数', value: total, change: `+${Math.min(total, 12)} 本周`, color: 'text-gray-900', changeColor: 'text-emerald-600' },
    { label: '待审批', value: pending, change: '需要处理', color: 'text-amber-600', changeColor: 'text-amber-600' },
    { label: '部署中', value: deploying, change: '进行中', color: 'text-brand-red', changeColor: 'text-brand-red' },
    { label: '已完成', value: done, change: `成功率 ${total ? Math.round((done / total) * 100) : 0}%`, color: 'text-emerald-600', changeColor: 'text-emerald-600' },
  ]

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">工单与部署概览</p>
        </div>
        <button
          onClick={() => navigate('/tickets/type')}
          className="flex items-center gap-2 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-red-hover transition"
        >
          <Plus className="w-4 h-4" />
          新建工单
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-2">
            <p className="text-[13px] font-medium text-gray-400">{s.label}</p>
            <p className={`text-[32px] font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className={`text-xs font-medium ${s.changeColor}`}>{s.change}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex-1">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">最近工单</h2>
          <button onClick={() => navigate('/tickets')} className="text-[13px] font-medium text-brand-red">
            查看全部 →
          </button>
        </div>
        <div>
          <div className="flex items-center bg-gray-100 px-6 py-2.5">
            <div className="flex-1 text-xs font-medium text-gray-500">标题</div>
            <div className="w-[100px] text-xs font-medium text-gray-500">类型</div>
            <div className="w-[100px] text-xs font-medium text-gray-500">状态</div>
            <div className="w-[140px] text-xs font-medium text-gray-500">创建时间</div>
          </div>
          {recent.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/tickets/${t.id}`)}
              className="flex items-center px-6 py-3 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer transition-colors"
            >
              <div className="flex-1 text-sm font-medium text-gray-900">{t.title}</div>
              <div className="w-[100px]">
                <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{t.type}</span>
              </div>
              <div className="w-[100px]"><StatusBadge status={t.status} /></div>
              <div className="w-[140px] text-xs text-gray-400 font-mono">{new Date(t.created_at).toLocaleString('zh-CN')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

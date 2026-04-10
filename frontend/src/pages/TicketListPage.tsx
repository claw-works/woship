import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listTickets, type TicketStatus } from '../api/tickets'
import StatusBadge from '../components/StatusBadge'
import { Plus, RefreshCw, ChevronRight } from 'lucide-react'

type TabStatus = TicketStatus | 'all'

const tabs: { label: string; value: TabStatus }[] = [
  { label: '全部',   value: 'all' },
  { label: '待审批', value: 'pending' },
  { label: '已批准', value: 'approved' },
  { label: '部署中', value: 'deploying' },
  { label: '完成',   value: 'done' },
  { label: '失败',   value: 'failed' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TicketListPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabStatus>('all')

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['tickets', activeTab],
    queryFn: () => listTickets(activeTab !== 'all' ? { status: activeTab } : undefined),
  })

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工单列表</h1>
          <p className="text-sm text-gray-400 mt-1">管理所有部署工单</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
          <button
            onClick={() => navigate('/tickets/type')}
            className="flex items-center gap-2 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-red-hover transition"
          >
            <Plus className="w-4 h-4" />
            新建工单
          </button>
        </div>
      </div>

      {/* Tabs — 设计稿圆角背景色切换 */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition ${
              activeTab === tab.value
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex-1">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">加载中...</div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm">暂无工单</p>
            <button onClick={() => navigate('/tickets/type')} className="mt-3 text-brand-red hover:underline text-sm">
              创建第一个工单
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center bg-gray-100 px-6 py-3">
              <div className="flex-1 text-xs font-medium text-gray-500">标题</div>
              <div className="w-[100px] text-xs font-medium text-gray-500">类型</div>
              <div className="w-[100px] text-xs font-medium text-gray-500">状态</div>
              <div className="w-[160px] text-xs font-medium text-gray-500">创建时间</div>
              <div className="w-[80px] text-xs font-medium text-gray-500 text-right">操作</div>
            </div>
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="flex items-center px-6 py-3.5 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer transition-colors"
              >
                <div className="flex-1 text-sm font-medium text-gray-900">{ticket.title}</div>
                <div className="w-[100px]">
                  <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{ticket.type}</span>
                </div>
                <div className="w-[100px]"><StatusBadge status={ticket.status} /></div>
                <div className="w-[160px] text-xs text-gray-400">{formatDate(ticket.created_at)}</div>
                <div className="w-[80px] flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${ticket.id}`) }}
                    className="flex items-center gap-0.5 text-xs text-brand-red"
                  >
                    详情 <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

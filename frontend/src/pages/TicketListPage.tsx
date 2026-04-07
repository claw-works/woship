import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listTickets, type TicketStatus } from '../api/tickets'
import StatusBadge from '../components/StatusBadge'
import { PlusCircle, ChevronRight, RefreshCw } from 'lucide-react'

type TabStatus = TicketStatus | 'all'

const tabs: { label: string; value: TabStatus }[] = [
  { label: '全部',   value: 'all' },
  { label: '草稿',   value: 'draft' },
  { label: '待审批', value: 'pending' },
  { label: '已批准', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工单列表</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理所有部署工单</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
          <button
            onClick={() => navigate('/tickets/new')}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            <PlusCircle className="w-4 h-4" />
            新建工单
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
              activeTab === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">加载中...</div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm">暂无工单</p>
            <button
              onClick={() => navigate('/tickets/new')}
              className="mt-3 text-indigo-600 hover:underline text-sm"
            >
              创建第一个工单
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">标题</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">类型</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">状态</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">创建时间</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">{ticket.title}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {ticket.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(ticket.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/tickets/${ticket.id}`)
                      }}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 ml-auto"
                    >
                      查看详情 <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

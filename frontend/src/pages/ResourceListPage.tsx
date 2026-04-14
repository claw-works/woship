import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listDeployments, deleteDeployment, remediateDeployment, type Deployment } from '../api/deployments'
import { useAuth } from '../hooks/useAuth'
import { RefreshCw, Trash2, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react'

const statusCfg: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  pending: { dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', label: '等待中' },
  running: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', label: '运行中' },
  stopped: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', label: '已停止' },
  failed:  { dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50', label: '失败' },
}

function DeployStatus({ status }: { status: string }) {
  const cfg = statusCfg[status] ?? statusCfg.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function DriftBadge({ status }: { status: string }) {
  if (status === 'drifted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-600">
        <ShieldAlert className="w-3 h-3" /> 已漂移
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600">
      <ShieldCheck className="w-3 h-3" /> 正常
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ResourceListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: deployments = [], isLoading, refetch } = useQuery({ queryKey: ['deployments'], queryFn: listDeployments })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDeployment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  })

  const remediateMut = useMutation({
    mutationFn: (id: string) => remediateDeployment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  })

  const handleDelete = (d: Deployment) => {
    if (confirm(`确定要回收资源「${d.app_name}」吗？`)) deleteMut.mutate(d.id)
  }

  const handleRemediate = (d: Deployment) => {
    if (confirm(`确定要纠偏「${d.app_name}」吗？这将重新 apply terraform 使云上资源恢复到定义状态。`)) remediateMut.mutate(d.id)
  }

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资源列表</h1>
          <p className="text-sm text-gray-400 mt-1">查看已部署资源状态，回收不再使用的资源</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
          <RefreshCw className="w-3.5 h-3.5" /> 刷新
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex-1">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">加载中...</div>
        ) : deployments.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">暂无已部署资源</div>
        ) : (
          <div>
            <div className="flex items-center bg-gray-100 px-6 py-3">
              <div className="flex-1 text-xs font-medium text-gray-500">应用名称</div>
              <div className="w-[120px] text-xs font-medium text-gray-500">镜像</div>
              <div className="w-[140px] text-xs font-medium text-gray-500">域名</div>
              <div className="w-[80px] text-xs font-medium text-gray-500">状态</div>
              <div className="w-[80px] text-xs font-medium text-gray-500">漂移</div>
              <div className="w-[100px] text-xs font-medium text-gray-500">创建时间</div>
              <div className="w-[100px] text-xs font-medium text-gray-500 text-right">操作</div>
            </div>
            {deployments.map((d) => (
              <div key={d.id} className="flex items-center px-6 py-3.5 border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{d.app_name}</div>
                  <div className="font-mono text-[11px] text-gray-400">{d.namespace}</div>
                </div>
                <div className="w-[120px]">
                  <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg truncate block max-w-[110px]">{d.image}</span>
                </div>
                <div className="w-[140px]">
                  {d.domain ? (
                    <a href={`https://${d.domain}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-red hover:underline truncate max-w-[130px]">
                      {d.domain} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </div>
                <div className="w-[80px]"><DeployStatus status={d.status} /></div>
                <div className="w-[80px]">{d.status === 'running' && <DriftBadge status={d.drift_status} />}</div>
                <div className="w-[100px] text-xs text-gray-400">{formatDate(d.created_at)}</div>
                <div className="w-[100px] flex justify-end gap-2">
                  {d.status === 'running' && d.drift_status === 'drifted' && isAdmin && (
                    <button onClick={() => handleRemediate(d)} disabled={remediateMut.isPending}
                      className="text-xs text-orange-600 hover:text-orange-800 transition disabled:opacity-50">
                      纠偏
                    </button>
                  )}
                  {d.status === 'running' && (
                    <button onClick={() => handleDelete(d)} disabled={deleteMut.isPending}
                      className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50">
                      <Trash2 className="w-3 h-3" /> 回收
                    </button>
                  )}
                  {d.status !== 'running' && (
                    <button onClick={() => navigate(`/tickets/${d.ticket_id}`)}
                      className="text-xs text-brand-red hover:underline">详情</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTicket, submitTicket, approveTicket, rejectTicket } from '../api/tickets'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'
import LogStream from '../components/LogStream'
import { ArrowLeft, CheckCircle, XCircle, Send, AlertTriangle } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="w-28 flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  )
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id!),
    refetchInterval: (query) => {
      const st = query.state.data?.status
      return st === 'deploying' || st === 'pending' ? 3000 : false
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ticket', id] })

  const submitMut = useMutation({
    mutationFn: () => submitTicket(id!),
    onSuccess: invalidate,
    onError: () => setActionError('提交审批失败'),
  })

  const approveMut = useMutation({
    mutationFn: () => approveTicket(id!),
    onSuccess: invalidate,
    onError: () => setActionError('审批操作失败'),
  })

  const rejectMut = useMutation({
    mutationFn: () => rejectTicket(id!, rejectReason),
    onSuccess: () => {
      setRejectModalOpen(false)
      setRejectReason('')
      invalidate()
    },
    onError: () => setActionError('驳回操作失败'),
  })

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400">加载中...</div>
  }
  if (!ticket) {
    return <div className="py-20 text-center text-gray-400">工单不存在</div>
  }

  const isApprover = user?.role === 'admin' || user?.role === 'approver'
  const showLog = ['deploying', 'done', 'failed'].includes(ticket.status)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition mt-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            创建于 {formatDate(ticket.created_at)} &nbsp;·&nbsp;
            更新于 {formatDate(ticket.updated_at)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">ID: {ticket.id}</p>
        </div>
      </div>

      {/* Ticket info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">工单信息</h2>
        <InfoRow label="工单类型" value={<span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{ticket.type}</span>} />
        <InfoRow label="Docker 镜像" value={<span className="font-mono">{ticket.payload?.image}</span>} />
        <InfoRow label="域名" value={ticket.payload?.domain} />
        <InfoRow label="端口" value={ticket.payload?.port} />
        <InfoRow label="副本数" value={ticket.payload?.replicas} />
        <InfoRow label="CPU" value={ticket.payload?.resources?.cpu} />
        <InfoRow label="内存" value={ticket.payload?.resources?.memory} />
        <InfoRow label="Provider" value={<span className="font-mono text-xs">{ticket.payload?.provider_id}</span>} />
        {ticket.payload?.env && Object.keys(ticket.payload.env).length > 0 && (
          <div className="py-2.5 border-b border-gray-100">
            <span className="w-28 inline-block flex-shrink-0 text-sm text-gray-500">环境变量</span>
            <div className="mt-2 space-y-1">
              {Object.entries(ticket.payload.env).map(([k, v]) => (
                <div key={k} className="font-mono text-xs bg-gray-50 px-3 py-1 rounded">
                  <span className="text-blue-700">{k}</span>
                  <span className="text-gray-400"> = </span>
                  <span className="text-green-700">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {ticket.reviewed_by && (
          <InfoRow label="审批人" value={ticket.reviewed_by} />
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">操作</h2>

        {actionError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {actionError}
          </div>
        )}

        {ticket.status === 'draft' && (
          <button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4" />
            {submitMut.isPending ? '提交中...' : '提交审批'}
          </button>
        )}

        {ticket.status === 'pending' && isApprover && (
          <div className="flex gap-3">
            <button
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending || rejectMut.isPending}
              className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CheckCircle className="w-4 h-4" />
              {approveMut.isPending ? '处理中...' : '批准'}
            </button>
            <button
              onClick={() => setRejectModalOpen(true)}
              disabled={approveMut.isPending || rejectMut.isPending}
              className="flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
            >
              <XCircle className="w-4 h-4" />
              驳回
            </button>
          </div>
        )}

        {ticket.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
              <XCircle className="w-4 h-4" />
              工单已被驳回
            </div>
            {ticket.reject_reason && (
              <p className="text-sm text-red-600 mt-1">
                驳回原因：{ticket.reject_reason}
              </p>
            )}
          </div>
        )}

        {!['draft', 'pending', 'rejected'].includes(ticket.status) && (
          <p className="text-sm text-gray-500">
            当前状态 <StatusBadge status={ticket.status} />，无可用操作。
          </p>
        )}
      </div>

      {/* Log stream */}
      {showLog && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <LogStream ticketId={ticket.id} isActive={ticket.status === 'deploying'} />
        </div>
      )}

      {/* Reject modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">驳回工单</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              驳回原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModalOpen(false); setRejectReason('') }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={() => rejectMut.mutate()}
                disabled={!rejectReason.trim() || rejectMut.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {rejectMut.isPending ? '处理中...' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

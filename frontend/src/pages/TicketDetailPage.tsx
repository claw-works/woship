import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTicket, submitTicket, approveTicket, rejectTicket } from '../api/tickets'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'
import LogStream from '../components/LogStream'
import { ArrowLeft, CheckCircle, XCircle, Send } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2.5 border-t border-gray-200">
      <span className="w-[100px] flex-shrink-0 text-[13px] text-gray-400">{label}</span>
      <span className="text-[13px] text-gray-900 font-medium">{value}</span>
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
  const submitMut = useMutation({ mutationFn: () => submitTicket(id!), onSuccess: invalidate, onError: () => setActionError('提交审批失败') })
  const approveMut = useMutation({ mutationFn: () => approveTicket(id!), onSuccess: invalidate, onError: () => setActionError('审批操作失败') })
  const rejectMut = useMutation({
    mutationFn: () => rejectTicket(id!, rejectReason),
    onSuccess: () => { setRejectModalOpen(false); setRejectReason(''); invalidate() },
    onError: () => setActionError('驳回操作失败'),
  })

  if (isLoading) return <div className="py-20 text-center text-gray-400">加载中...</div>
  if (!ticket) return <div className="py-20 text-center text-gray-400">工单不存在</div>

  const isApprover = user?.role === 'admin' || user?.role === 'approver'
  const showLog = ['deploying', 'done', 'failed'].includes(ticket.status)

  return (
    <div className="p-8 flex flex-col items-center">
      <div className="w-full max-w-[720px] space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200 transition mt-0.5">
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-xs text-gray-400">创建于 {formatDate(ticket.created_at)} · 更新于 {formatDate(ticket.updated_at)}</p>
            <p className="text-[11px] text-gray-400 font-mono">ID: {ticket.id}</p>
          </div>
        </div>

        {/* Ticket Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-2">工单信息</h2>
          <InfoRow label="工单类型" value={<span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{ticket.type}</span>} />
          <InfoRow label="Docker 镜像" value={<span className="font-mono text-[13px]">{ticket.payload?.image}</span>} />
          <InfoRow label="域名" value={ticket.payload?.domain} />
          <InfoRow label="端口 / 副本" value={<span className="font-mono text-[13px]">{ticket.payload?.port} / {ticket.payload?.replicas}</span>} />
          <InfoRow label="CPU / 内存" value={<span className="font-mono text-[13px]">{ticket.payload?.resources?.cpu} / {ticket.payload?.resources?.memory}</span>} />
          <InfoRow label="Provider" value={<span className="font-mono text-[13px]">{ticket.payload?.provider_id}</span>} />
        </div>

        {/* Actions */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-gray-900">审批操作</h2>
          {actionError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{actionError}</div>}

          {ticket.status === 'draft' && (
            <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}
              className="flex items-center gap-2 bg-brand-red text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-brand-red-hover disabled:opacity-50 transition">
              <Send className="w-4 h-4" /> {submitMut.isPending ? '提交中...' : '提交审批'}
            </button>
          )}

          {ticket.status === 'pending' && isApprover && (
            <div className="flex gap-3">
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending || rejectMut.isPending}
                className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
                <CheckCircle className="w-4 h-4" /> {approveMut.isPending ? '处理中...' : '批准'}
              </button>
              <button onClick={() => setRejectModalOpen(true)} disabled={approveMut.isPending || rejectMut.isPending}
                className="flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
                <XCircle className="w-4 h-4" /> 驳回
              </button>
            </div>
          )}

          {ticket.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium text-sm"><XCircle className="w-4 h-4" /> 工单已被驳回</div>
              {ticket.reject_reason && <p className="text-sm text-red-600 mt-1">驳回原因：{ticket.reject_reason}</p>}
            </div>
          )}

          {!['draft', 'pending', 'rejected'].includes(ticket.status) && (
            <p className="text-sm text-gray-500">当前状态 <StatusBadge status={ticket.status} />，无可用操作。</p>
          )}
        </div>

        {showLog && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <LogStream ticketId={ticket.id} isActive={ticket.status === 'deploying'} />
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">驳回工单</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">驳回原因 <span className="text-red-500">*</span></label>
            <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="请填写驳回原因..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectModalOpen(false); setRejectReason('') }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">取消</button>
              <button onClick={() => rejectMut.mutate()} disabled={!rejectReason.trim() || rejectMut.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition">
                {rejectMut.isPending ? '处理中...' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

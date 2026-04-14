import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { createTicket, submitTicket } from '../api/tickets'
import { listProviders } from '../api/providers'
import { ArrowLeft } from 'lucide-react'

const dbTypes = ['postgresql', 'mysql', 'redis', 'mongodb'] as const
const versions: Record<string, string[]> = {
  postgresql: ['16', '15', '14'],
  mysql: ['8.0', '5.7'],
  redis: ['7.2', '7.0', '6.2'],
  mongodb: ['7.0', '6.0'],
}

export default function CreateDbTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [dbType, setDbType] = useState<typeof dbTypes[number]>('postgresql')
  const [instanceName, setInstanceName] = useState('')
  const [version, setVersion] = useState('16')
  const [storageGb, setStorageGb] = useState(20)
  const [ha, setHa] = useState(false)
  const [providerId, setProviderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders })

  const buildPayload = () => ({
    db_type: dbType,
    instance_name: instanceName,
    version,
    storage_gb: storageGb,
    high_availability: ha,
    provider_id: providerId,
  })

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const t = await createTicket({ type: 'db_request', title, payload: buildPayload() }); navigate(`/tickets/${t.id}`) }
    catch { setError('保存草稿失败') } finally { setLoading(false) }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const t = await createTicket({ type: 'db_request', title, payload: buildPayload() }); await submitTicket(t.id); navigate(`/tickets/${t.id}`) }
    catch { setError('提交失败') } finally { setLoading(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition'
  const labelCls = 'block text-[13px] font-medium text-gray-500 mb-1.5'

  return (
    <div className="p-8 flex flex-col items-center">
      <div className="w-full max-w-[640px] space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200 transition">
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">新建工单</h1>
            <p className="text-sm text-gray-400 mt-1">申请数据库实例</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-7 space-y-5">
          <div>
            <label className={labelCls}>工单标题</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：用户中心 PostgreSQL 数据库" className={inputCls} />
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">数据库配置</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>数据库类型</label>
                <select value={dbType} onChange={(e) => { setDbType(e.target.value as typeof dbTypes[number]); setVersion(versions[e.target.value]?.[0] ?? '') }} className={inputCls}>
                  {dbTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>版本</label>
                <select value={version} onChange={(e) => setVersion(e.target.value)} className={inputCls}>
                  {(versions[dbType] ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>实例名称</label>
              <input type="text" required value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="my-database" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>存储容量 (GB)</label>
                <input type="number" required min={5} value={storageGb} onChange={(e) => setStorageGb(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cloud Provider</label>
                <select required value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
                  <option value="">-- 选择 Provider --</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ha} onChange={(e) => setHa(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-red focus:ring-brand-red" />
              <span className="text-sm text-gray-700">启用高可用（主从复制）</span>
            </label>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</div>}

          <div className="border-t border-gray-200" />

          <div className="flex gap-3">
            <button type="button" onClick={handleSaveDraft} disabled={loading || !title || !instanceName || !providerId}
              className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition">
              保存草稿
            </button>
            <button type="button" onClick={handleSubmit} disabled={loading || !title || !instanceName || !providerId}
              className="flex-1 bg-brand-red text-white py-3 rounded-lg text-sm font-semibold hover:bg-brand-red-hover disabled:opacity-50 transition">
              {loading ? '提交中...' : '提交审批'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

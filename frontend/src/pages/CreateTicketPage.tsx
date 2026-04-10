import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { createTicket, submitTicket } from '../api/tickets'
import { listProviders } from '../api/providers'
import { PlusCircle, MinusCircle, ArrowLeft } from 'lucide-react'

interface EnvRow { key: string; value: string }

export default function CreateTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [image, setImage] = useState('')
  const [port, setPort] = useState(8080)
  const [domain, setDomain] = useState('')
  const [replicas, setReplicas] = useState(2)
  const [providerId, setProviderId] = useState('')
  const [cpu, setCpu] = useState('100m')
  const [memory, setMemory] = useState('128Mi')
  const [envRows, setEnvRows] = useState<EnvRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
  })

  const addEnvRow = () => setEnvRows((r) => [...r, { key: '', value: '' }])
  const removeEnvRow = (i: number) => setEnvRows((r) => r.filter((_, idx) => idx !== i))
  const updateEnvRow = (i: number, field: 'key' | 'value', val: string) =>
    setEnvRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)))

  const buildPayload = () => {
    const env: Record<string, string> = {}
    envRows.forEach(({ key, value }) => { if (key) env[key] = value })
    return { image, port, domain, replicas, env: Object.keys(env).length ? env : undefined, resources: { cpu, memory }, provider_id: providerId }
  }

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const t = await createTicket({ type: 'docker_deploy', title, payload: buildPayload() }); navigate(`/tickets/${t.id}`) }
    catch { setError('保存草稿失败') } finally { setLoading(false) }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const t = await createTicket({ type: 'docker_deploy', title, payload: buildPayload() }); await submitTicket(t.id); navigate(`/tickets/${t.id}`) }
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
            <p className="text-sm text-gray-400 mt-1">创建 Docker 部署工单</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-7 space-y-5">
          <div>
            <label className={labelCls}>工单标题</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="描述这次部署的内容" className={inputCls} />
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">部署配置</h3>
            <div>
              <label className={labelCls}>Docker 镜像</label>
              <input type="text" required value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:latest" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>端口</label><input type="number" required value={port} onChange={(e) => setPort(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>域名</label><input type="text" required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="myapp.example.com" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>副本数</label><input type="number" required min={1} value={replicas} onChange={(e) => setReplicas(Number(e.target.value))} className={inputCls} /></div>
              <div>
                <label className={labelCls}>Cloud Provider</label>
                <select required value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
                  <option value="">-- 选择 Provider --</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>CPU</label><input type="text" required value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="100m" className={inputCls} /></div>
              <div><label className={labelCls}>内存</label><input type="text" required value={memory} onChange={(e) => setMemory(e.target.value)} placeholder="128Mi" className={inputCls} /></div>
            </div>
          </div>

          <div className="border-t border-gray-200" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-gray-900">环境变量</h3>
              <button type="button" onClick={addEnvRow} className="flex items-center gap-1 text-xs text-brand-red hover:text-brand-red-hover transition">
                <PlusCircle className="w-4 h-4" /> 添加变量
              </button>
            </div>
            {envRows.length === 0 ? (
              <p className="text-sm text-gray-400">暂无环境变量</p>
            ) : (
              <div className="space-y-2">
                {envRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={row.key} onChange={(e) => updateEnvRow(i, 'key', e.target.value)} placeholder="KEY" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-red/20" />
                    <span className="text-gray-400 text-sm">=</span>
                    <input type="text" value={row.value} onChange={(e) => updateEnvRow(i, 'value', e.target.value)} placeholder="VALUE" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-red/20" />
                    <button type="button" onClick={() => removeEnvRow(i)} className="text-red-400 hover:text-red-600"><MinusCircle className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</div>}

          <div className="border-t border-gray-200" />

          <div className="flex gap-3">
            <button type="button" onClick={handleSaveDraft} disabled={loading || !title || !image || !domain || !providerId}
              className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition">
              保存草稿
            </button>
            <button type="button" onClick={handleSubmit} disabled={loading || !title || !image || !domain || !providerId}
              className="flex-1 bg-brand-red text-white py-3 rounded-lg text-sm font-semibold hover:bg-brand-red-hover disabled:opacity-50 transition">
              {loading ? '提交中...' : '提交审批'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

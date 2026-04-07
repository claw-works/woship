import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { createTicket, submitTicket } from '../api/tickets'
import { listProviders } from '../api/providers'
import { PlusCircle, MinusCircle, ArrowLeft } from 'lucide-react'

interface EnvRow {
  key: string
  value: string
}

export default function CreateTicketPage() {
  const navigate = useNavigate()

  // Form state
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
    return {
      image,
      port,
      domain,
      replicas,
      env: Object.keys(env).length ? env : undefined,
      resources: { cpu, memory },
      provider_id: providerId,
    }
  }

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ticket = await createTicket({ type: 'docker_deploy', title, payload: buildPayload() })
      navigate(`/tickets/${ticket.id}`)
    } catch {
      setError('保存草稿失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ticket = await createTicket({ type: 'docker_deploy', title, payload: buildPayload() })
      await submitTicket(ticket.id)
      navigate(`/tickets/${ticket.id}`)
    } catch {
      setError('提交失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新建工单</h1>
          <p className="text-sm text-gray-500 mt-0.5">创建 Docker 部署工单</p>
        </div>
      </div>

      <form className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Title */}
        <div>
          <label className={labelClass}>工单标题</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="描述这次部署的内容"
            className={inputClass}
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">部署配置</h3>
          <div className="space-y-4">
            {/* Image */}
            <div>
              <label className={labelClass}>Docker 镜像</label>
              <input
                type="text"
                required
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="nginx:latest"
                className={inputClass}
              />
            </div>

            {/* Port + Domain */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>端口</label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>域名</label>
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="myapp.example.com"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Replicas + Provider */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>副本数</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={replicas}
                  onChange={(e) => setReplicas(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Cloud Provider</label>
                <select
                  required
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- 选择 Provider --</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CPU + Memory */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CPU</label>
                <input
                  type="text"
                  required
                  value={cpu}
                  onChange={(e) => setCpu(e.target.value)}
                  placeholder="100m"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>内存</label>
                <input
                  type="text"
                  required
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="128Mi"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Env vars */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">环境变量</h3>
            <button
              type="button"
              onClick={addEnvRow}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition"
            >
              <PlusCircle className="w-4 h-4" />
              添加变量
            </button>
          </div>
          {envRows.length === 0 ? (
            <p className="text-sm text-gray-400">暂无环境变量</p>
          ) : (
            <div className="space-y-2">
              {envRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateEnvRow(i, 'key', e.target.value)}
                    placeholder="KEY"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-gray-400 text-sm">=</span>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateEnvRow(i, 'value', e.target.value)}
                    placeholder="VALUE"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvRow(i)}
                    className="text-red-400 hover:text-red-600 transition"
                  >
                    <MinusCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || !title || !image || !domain || !providerId}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            保存草稿
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !title || !image || !domain || !providerId}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '提交中...' : '提交审批'}
          </button>
        </div>
      </form>
    </div>
  )
}

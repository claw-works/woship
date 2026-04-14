import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProvider } from '../../api/providers'
import { ArrowLeft } from 'lucide-react'

const cloudProviders = [
  { value: 'aws', label: 'AWS', disabled: false },
  { value: 'aliyun', label: '阿里云', disabled: true },
  { value: 'azure', label: 'Azure', disabled: true },
  { value: 'gcp', label: 'GCP', disabled: true },
  { value: 'tencent', label: '腾讯云', disabled: true },
  { value: 'huawei', label: '华为云', disabled: true },
]

export default function ProviderFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState('aws')
  const [region, setRegion] = useState('')
  const [useBuiltinCreds, setUseBuiltinCreds] = useState(false)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [cpuPool, setCpuPool] = useState('')
  const [memoryPool, setMemoryPool] = useState('')

  const createMut = useMutation({
    mutationFn: (data: { name: string; type: string; config: Record<string, unknown> }) => createProvider(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['providers'] }); navigate('/admin/providers') },
  })

  const handleCreate = () => {
    const config: Record<string, unknown> = { region }
    if (useBuiltinCreds) {
      config.credentials = 'builtin'
    } else {
      config.access_key = accessKey
      config.secret_key = secretKey
    }
    if (cpuPool) config.cpu_pool = cpuPool
    if (memoryPool) config.memory_pool = memoryPool
    createMut.mutate({ name, type, config })
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
            <h1 className="text-2xl font-bold text-gray-900">新增 Provider</h1>
            <p className="text-sm text-gray-400 mt-1">配置云厂商账号与资源池</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-7 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>名称</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-aws-account" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>云厂商</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {cloudProviders.map((p) => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}{p.disabled ? ' (即将支持)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>区域</label>
            <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1" className={inputCls} />
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">凭证配置</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useBuiltinCreds} onChange={(e) => setUseBuiltinCreds(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-red focus:ring-brand-red" />
              <span className="text-sm text-gray-700">使用环境内置凭证</span>
            </label>
            {!useBuiltinCreds && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Access Key</label>
                  <input type="text" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="AKIA..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Secret Key</label>
                  <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="••••••••" className={`${inputCls} font-mono`} />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">资源池</h3>
            <p className="text-xs text-gray-400 mb-3">不填则不限制</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>CPU 池大小</label>
                <div className="relative">
                  <input type="number" value={cpuPool} onChange={(e) => setCpuPool(e.target.value)} placeholder="不限" className={`${inputCls} pr-10`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">核</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>内存池大小</label>
                <div className="relative">
                  <input type="number" value={memoryPool} onChange={(e) => setMemoryPool(e.target.value)} placeholder="不限" className={`${inputCls} pr-12`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">GiB</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200" />

          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition">
              取消
            </button>
            <button onClick={handleCreate} disabled={!name || !region || (!useBuiltinCreds && (!accessKey || !secretKey)) || createMut.isPending}
              className="flex-1 bg-brand-red text-white py-3 rounded-lg text-sm font-semibold hover:bg-brand-red-hover disabled:opacity-50 transition">
              {createMut.isPending ? '创建中...' : '创建 Provider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

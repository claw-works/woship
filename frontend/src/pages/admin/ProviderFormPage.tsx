import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProvider } from '../../api/providers'
import { ArrowLeft } from 'lucide-react'

// 两级 Provider 类型选项
const providerTypes = [
  { group: '云厂商', types: [
    { value: 'aws_eks', label: 'AWS EKS' },
    { value: 'aliyun_ack', label: '阿里云 ACK' },
    { value: 'tencent_tke', label: '腾讯云 TKE' },
    { value: 'huawei_cce', label: '华为云 CCE' },
  ]},
  { group: '基础设施', types: [
    { value: 'docker', label: 'Docker' },
    { value: 'vmware', label: 'VMware' },
    { value: 'local', label: '本地集群' },
  ]},
]

export default function ProviderFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState('aws_eks')
  const [config, setConfig] = useState('{}')
  const [configError, setConfigError] = useState('')

  const createMut = useMutation({
    mutationFn: (data: { name: string; type: string; config: Record<string, unknown> }) => createProvider(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['providers'] }); navigate('/admin/providers') },
  })

  const handleCreate = () => {
    setConfigError('')
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(config) } catch { setConfigError('Config 必须是合法 JSON'); return }
    createMut.mutate({ name, type, config: parsed })
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
            <p className="text-sm text-gray-400 mt-1">配置云服务 Provider 连接信息</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-7 space-y-5">
          <div>
            <label className={labelCls}>名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-provider" className={inputCls} />
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">Provider 类型</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>类型</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                  {providerTypes.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.types.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>区域</label>
                <input type="text" placeholder="us-east-1" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200" />

          <div>
            <label className={labelCls}>Config (JSON)</label>
            <textarea rows={6} value={config} onChange={(e) => setConfig(e.target.value)} placeholder='{"region": "us-east-1"}'
              className={`${inputCls} font-mono resize-y`} />
            {configError && <p className="text-xs text-red-600 mt-1">{configError}</p>}
          </div>

          <div className="border-t border-gray-200" />

          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition">
              取消
            </button>
            <button onClick={handleCreate} disabled={!name || createMut.isPending}
              className="flex-1 bg-brand-red text-white py-3 rounded-lg text-sm font-semibold hover:bg-brand-red-hover disabled:opacity-50 transition">
              {createMut.isPending ? '创建中...' : '创建 Provider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

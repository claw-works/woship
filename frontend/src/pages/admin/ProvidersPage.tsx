import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  type Provider,
  type CreateProviderPayload,
} from '../../api/providers'
import {
  PlusCircle,
  Trash2,
  FlaskConical,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
} from 'lucide-react'

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

interface TestState {
  [id: string]: 'testing' | 'ok' | 'fail'
}

export default function ProvidersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('mock')
  const [formConfig, setFormConfig] = useState('{}')
  const [configError, setConfigError] = useState('')
  const [actionError, setActionError] = useState('')
  const [testState, setTestState] = useState<TestState>({})

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['providers'] })

  const createMut = useMutation({
    mutationFn: (data: CreateProviderPayload) => createProvider(data),
    onSuccess: () => {
      invalidate()
      setShowForm(false)
      resetForm()
    },
    onError: () => setActionError('创建 Provider 失败'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateProvider(id, { enabled }),
    onSuccess: invalidate,
    onError: () => setActionError('更新状态失败'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: invalidate,
    onError: () => setActionError('删除失败'),
  })

  const resetForm = () => {
    setFormName('')
    setFormType('mock')
    setFormConfig('{}')
    setConfigError('')
  }

  const handleCreate = () => {
    setConfigError('')
    setActionError('')
    let parsedConfig: Record<string, unknown>
    try {
      parsedConfig = JSON.parse(formConfig)
    } catch {
      setConfigError('Config 必须是合法 JSON')
      return
    }
    createMut.mutate({ name: formName, type: formType, config: parsedConfig })
  }

  const handleTest = async (provider: Provider) => {
    setTestState((s) => ({ ...s, [provider.id]: 'testing' }))
    try {
      const res = await testProvider(provider.id)
      setTestState((s) => ({ ...s, [provider.id]: res.ok ? 'ok' : 'fail' }))
    } catch {
      setTestState((s) => ({ ...s, [provider.id]: 'fail' }))
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除该 Provider 吗？')) {
      deleteMut.mutate(id)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider 管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理云服务 Provider 配置（仅管理员可见）</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setActionError('') }}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <PlusCircle className="w-4 h-4" />
          添加 Provider
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">新增 Provider</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="my-provider"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>类型</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className={inputClass}
              >
                <option value="mock">mock</option>
                <option value="aws">aws</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className={labelClass}>Config (JSON)</label>
            <textarea
              rows={5}
              value={formConfig}
              onChange={(e) => setFormConfig(e.target.value)}
              placeholder='{"region": "us-east-1"}'
              className={`${inputClass} font-mono resize-y`}
            />
            {configError && (
              <p className="text-xs text-red-600 mt-1">{configError}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!formName || createMut.isPending}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {createMut.isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      )}

      {/* Provider list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">加载中...</div>
        ) : providers.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm">暂无 Provider</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">名称</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">类型</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">状态</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">连通性</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div>{p.name}</div>
                    <div className="font-mono text-xs text-gray-400">{p.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {p.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleMut.mutate({ id: p.id, enabled: !p.enabled })}
                      disabled={toggleMut.isPending}
                      className="flex items-center gap-2 text-sm"
                      title={p.enabled ? '点击禁用' : '点击启用'}
                    >
                      {p.enabled ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-green-500" />
                          <span className="text-green-600">已启用</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-500">已禁用</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    {testState[p.id] === 'testing' && (
                      <span className="text-yellow-600 text-xs">测试中...</span>
                    )}
                    {testState[p.id] === 'ok' && (
                      <span className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle className="w-4 h-4" /> 连通正常
                      </span>
                    )}
                    {testState[p.id] === 'fail' && (
                      <span className="flex items-center gap-1 text-red-600 text-xs">
                        <XCircle className="w-4 h-4" /> 连通失败
                      </span>
                    )}
                    {!testState[p.id] && (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleTest(p)}
                        disabled={testState[p.id] === 'testing'}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
                      >
                        <FlaskConical className="w-4 h-4" />
                        测试
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleteMut.isPending}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </div>
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

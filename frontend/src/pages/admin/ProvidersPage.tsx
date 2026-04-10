import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listProviders,
  deleteProvider,
  updateProvider,
  testProvider,
  type Provider,
} from '../../api/providers'
import { Plus, Trash2, FlaskConical, CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'

interface TestState { [id: string]: 'testing' | 'ok' | 'fail' }

export default function ProvidersPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [testState, setTestState] = useState<TestState>({})
  const [actionError, setActionError] = useState('')

  const { data: providers = [], isLoading } = useQuery({ queryKey: ['providers'], queryFn: listProviders })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['providers'] })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateProvider(id, { enabled }),
    onSuccess: invalidate,
    onError: () => setActionError('更新状态失败'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: invalidate,
    onError: () => setActionError('删除失败'),
  })

  const handleTest = async (p: Provider) => {
    setTestState((s) => ({ ...s, [p.id]: 'testing' }))
    try { const res = await testProvider(p.id); setTestState((s) => ({ ...s, [p.id]: res.ok ? 'ok' : 'fail' })) }
    catch { setTestState((s) => ({ ...s, [p.id]: 'fail' })) }
  }

  const handleDelete = (id: string) => { if (confirm('确定要删除该 Provider 吗？')) deleteMut.mutate(id) }

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider 管理</h1>
          <p className="text-sm text-gray-400 mt-1">管理云服务 Provider 配置（仅管理员可见）</p>
        </div>
        <button
          onClick={() => navigate('/admin/providers/new')}
          className="flex items-center gap-2 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-red-hover transition"
        >
          <Plus className="w-4 h-4" /> 添加 Provider
        </button>
      </div>

      {actionError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{actionError}</div>}

      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex-1">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">加载中...</div>
        ) : providers.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm">暂无 Provider</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center bg-gray-100 px-6 py-3">
              <div className="flex-1 text-xs font-medium text-gray-500">名称</div>
              <div className="w-[120px] text-xs font-medium text-gray-500">类型</div>
              <div className="w-[100px] text-xs font-medium text-gray-500">状态</div>
              <div className="w-[100px] text-xs font-medium text-gray-500">连通性</div>
              <div className="w-[120px] text-xs font-medium text-gray-500 text-right">操作</div>
            </div>
            {providers.map((p) => (
              <div key={p.id} className="flex items-center px-6 py-3.5 border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="font-mono text-[11px] text-gray-400">{p.id}</div>
                </div>
                <div className="w-[120px]">
                  <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{p.type}</span>
                </div>
                <div className="w-[100px]">
                  <button onClick={() => toggleMut.mutate({ id: p.id, enabled: !p.enabled })} disabled={toggleMut.isPending} className="flex items-center gap-1.5 text-sm">
                    {p.enabled ? <><ToggleRight className="w-5 h-5 text-emerald-500" /><span className="text-emerald-600 text-xs">已启用</span></> : <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-500 text-xs">已禁用</span></>}
                  </button>
                </div>
                <div className="w-[100px]">
                  {testState[p.id] === 'testing' && <span className="text-amber-600 text-xs">测试中...</span>}
                  {testState[p.id] === 'ok' && <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> 正常</span>}
                  {testState[p.id] === 'fail' && <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="w-3.5 h-3.5" /> 失败</span>}
                  {!testState[p.id] && <span className="text-gray-400 text-xs">—</span>}
                </div>
                <div className="w-[120px] flex items-center justify-end gap-3">
                  <button onClick={() => handleTest(p)} disabled={testState[p.id] === 'testing'} className="flex items-center gap-1 text-xs text-brand-red hover:text-brand-red-hover transition disabled:opacity-50">
                    <FlaskConical className="w-3.5 h-3.5" /> 测试
                  </button>
                  <button onClick={() => handleDelete(p.id)} disabled={deleteMut.isPending} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

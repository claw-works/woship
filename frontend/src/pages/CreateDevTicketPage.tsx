import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket, submitTicket } from '../api/tickets'
import { ArrowLeft } from 'lucide-react'

const stacks = [
  { value: 'go_react', label: 'Go + React' },
  { value: 'nextjs', label: 'Next.js (全栈)' },
  { value: 'vue_go', label: 'Vue + Go' },
  { value: 'python_react', label: 'Python + React' },
  { value: 'rust_react', label: 'Rust + React' },
] as const

type Stack = typeof stacks[number]['value']

export default function CreateDevTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [stack, setStack] = useState<Stack>('go_react')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buildPayload = () => ({
    project_name: projectName,
    description,
    stack,
  })

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const t = await createTicket({ type: 'dev_project', title, payload: buildPayload() }); navigate(`/tickets/${t.id}`) }
    catch { setError('保存草稿失败') } finally { setLoading(false) }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const t = await createTicket({ type: 'dev_project', title, payload: buildPayload() }); await submitTicket(t.id); navigate(`/tickets/${t.id}`) }
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
            <p className="text-sm text-gray-400 mt-1">新开发项目</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-7 space-y-5">
          <div>
            <label className={labelCls}>工单标题</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：内部 OA 审批系统" className={inputCls} />
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold text-gray-900">项目信息</h3>
            <div>
              <label className={labelCls}>项目名称</label>
              <input type="text" required value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="my-awesome-project" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>项目介绍</label>
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述你想要开发的功能和目标..."
                className={`${inputCls} resize-y`} />
            </div>
            <div>
              <label className={labelCls}>开发架构</label>
              <div className="grid grid-cols-2 gap-3">
                {stacks.map((s) => (
                  <label key={s.value}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border cursor-pointer transition ${
                      stack === s.value ? 'border-brand-red bg-red-50/50' : 'border-gray-200 hover:bg-gray-100'
                    }`}>
                    <input type="radio" name="stack" value={s.value} checked={stack === s.value}
                      onChange={() => setStack(s.value)} className="w-4 h-4 text-brand-red focus:ring-brand-red" />
                    <span className="text-sm font-medium text-gray-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</div>}

          <div className="border-t border-gray-200" />

          <div className="flex gap-3">
            <button type="button" onClick={handleSaveDraft} disabled={loading || !title || !projectName}
              className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition">
              保存草稿
            </button>
            <button type="button" onClick={handleSubmit} disabled={loading || !title || !projectName}
              className="flex-1 bg-brand-red text-white py-3 rounded-lg text-sm font-semibold hover:bg-brand-red-hover disabled:opacity-50 transition">
              {loading ? '提交中...' : '提交审批'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

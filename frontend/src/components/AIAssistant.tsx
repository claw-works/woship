import { useState } from 'react'
import { Bot, X, Send } from 'lucide-react'

export default function AIAssistant() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-7 w-[380px] h-[520px] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden z-50">
          <div className="flex items-center justify-between px-5 py-3.5 bg-brand-red">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white">Woship AI 助手</span>
            </div>
            <button onClick={() => setOpen(false)}>
              <X className="w-4.5 h-4.5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex gap-2 items-start">
              <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-50 rounded-tr-xl rounded-br-xl rounded-bl-xl px-3.5 py-2.5 text-sm text-gray-700 leading-relaxed">
                你好！我是 Woship AI 助手 🤖<br />有什么可以帮你的吗？比如创建工单、查询部署状态、或者排查问题。
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 border-t border-gray-200">
            <div className="flex-1 bg-gray-50 rounded-lg px-3.5 py-2.5">
              <input
                type="text"
                placeholder="输入消息..."
                className="w-full bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
            <button className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center hover:bg-brand-red-hover transition">
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-7 right-7 w-14 h-14 rounded-full bg-brand-red flex items-center justify-center shadow-lg hover:bg-brand-red-hover transition z-50"
      >
        <Bot className="w-7 h-7 text-white" />
      </button>
    </>
  )
}

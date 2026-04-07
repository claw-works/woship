import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { UserCircle } from 'lucide-react'

const roleLabel: Record<string, string> = {
  admin: '管理员',
  approver: '审批员',
  user: '用户',
}

export default function Layout() {
  const { user } = useAuth()

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-3 flex-shrink-0">
          <UserCircle className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{user?.name || user?.email}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {roleLabel[user?.role ?? ''] ?? user?.role}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

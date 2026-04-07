import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Server, LogOut, Ship } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isAdmin = user?.role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`

  return (
    <div className="flex flex-col h-full w-60 bg-gray-900 px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3 mb-6">
        <Ship className="w-7 h-7 text-indigo-400" />
        <span className="text-white text-xl font-bold tracking-tight">Woship</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        <NavLink to="/tickets" end={false} className={linkClass}>
          {({ isActive }) => (
            <>
              <LayoutDashboard className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              工单列表
            </>
          )}
        </NavLink>

        <NavLink to="/tickets/new" className={linkClass}>
          {({ isActive }) => (
            <>
              <PlusCircle className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              新建工单
            </>
          )}
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin/providers" className={linkClass}>
            {({ isActive }) => (
              <>
                <Server className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                Provider 管理
              </>
            )}
          </NavLink>
        )}
      </nav>

      {/* Bottom: logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        <LogOut className="w-4 h-4 text-gray-400" />
        退出登录
      </button>
    </div>
  )
}

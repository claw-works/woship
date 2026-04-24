import { NavLink, useNavigate } from 'react-router-dom'
import { Gauge, List, Server, LogOut, Ship, PanelLeftOpen, Box } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  { to: '/dashboard', icon: Gauge, label: 'Dashboard' },
  { to: '/tickets', icon: List, label: '工单列表' },
  { to: '/resources', icon: Box, label: '资源列表' },
]

const adminItems = [
  { to: '/admin/providers', icon: Server, label: 'Provider 管理' },
]

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-16 h-full bg-gray-50 border-r border-gray-200 py-5">
        <div className="w-12 h-12 flex items-center justify-center">
          <Ship className="w-6 h-6 text-brand-red" />
        </div>
        <nav className="flex-1 flex flex-col items-center gap-1 pt-6 w-full px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'bg-brand-red text-white' : 'text-gray-400 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
            </NavLink>
          ))}
          {isAdmin && adminItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'bg-brand-red text-white' : 'text-gray-400 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1 w-full px-2">
          <button
            onClick={onToggle}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <PanelLeftOpen className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={handleLogout}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-60 h-full bg-gray-50 border-r border-gray-200 py-5 px-3">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Ship className="w-6 h-6 text-brand-red" />
        <span className="text-xl font-bold text-gray-900">Woship</span>
      </div>
      <nav className="flex-1 flex flex-col gap-1 pt-6">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-red text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-gray-400'}`} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        {isAdmin && adminItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-red text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-gray-400'}`} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 transition-colors"
      >
        <LogOut className="w-[18px] h-[18px]" />
        退出登录
      </button>
    </div>
  )
}

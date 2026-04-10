import { useNavigate } from 'react-router-dom'
import { Database, Container, Sparkles, ArrowRight } from 'lucide-react'

const types = [
  {
    icon: Database,
    title: 'Database 申请',
    desc: '申请数据库实例，支持 PostgreSQL、MySQL 等主流数据库',
    iconBg: 'bg-gray-100',
    iconColor: 'text-brand-red',
    linkColor: 'text-brand-red',
    to: '/tickets/new',
  },
  {
    icon: Container,
    title: 'Docker 应用部署',
    desc: '部署 Docker 容器应用，自动配置 EKS 集群、域名绑定与负载均衡',
    iconBg: 'bg-blue-50',
    iconColor: 'text-brand-navy',
    linkColor: 'text-brand-navy',
    to: '/tickets/new',
  },
  {
    icon: Sparkles,
    title: '新开发',
    desc: 'AI 远程编程 + 自动部署，从想法到可运行 Demo 一站式完成',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    linkColor: 'text-emerald-600',
    to: '/tickets/new',
  },
]

export default function SelectTicketTypePage() {
  const navigate = useNavigate()

  return (
    <div className="p-12 space-y-8">
      <div>
        <h1 className="text-[28px] font-bold text-gray-900">新建工单</h1>
        <p className="text-[15px] text-gray-400 mt-2">选择工单类型以开始创建</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {types.map((t) => (
          <div
            key={t.title}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition cursor-pointer"
            onClick={() => navigate(t.to)}
          >
            <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center`}>
              <t.icon className={`w-6 h-6 ${t.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
            <p className="text-[13px] text-gray-400 leading-relaxed flex-1">{t.desc}</p>
            <div className={`flex items-center gap-1.5 text-[13px] font-medium ${t.linkColor}`}>
              开始创建 <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

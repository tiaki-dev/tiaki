import { NavLink } from 'react-router'
import { LayoutDashboard, Server, Box, RefreshCw, Settings, ScrollText, ShieldCheck } from 'lucide-react'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/hosts', label: 'Hosts', icon: Server },
  { to: '/containers', label: 'Containers', icon: Box },
  { to: '/updates', label: 'Updates', icon: RefreshCw },
  { to: '/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <img src="/logo-light.svg" alt="Tiaki" className="w-8 h-8" />
        <span className="font-semibold text-lg tracking-wide">Tiaki</span>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

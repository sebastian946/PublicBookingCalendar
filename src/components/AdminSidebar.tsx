import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', href: '/admin' },
  { icon: 'group', label: 'Patients', href: '/admin/patients' },
  { icon: 'medical_services', label: 'Professionals', href: '/admin/professionals' },
  { icon: 'calendar_month', label: 'Schedule', href: '/admin/schedule' },
  { icon: 'payments', label: 'Billing', href: '/admin/billing' },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border-light bg-white flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary size-10 rounded-lg flex items-center justify-center text-white">
          <span className="material-symbols-outlined">health_and_safety</span>
        </div>
        <div>
          <h1 className="text-base font-bold leading-none">MedConsult</h1>
          <p className="text-xs text-text-secondary mt-1">Admin Office</p>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-gray-100'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border-light space-y-1">
        <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-sm font-medium">Settings</span>
        </a>
        <div className="flex items-center gap-3 px-3 py-4 mt-2">
          <div
            className="size-8 rounded-full bg-cover bg-center bg-primary/20"
          />
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold truncate">Sarah Jenkins</p>
            <p className="text-[10px] text-text-secondary truncate">sarah.j@medconsult.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

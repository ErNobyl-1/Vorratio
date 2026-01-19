import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Package, UtensilsCrossed, ShoppingCart, Settings, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n';

export default function Layout() {
  const location = useLocation();
  const { t } = useTranslation();

  // Mobile: 5 items without settings (settings moves to header)
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/inventory', icon: Package, label: t('nav.inventory') },
    { path: '/recipes', icon: UtensilsCrossed, label: t('nav.recipes') },
    { path: '/meal-plan', icon: Calendar, label: t('nav.mealPlan') },
    { path: '/shopping', icon: ShoppingCart, label: t('nav.shopping') },
  ];

  const desktopNavItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/inventory', icon: Package, label: t('nav.inventory') },
    { path: '/recipes', icon: UtensilsCrossed, label: t('nav.recipes') },
    { path: '/meal-plan', icon: Calendar, label: t('nav.mealPlan') },
    { path: '/shopping', icon: ShoppingCart, label: t('nav.shopping') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header - Mobile */}
      <header className="md:hidden flex bg-white border-b border-gray-200 px-4 py-3 items-center justify-between">
        <h1 className="text-lg font-bold text-primary-600">{t('app.name')}</h1>
        <Link
          to="/settings"
          className={cn(
            'p-2 rounded-lg transition-colors',
            location.pathname === '/settings'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          <Settings size={22} />
        </Link>
      </header>

      {/* Header - Desktop */}
      <header className="hidden md:flex bg-white border-b border-gray-200 px-6 py-4 items-center justify-between relative z-10">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-primary-600">{t('app.name')}</h1>
          <nav className="flex gap-1">
            {desktopNavItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content - no overflow-auto to avoid stacking context issues with modals */}
      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 flex justify-around safe-area-inset-bottom">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));

          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-500'
              )}
            >
              <Icon size={24} />
              <span className="text-xs">{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

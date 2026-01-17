import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import KeyboardShortcutsModal from './modals/KeyboardShortcutsModal';

const menuItems = [
    { path: '/', label: 'Satış Ekranı', icon: '🛒', permission: 'can_view_pos' },
    { path: '/products', label: 'Ürün Listesi', icon: '📦', permission: 'can_view_products' },
    { path: '/customers', label: 'Bakiyeler Listesi', icon: '👥', permission: 'can_view_customers' },
    { path: '/sales', label: 'Satış Geçmişi', icon: '📋', permission: 'can_view_sales' },
    { path: '/invoices', label: 'Gelen Faturalar(Entegrasyonlu)', icon: '📄', permission: 'can_view_invoices' },
    { path: '/settings', label: 'Ayarlar', icon: '⚙️', permission: 'can_view_users' },
    { path: '/users', label: 'Kullanıcılar', icon: '👤', permission: 'can_view_users' },
];

export default function Layout({ children }) {
    const { user, logout, hasPermission } = useAuth();
    const location = useLocation();
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);

    const visibleMenuItems = menuItems.filter(item =>
        hasPermission(item.permission)
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-6">
                    <div className="flex justify-between items-center h-16">
                        {/* Left Side: Logo */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="text-white text-xl">💰</span>
                            </div>
                            <span className="font-bold text-xl text-gray-800 tracking-tight hidden sm:block">KasaPos</span>
                        </div>

                        {/* Center: Desktop Navigation */}
                        <nav className="hidden md:flex items-center justify-center flex-1 gap-6">
                            {visibleMenuItems.map((item) => (
                                <div key={item.path} className="flex items-center gap-6">
                                    {item.path === '/settings' && (
                                        <button
                                            onClick={() => setShowShortcutsModal(true)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                            title="Klavye Kısayolları"
                                        >
                                            <span className="text-lg">⌨️</span>
                                            <span>Kısayollar</span>
                                        </button>
                                    )}
                                    <Link
                                        to={item.path}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 text-sm font-medium
                                            ${location.pathname === item.path
                                                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50'
                                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                </div>
                            ))}
                        </nav>

                        {/* Right Side: User Info */}
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 hidden sm:block">
                                <span className="font-semibold text-gray-800">{user?.username}</span>
                                <span className="ml-2 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                                    {user?.role === 'kurucu' ? 'Kurucu' : 'Çalışan'}
                                </span>
                            </span>

                            {/* Company Code Badge */}
                            {user?.company_code && (
                                <div className="hidden md:flex flex-col items-end mr-2">
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Şirket Kodu</span>
                                    <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                        {user.company_code}
                                    </span>
                                </div>
                            )}

                            <div className="h-8 w-px bg-gray-200 hidden sm:block mx-1"></div>
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group"
                                title="Çıkış Yap"
                            >
                                <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span className="hidden lg:inline text-sm font-medium">Çıkış</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 pb-20 md:pb-6 pt-4 px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto w-full">
                {children}
            </main>

            {showShortcutsModal && (
                <KeyboardShortcutsModal
                    onClose={() => setShowShortcutsModal(false)}
                    onSave={(newShortcuts) => {
                        window.dispatchEvent(new CustomEvent('shortcuts-updated', { detail: newShortcuts }));
                    }}
                />
            )}

            {/* Bottom Navigation (Mobile Only) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 pb-safe">
                <div className="grid grid-cols-5 gap-1 px-2 py-2">
                    {visibleMenuItems.slice(0, 5).map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center py-2 rounded-xl transition-colors ${location.pathname === item.path
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}

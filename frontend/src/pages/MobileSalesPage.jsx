import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { salesAPI } from '../services/api';

export default function MobileSalesPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        try {
            const response = await salesAPI.getAll();
            setSales(response.data?.sales || []);
        } catch (error) {
            console.error('Satışlar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(s => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm ||
            s.sale_code?.toLowerCase().includes(searchLower) ||
            s.customer_name?.toLowerCase().includes(searchLower);
    });

    // Today's sales
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === today);
    const todayTotal = todaySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 pb-20">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10 px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                    <Link to="/mobile-pos" className="text-2xl">←</Link>
                    <h1 className="text-xl font-bold text-gray-800">Satış Geçmişi</h1>
                    <span className="ml-auto bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-semibold">
                        {sales.length}
                    </span>
                </div>

                {/* Today Summary */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 mb-3 text-white">
                    <p className="text-sm opacity-80">Bugünkü Satışlar</p>
                    <div className="flex justify-between items-end">
                        <p className="text-2xl font-bold">{todayTotal.toFixed(2)} TL</p>
                        <p className="text-sm">{todaySales.length} satış</p>
                    </div>
                </div>

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Satış kodu veya müşteri ara..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
            </header>

            {/* Sales List */}
            <div className="p-4 space-y-3">
                {filteredSales.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Satış bulunamadı.</div>
                ) : (
                    filteredSales.map(sale => (
                        <div
                            key={sale.id || sale.sale_code}
                            className="bg-white rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-semibold text-gray-800">{sale.sale_code}</h3>
                                    <p className="text-sm text-gray-500">{sale.customer_name || 'Toptan Satış'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-green-600">{parseFloat(sale.total || 0).toFixed(2)} TL</p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${sale.payment_method === 'Nakit' ? 'bg-green-100 text-green-700' :
                                            sale.payment_method === 'POS' ? 'bg-blue-100 text-blue-700' :
                                                'bg-orange-100 text-orange-700'
                                        }`}>
                                        {sale.payment_method || 'Nakit'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>{formatDate(sale.created_at)}</span>
                                <span>{sale.items?.length || 0} ürün</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-3">
                <Link to="/mobile-pos" className="flex flex-col items-center text-gray-600">
                    <span className="text-xl">🛒</span>
                    <span className="text-xs">Satış</span>
                </Link>
                <Link to="/mobile-products" className="flex flex-col items-center text-gray-600">
                    <span className="text-xl">📦</span>
                    <span className="text-xs">Ürünler</span>
                </Link>
                <Link to="/mobile-customers" className="flex flex-col items-center text-gray-600">
                    <span className="text-xl">👥</span>
                    <span className="text-xs">Bakiyeler</span>
                </Link>
                <Link to="/mobile-sales" className="flex flex-col items-center text-blue-600">
                    <span className="text-xl">📋</span>
                    <span className="text-xs font-bold">Satışlar</span>
                </Link>
            </div>
        </div>
    );
}

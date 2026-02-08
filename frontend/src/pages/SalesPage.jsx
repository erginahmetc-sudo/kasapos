import { useState, useEffect } from 'react';
import { salesAPI } from '../services/api';

export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange.start) params.start_date = dateRange.start;
            if (dateRange.end) params.end_date = dateRange.end;

            const res = await salesAPI.getAll(params);
            setSales(res.data?.sales || []);
        } catch (error) {
            console.error('Satışlar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (type, value) => {
        setDateRange(prev => ({ ...prev, [type]: value }));
        // Optional: Auto-reload or wait for button click. Let's add a filter button.
    };

    const filteredSales = sales.filter(sale => {
        const term = searchTerm.toLowerCase();
        return (
            sale.sale_code?.toLowerCase().includes(term) ||
            sale.customerName?.toLowerCase().includes(term) ||
            sale.customer?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="min-h-screen bg-slate-50 font-display">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Actions */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Satış Geçmişi</h1>
                        <p className="text-slate-500 mt-1">Yapılan tüm satış işlemleri ve detayları</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Satış No veya Müşteri Ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full md:w-64"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => handleDateChange('start', e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => handleDateChange('end', e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                                onClick={loadSales}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">filter_list</span>
                                Filtrele
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sales Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredSales.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">receipt_long</span>
                            <p>Kayıtlı satış bulunamadı.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Tarih</th>
                                        <th className="px-6 py-4">Satış No</th>
                                        <th className="px-6 py-4">Müşteri</th>
                                        <th className="px-6 py-4">Ödeme Tipi</th>
                                        <th className="px-6 py-4 text-right">Tutar</th>
                                        <th className="px-6 py-4 text-center">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {new Date(sale.date).toLocaleString('tr-TR')}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {sale.sale_code}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {sale.customerName || sale.customer || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sale.payment_method === 'Nakit' ? 'bg-emerald-100 text-emerald-800' :
                                                        sale.payment_method === 'Kredi Kartı' || sale.payment_method === 'POS' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {sale.payment_method === 'POS' ? 'Kredi Kartı' : sale.payment_method}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                                                ₺{sale.total?.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => alert(`Detaylar: ${JSON.stringify(sale.items, null, 2)}`)} // Placeholder for detail view
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                                >
                                                    Detay
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

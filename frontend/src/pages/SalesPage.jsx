import { useState, useEffect, useMemo } from 'react';
import { salesAPI } from '../services/api';

export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);

    // Default Date: Last 7 Days
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });

    // Filters
    const [filters, setFilters] = useState({
        searchTerm: '', // General search (sale code, customer)
        stockCode: '',
        productName: '',
        barcode: '',
        minPrice: '',
        maxPrice: ''
    });

    useEffect(() => {
        loadSales();
    }, []); // Initial load (could depend on dateRange if we want server-side date filtering auto-trigger)

    const loadSales = async () => {
        setLoading(true);
        try {
            // Fetch all sales or filter by date on server side?
            // API supports start_date and end_date. Let's use them to not fetch ALL history.
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

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    // Advanced Filtering Logic
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            // 1. General Search (Sale Code, Customer Name)
            const term = filters.searchTerm.toLowerCase();
            const matchesGeneral = !term ||
                sale.sale_code?.toLowerCase().includes(term) ||
                sale.customerName?.toLowerCase().includes(term) ||
                sale.customer?.toLowerCase().includes(term);

            if (!matchesGeneral) return false;

            // 2. Price Range
            const total = sale.total || 0;
            if (filters.minPrice && total < parseFloat(filters.minPrice)) return false;
            if (filters.maxPrice && total > parseFloat(filters.maxPrice)) return false;

            // 3. Item Level Filters (Stock Code, Product Name, Barcode)
            // If any of these are set, we need to check items.
            // If items are missing (e.g. old data), strict filtering might exclude them.
            // We'll perform specific checks if inputs are present.

            const hasItemFilters = filters.stockCode || filters.productName || filters.barcode;

            if (hasItemFilters) {
                // Check if ANY item in the sale matches ALL active item filters
                const items = sale.items || []; // items is an array of objects
                if (items.length === 0) return false;

                const matchesItemCriteria = items.some(item => {
                    let match = true;
                    if (filters.stockCode && !item.stock_code?.toLowerCase().includes(filters.stockCode.toLowerCase())) match = false;
                    if (filters.productName && !item.name?.toLowerCase().includes(filters.productName.toLowerCase())) match = false;
                    if (filters.barcode && !item.barcode?.toLowerCase().includes(filters.barcode.toLowerCase())) match = false;
                    return match;
                });

                if (!matchesItemCriteria) return false;
            }

            return true;
        });
    }, [sales, filters]);

    // Calculate Totals for Filtered Results
    const totalRevenue = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0), [filteredSales]);
    const totalSalesCount = filteredSales.length;

    return (
        <div className="h-screen flex flex-row overflow-hidden bg-slate-50 font-display">
            {/* Sidebar Filters */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl shadow-slate-200/50 flex-none h-full overflow-y-auto">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">filter_alt</span>
                        Filtreleme
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Satış geçmişini detaylı sorgula</p>
                </div>

                <div className="p-5 space-y-5">
                    {/* Date Range */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tarih Aralığı</label>
                        <div className="space-y-2">
                            <input
                                type="date"
                                name="start"
                                value={dateRange.start}
                                onChange={handleDateChange}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            <input
                                type="date"
                                name="end"
                                value={dateRange.end}
                                onChange={handleDateChange}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={loadSales}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">sync</span>
                            Uygula & Yenile
                        </button>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* General Search */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Genel Arama</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                type="text"
                                name="searchTerm"
                                value={filters.searchTerm}
                                onChange={handleFilterChange}
                                placeholder="Satış No, Müşteri..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ürün Detayları</label>
                        <input
                            type="text"
                            name="productName"
                            value={filters.productName}
                            onChange={handleFilterChange}
                            placeholder="Ürün Adı"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="text"
                            name="stockCode"
                            value={filters.stockCode}
                            onChange={handleFilterChange}
                            placeholder="Stok Kodu"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="text"
                            name="barcode"
                            value={filters.barcode}
                            onChange={handleFilterChange}
                            placeholder="Barkod"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Price Range */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fiyat Aralığı (TL)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                name="minPrice"
                                value={filters.minPrice}
                                onChange={handleFilterChange}
                                placeholder="Min"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="number"
                                name="maxPrice"
                                value={filters.maxPrice}
                                onChange={handleFilterChange}
                                placeholder="Max"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content: Sales Table */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header Stats */}
                <header className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between flex-none">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Satışlar</h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            <span className="font-bold text-slate-900">{totalSalesCount}</span> işlem bulundu
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">TOPLAM CİRO</p>
                        <p className="text-2xl font-extrabold text-emerald-600">₺{totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </header>

                {/* Table Container */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                        {loading ? (
                            <div className="h-96 flex items-center justify-center">
                                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : filteredSales.length === 0 ? (
                            <div className="h-96 flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-30">filter_list_off</span>
                                <p>Filtrelere uygun satış bulunamadı.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Tarih</th>
                                        <th className="px-6 py-4">Satış No</th>
                                        <th className="px-6 py-4">Müşteri</th>
                                        <th className="px-6 py-4">Ödeme Tipi</th>
                                        <th className="px-6 py-4">Ürünler</th>
                                        <th className="px-6 py-4 text-right">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                {new Date(sale.date).toLocaleString('tr-TR')}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900 font-mono">
                                                {sale.sale_code}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {sale.customerName || sale.customer || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sale.payment_method === 'Nakit' ? 'bg-emerald-100 text-emerald-800' :
                                                        (sale.payment_method === 'Kredi Kartı' || sale.payment_method === 'POS') ? 'bg-blue-100 text-blue-800' :
                                                            'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {sale.payment_method === 'POS' ? 'Kredi Kartı' : sale.payment_method}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                                                {sale.items && sale.items.length > 0
                                                    ? sale.items.map(i => `${i.name} x${i.quantity}`).join(', ')
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right whitespace-nowrap">
                                                ₺{sale.total?.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

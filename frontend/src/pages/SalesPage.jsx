import { useState, useEffect, useCallback } from 'react';
import { salesAPI, customersAPI, productsAPI } from '../services/api';
import SaleDetailModal from '../components/modals/SaleDetailModal';

export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [customers, setCustomers] = useState([]);

    // Filter states
    const [filters, setFilters] = useState({
        saleCode: '',
        customerName: '',
        product: '',
        barcode: '',
        startDate: '',
        endDate: '',
        showDeleted: false
    });

    // Sort state
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    useEffect(() => {
        // Set default date range to last 30 days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        setFilters(prev => ({
            ...prev,
            endDate: end.toISOString().split('T')[0],
            startDate: start.toISOString().split('T')[0]
        }));

        // Load visibility settings
        const savedShowSales = localStorage.getItem('sales_show_total_sales');
        if (savedShowSales !== null) {
            setShowTotalSales(savedShowSales === 'true');
        }

        const savedShowRevenue = localStorage.getItem('sales_show_total_revenue');
        if (savedShowRevenue !== null) {
            setShowTotalRevenue(savedShowRevenue === 'true');
        }
    }, []);

    // Visibility states
    const [showTotalSales, setShowTotalSales] = useState(true);
    const [showTotalRevenue, setShowTotalRevenue] = useState(true);

    useEffect(() => {
        if (filters.startDate && filters.endDate) {
            loadSales();
        }
    }, [filters.startDate, filters.endDate, filters.showDeleted, filters.customerName, filters.saleCode]);

    const loadSales = async () => {
        setLoading(true);
        try {
            const params = {
                start_date: filters.startDate,
                end_date: filters.endDate,
                show_deleted: filters.showDeleted
            };
            if (filters.saleCode) params.sale_code = filters.saleCode;
            if (filters.customerName) params.customer_name = filters.customerName;
            if (filters.product || filters.barcode) params.search_term = filters.product || filters.barcode;

            const response = await salesAPI.getAll(params);
            setSales(response.data?.sales || []);
        } catch (error) {
            console.error('Satışlar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        try {
            const response = await customersAPI.getAll();
            setCustomers(response.data?.customers || []);
        } catch (error) {
            console.error('Müşteriler yüklenirken hata:', error);
        }
    };

    const openCustomerModal = async () => {
        await loadCustomers();
        setCustomerSearch('');
        setShowCustomerModal(true);
    };

    const selectCustomer = (customer) => {
        setFilters(prev => ({ ...prev, customerName: customer.name }));
        setShowCustomerModal(false);
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    // Normalize Turkish characters for sorting
    const normalizeText = (text) => {
        if (typeof text !== 'string') return '';
        return text.toLowerCase();
    };

    // Sort sales
    const getSortedSales = () => {
        const sorted = [...sales].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'total') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            if (sortConfig.key === 'date') {
                valA = new Date(valA || 0);
                valB = new Date(valB || 0);
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            const comparison = normalizeText(valA).localeCompare(normalizeText(valB), 'tr');
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
        return sorted;
    };

    const sortedSales = getSortedSales();

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const clearFilters = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        setFilters({
            saleCode: '',
            customerName: '',
            product: '',
            barcode: '',
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            showDeleted: false
        });
    };

    const openDetailModal = (sale) => {
        setSelectedSale(sale);
        setShowDetailModal(true);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalSales = sortedSales.reduce((sum, s) => sum + (s.total || 0), 0);

    return (
        <div className="flex h-[calc(100vh-64px)] transition-all duration-300 overflow-hidden">
            {/* Sidebar Overlay (Mobile) */}
            {filterOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setFilterOpen(false)}
                />
            )}

            {/* Filter Sidebar - Modern Design */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-72 bg-white border-r border-gray-200 overflow-y-auto
                transform transition-transform duration-300 flex flex-col
                ${filterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Sidebar Header */}
                <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Filtreler</h3>
                            <p className="text-white/70 text-xs">Satis arama kriterleri</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4 flex-1">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Satis Kodu</label>
                        <input
                            type="text"
                            value={filters.saleCode}
                            onChange={(e) => setFilters({ ...filters, saleCode: e.target.value })}
                            placeholder="Satis kodu..."
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1 flex justify-between items-center">
                            <span>Musteri Adi</span>
                            <button
                                onClick={openCustomerModal}
                                className="px-2 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-xs font-medium"
                                title="Müşteri Listesinden Seç"
                            >
                                + Listeden Sec
                            </button>
                        </label>
                        <input
                            type="text"
                            value={filters.customerName}
                            onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
                            placeholder="Musteri adi..."
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Urun/Stok</label>
                        <input
                            type="text"
                            value={filters.product}
                            onChange={(e) => setFilters({ ...filters, product: e.target.value })}
                            placeholder="Urun, stok kodu..."
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Barkod</label>
                        <input
                            type="text"
                            value={filters.barcode}
                            onChange={(e) => setFilters({ ...filters, barcode: e.target.value })}
                            placeholder="Barkod..."
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Tarih Araligi</label>
                        <div className="space-y-2">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <input
                            type="checkbox"
                            id="showDeleted"
                            checked={filters.showDeleted}
                            onChange={(e) => setFilters({ ...filters, showDeleted: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="showDeleted" className="text-sm text-gray-600">Silinen Satışları Göster</label>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-200 space-y-2">
                    <button
                        onClick={loadSales}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Filtrele
                    </button>
                    <button
                        onClick={clearFilters}
                        className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Temizle
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-5 overflow-y-auto bg-gray-50">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setFilterOpen(true)}
                            className="lg:hidden p-2 bg-white rounded-lg hover:bg-gray-100 shadow-sm"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Satis Raporu</h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {sortedSales.length} satis, toplam ₺{totalSales.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards - Square Corners */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-4 text-white shadow-lg shadow-blue-500/20 text-center">
                        <p className="text-blue-100 text-sm">Toplam Satis</p>
                        <p className="text-2xl font-bold">
                            {showTotalSales ? sortedSales.length : '******'}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg p-4 text-white shadow-lg shadow-emerald-500/20 text-center">
                        <p className="text-emerald-100 text-sm">Toplam Ciro</p>
                        <p className="text-2xl font-bold">
                            {showTotalRevenue ? `₺${totalSales.toLocaleString('tr-TR')}` : '******'}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-4 text-white shadow-lg shadow-amber-500/20 text-center">
                        <p className="text-amber-100 text-sm">Nakit</p>
                        <p className="text-2xl font-bold">
                            {sortedSales.filter((s) => s.payment_method === 'Nakit').length}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-4 text-white shadow-lg shadow-purple-500/20 text-center">
                        <p className="text-purple-100 text-sm">Kart</p>
                        <p className="text-2xl font-bold">
                            {sortedSales.filter((s) => s.payment_method === 'POS').length}
                        </p>
                    </div>
                </div>

                {/* Sales Table - Square Corners */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th
                                            onClick={() => handleSort('sale_code')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                        >
                                            Satis Kodu {getSortIcon('sale_code')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('customer')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                        >
                                            Musteri Adi {getSortIcon('customer')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('date')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                        >
                                            Tarih {getSortIcon('date')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('total')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                        >
                                            Toplam Fiyat {getSortIcon('total')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Aciklama
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                            Islemler
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sortedSales.map((sale) => (
                                        <tr
                                            key={sale.sale_code}
                                            className={`hover:bg-gray-50 transition-colors ${sale.is_deleted ? 'opacity-50 line-through bg-red-50' : ''}`}
                                        >
                                            <td className="px-4 py-3 font-mono text-sm text-blue-600">{sale.sale_code}</td>
                                            <td className="px-4 py-3 text-gray-800">{sale.customer}</td>
                                            <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">{formatDate(sale.date)}</td>
                                            <td className="px-4 py-3 font-semibold text-gray-800">₺{sale.total?.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-gray-500 text-sm max-w-xs truncate" title={sale.description}>
                                                {sale.description || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => openDetailModal(sale)}
                                                    className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md font-medium"
                                                >
                                                    Detay
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {sortedSales.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-500">Satis bulunamadi.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Customer Select Modal - Modern Design */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header with Gradient */}
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-6 py-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Musteri Sec</h3>
                                        <p className="text-white/80 text-sm">{customers.length} kayitli musteri</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCustomerModal(false)}
                                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-all"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="mt-4 relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    placeholder="Musteri ara..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg border border-white/30 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
                            {filteredCustomers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-500">Musteri bulunamadi</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredCustomers.map((customer) => (
                                        <div
                                            key={customer.id || customer.name}
                                            onClick={() => selectCustomer(customer)}
                                            className="bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden group"
                                        >
                                            <div className="p-4 flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                                    <span className="text-white font-bold text-lg">
                                                        {customer.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600 transition-colors">
                                                        {customer.name}
                                                    </h4>
                                                    {customer.phone && (
                                                        <p className="text-sm text-gray-500">{customer.phone}</p>
                                                    )}
                                                </div>
                                                <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80">
                            <button
                                onClick={() => setShowCustomerModal(false)}
                                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sale Detail Modal */}
            {showDetailModal && selectedSale && (
                <SaleDetailModal
                    sale={selectedSale}
                    onClose={() => setShowDetailModal(false)}
                    onUpdate={() => {
                        loadSales();
                        setShowDetailModal(false);
                    }}
                    onDelete={() => {
                        loadSales();
                        setShowDetailModal(false);
                    }}
                />
            )}
        </div>
    );
}

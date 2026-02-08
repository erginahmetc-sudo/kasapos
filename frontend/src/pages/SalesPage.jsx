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
        searchTerm: '',
        stockCode: '',
        productName: '',
        barcode: '',
        minPrice: '',
        maxPrice: ''
    });

    // Modal State
    const [selectedSale, setSelectedSale] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);

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

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    // Open Modal
    const openDetailModal = (sale) => {
        setSelectedSale(sale);
        // Initialize Edit Form (Deep copy to avoid direct mutation)
        setEditForm({
            ...sale,
            items: sale.items ? JSON.parse(JSON.stringify(sale.items)) : []
        });
        setIsDetailModalOpen(true);
    };

    // Modal Actions
    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (index, field, value) => {
        setEditForm(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            // Recalculate item amount if needed (optional, simplistic)
            return { ...prev, items: newItems };
        });
    };

    const handleDeleteItem = (index) => {
        setEditForm(prev => {
            const newItems = prev.items.filter((_, i) => i !== index);
            return { ...prev, items: newItems };
        });
    };

    // Recalculate Total based on items
    const calculatedTotal = useMemo(() => {
        if (!editForm?.items) return 0;
        return editForm.items.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            return sum + (qty * price * (1 - discount / 100));
        }, 0);
    }, [editForm?.items]);

    const handleSaveSale = async () => {
        if (!window.confirm('Değişiklikleri kaydetmek istiyor musunuz?')) return;
        try {
            await salesAPI.update(editForm.sale_code, {
                items: editForm.items, // Backend expects 'items' or 'products' mapped
                total: calculatedTotal,
                payment_method: editForm.payment_method,
                customer_name: editForm.customer_name // Simple string update if name changed
            });
            alert('Satış güncellendi.');
            setIsDetailModalOpen(false);
            loadSales();
        } catch (error) {
            alert('Güncelleme hatası: ' + error.message);
        }
    };

    const handleDeleteSale = async () => {
        if (!window.confirm('Bu satışı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
        try {
            await salesAPI.delete(editForm.sale_code);
            alert('Satış silindi.');
            setIsDetailModalOpen(false);
            loadSales();
        } catch (error) {
            alert('Silme hatası: ' + error.message);
        }
    };

    // Filter Logic
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const term = filters.searchTerm.toLowerCase();
            const matchesGeneral = !term ||
                sale.sale_code?.toLowerCase().includes(term) ||
                sale.customerName?.toLowerCase().includes(term) ||
                sale.customer?.toLowerCase().includes(term);

            if (!matchesGeneral) return false;

            const total = sale.total || 0;
            if (filters.minPrice && total < parseFloat(filters.minPrice)) return false;
            if (filters.maxPrice && total > parseFloat(filters.maxPrice)) return false;

            const hasItemFilters = filters.stockCode || filters.productName || filters.barcode;
            if (hasItemFilters) {
                const items = sale.items || [];
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

    const totalRevenue = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0), [filteredSales]);

    return (
        <div className="min-h-screen flex flex-row bg-slate-50 font-display">
            {/* Fixed Sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 fixed top-0 bottom-0 left-0 overflow-y-auto z-30 shadow-xl shadow-slate-200/50">
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

            {/* Main Content - Pushed right by sidebar width */}
            <main className="flex-1 ml-80 flex flex-col min-h-screen">
                <header className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm/50 backdrop-blur-sm bg-white/90">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Satışlar</h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            <span className="font-bold text-slate-900">{filteredSales.length}</span> işlem bulundu
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">TOPLAM CİRO</p>
                        <p className="text-2xl font-extrabold text-emerald-600">₺{totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </header>

                <div className="p-6">
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
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Tarih</th>
                                        <th className="px-6 py-4">Satış No</th>
                                        <th className="px-6 py-4">Müşteri</th>
                                        <th className="px-6 py-4">Ödeme Tipi</th>
                                        <th className="px-6 py-4">Ürünler</th>
                                        <th className="px-6 py-4 text-right">Tutar</th>
                                        <th className="px-6 py-4 text-center">İşlem</th>
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
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => openDetailModal(sale)}
                                                    className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                                                >
                                                    Detay
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>

            {/* DETAIL MODAL */}
            {isDetailModalOpen && editForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Satış Detayı</h3>
                                <p className="text-sm text-slate-400 font-mono mt-0.5">{editForm.sale_code}</p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            {/* Top Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Müşteri</label>
                                    <input
                                        type="text"
                                        value={editForm.customer_name || editForm.customer || ''}
                                        onChange={(e) => handleEditChange('customer_name', e.target.value)}
                                        className="w-full font-bold text-slate-800 border-b border-slate-200 focus:border-blue-500 outline-none py-1 bg-transparent"
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ödeme Tipi</label>
                                    <select
                                        value={editForm.payment_method}
                                        onChange={(e) => handleEditChange('payment_method', e.target.value)}
                                        className="w-full font-bold text-slate-800 border-b border-slate-200 focus:border-blue-500 outline-none py-1 bg-transparent"
                                    >
                                        <option value="Nakit">NAKİT</option>
                                        <option value="POS">KREDİ KARTI</option>
                                        <option value="Açık Hesap">VERESİYE</option>
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tarih</label>
                                    <p className="font-bold text-slate-800 py-1">
                                        {new Date(editForm.date).toLocaleString('tr-TR')}
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Ürün</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-24">Adet</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-32">Fiyat</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right w-32">Tutar</th>
                                            <th className="px-4 py-3 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {editForm.items.map((item, idx) => (
                                            <tr key={idx} className="group hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                                    <p className="text-xs text-slate-400 font-mono">{item.stock_code}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        className="w-16 text-center border rounded py-1 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                                        className="w-20 text-center border rounded py-1 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                    {(item.quantity * item.price * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleDeleteItem(idx)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {editForm.items.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">Ürün bulunamadı</div>
                                )}
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-72">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-500">Tutar</span>
                                        <span className="text-sm font-bold text-slate-800">₺{calculatedTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="h-px bg-slate-100 my-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-bold text-slate-800">GENEL TOPLAM</span>
                                        <span className="text-xl font-black text-emerald-600">₺{calculatedTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <button
                                onClick={handleDeleteSale}
                                className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl font-bold transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">delete_forever</span>
                                Satışı Sil
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 font-bold rounded-xl transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSaveSale}
                                    className="px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30 rounded-xl font-bold transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">save</span>
                                    Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

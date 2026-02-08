import { useState, useEffect, useMemo } from 'react';
import { salesAPI, productsAPI } from '../services/api';

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

    // Product Search Modal State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [allProducts, setAllProducts] = useState([]); // Lazy load
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productModalLoading, setProductModalLoading] = useState(false);
    const [tempQty, setTempQty] = useState(1);
    const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

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
        // Ensure items have vat_rate and UI flags
        const items = sale.items ? JSON.parse(JSON.stringify(sale.items)) : [];
        const enrichedItems = items.map(item => ({
            ...item,
            vat_rate: item.vat_rate !== undefined ? item.vat_rate : 20, // Default to 20% if missing
            is_vat_inc: true // Default UI toggle to "Included"
        }));

        setEditForm({
            ...sale,
            items: enrichedItems
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

    // Product Modal Helpers
    const openProductModal = async () => {
        setIsProductModalOpen(true);
        setProductSearchTerm('');
        setSelectedProductToAdd(null);
        setTempQty(1);

        if (allProducts.length === 0) {
            setProductModalLoading(true);
            try {
                const res = await productsAPI.getAll();
                setAllProducts(res.data?.products || []);
            } catch (error) {
                console.error("Ürünler yüklenirken hata:", error);
            } finally {
                setProductModalLoading(false);
            }
        }
    };

    const handleAddProductToSale = () => {
        if (!selectedProductToAdd) return;

        const newItem = {
            id: selectedProductToAdd.id,
            stock_code: selectedProductToAdd.stock_code,
            name: selectedProductToAdd.name,
            quantity: parseFloat(tempQty) || 1,
            price: parseFloat(selectedProductToAdd.price) || 0, // Default is Gross
            vat_rate: selectedProductToAdd.vat_rate !== undefined ? selectedProductToAdd.vat_rate : 20, // Default 20
            is_vat_inc: true // Default Included
        };

        setEditForm(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setIsProductModalOpen(false);
    };

    const filteredProductsForModal = useMemo(() => {
        if (!productSearchTerm) return allProducts;
        const lowerTerm = productSearchTerm.toLowerCase();
        return allProducts.filter(p =>
            p.name?.toLowerCase().includes(lowerTerm) ||
            p.stock_code?.toLowerCase().includes(lowerTerm) ||
            p.barcode?.toLowerCase().includes(lowerTerm)
        ).slice(0, 20); // Limit results
    }, [allProducts, productSearchTerm]);

    // Recalculate Total based on items (with VAT logic)
    const totals = useMemo(() => {
        if (!editForm?.items) return { net: 0, vat: 0, grand: 0, breakdown: {} };

        let netTotal = 0;
        let vatTotal = 0;
        const breakdown = {};

        editForm.items.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const rawPrice = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;

            let unitGross, unitNet;
            if (item.is_vat_inc) {
                unitGross = rawPrice;
                unitNet = unitGross / (1 + rate / 100);
            } else {
                unitNet = rawPrice;
                unitGross = unitNet * (1 + rate / 100);
            }

            const lineGross = unitGross * qty * (1 - discount / 100);
            const lineNet = unitNet * qty * (1 - discount / 100);
            const lineVat = lineGross - lineNet;

            netTotal += lineNet;
            vatTotal += lineVat;

            if (!breakdown[rate]) breakdown[rate] = 0;
            breakdown[rate] += lineVat;
        });

        return {
            net: netTotal,
            vat: vatTotal,
            grand: netTotal + vatTotal,
            breakdown
        };
    }, [editForm?.items]);

    const handleSaveSale = async () => {
        if (!window.confirm('Değişiklikleri kaydetmek istiyor musunuz?')) return;
        try {
            await salesAPI.update(editForm.sale_code, {
                items: editForm.items, // Backend expects 'items' or 'products' mapped
                total: totals.grand,
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
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ödeme Tipi</label>
                                    <div className="font-bold text-slate-600 py-1">
                                        {editForm.payment_method === 'POS' ? 'KREDİ KARTI' : editForm.payment_method}
                                    </div>
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
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-20">Adet</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-28">Birim Fiyat</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right w-28">Tutar</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-center w-24">KDV Oranı</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-center w-28">KDV Dahil?</th>
                                            <th className="px-4 py-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {editForm.items.map((item, idx) => {
                                            const itemVatRate = parseFloat(item.vat_rate) || 0;
                                            const itemPrice = parseFloat(item.price) || 0;
                                            // Handle display price based on toggle
                                            // If Included: Show itemPrice (Gross)
                                            // If Excluded: Show itemPrice / (1+rate) (Net)
                                            const displayPrice = item.is_vat_inc
                                                ? itemPrice
                                                : (itemPrice / (1 + itemVatRate / 100));

                                            return (
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
                                                            className="w-16 text-center border rounded py-1 text-sm font-bold text-red-600 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={Number(displayPrice).toFixed(2)}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                let newGrossPrice = val;
                                                                if (!item.is_vat_inc) {
                                                                    // User entered Net, convert to Gross for storage
                                                                    newGrossPrice = val * (1 + itemVatRate / 100);
                                                                }
                                                                handleItemChange(idx, 'price', newGrossPrice);
                                                            }}
                                                            className="w-24 text-center border rounded py-1 text-sm font-bold text-red-600 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-red-600">
                                                        {(item.quantity * item.price * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={item.vat_rate}
                                                            onChange={(e) => handleItemChange(idx, 'vat_rate', e.target.value)}
                                                            className="w-16 text-center border rounded py-1 text-xs text-slate-500 font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleItemChange(idx, 'is_vat_inc', !item.is_vat_inc)}
                                                            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${item.is_vat_inc ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                                        >
                                                            {item.is_vat_inc ? 'EVET' : 'HAYIR'}
                                                        </button>
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {editForm.items.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">Ürün bulunamadı</div>
                                )}
                            </div>

                            {/* Totals */}
                            {/* Totals with VAT Breakdown */}
                            <div className="flex justify-end gap-6 items-start">
                                {/* VAT Breakdown */}
                                <div className="text-right space-y-1.5 py-2">
                                    <div className="text-xs text-slate-400">
                                        Toplam KDV: <span className="font-bold text-slate-600">₺{totals.vat.toFixed(2)}</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        KDV'siz Toplam: <span className="font-bold text-slate-600">₺{totals.net.toFixed(2)}</span>
                                    </div>
                                    {Object.entries(totals.breakdown).map(([rate, amount]) => (
                                        amount > 0 && (
                                            <div key={rate} className="text-[10px] text-slate-400">
                                                %{rate} KDV: <span className="text-slate-500">₺{amount.toFixed(2)}</span>
                                            </div>
                                        )
                                    ))}
                                </div>

                                {/* Grand Total Box */}
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-72">
                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-bold text-slate-800">GENEL TOPLAM</span>
                                        <span className="text-2xl font-black text-emerald-600">₺{totals.grand.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDeleteSale}
                                    className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl font-bold transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">delete_forever</span>
                                    Satışı Sil
                                </button>
                                <button
                                    onClick={openProductModal}
                                    className="px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl font-bold transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">add_shopping_cart</span>
                                    Yeni Ürün Ekle
                                </button>
                            </div>
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
            {/* PRODUCT SEARCH MODAL */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">Ürün Ara & Ekle</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Search Input */}
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                <input
                                    type="text"
                                    value={productSearchTerm}
                                    onChange={(e) => setProductSearchTerm(e.target.value)}
                                    placeholder="Ürün adı, barkod veya stok kodu..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    autoFocus
                                />
                            </div>

                            {/* Product List */}
                            <div className="h-64 overflow-y-auto border border-slate-100 rounded-xl">
                                {productModalLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="spinner"></div>
                                    </div>
                                ) : filteredProductsForModal.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <span className="material-symbols-outlined text-3xl mb-2">inventory_2</span>
                                        <p>Ürün bulunamadı</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {filteredProductsForModal.map(product => (
                                            <div
                                                key={product.stock_code}
                                                onClick={() => setSelectedProductToAdd(product)}
                                                className={`p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors ${selectedProductToAdd?.stock_code === product.stock_code ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}
                                            >
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                                        <span>{product.stock_code}</span>
                                                        {product.barcode && <span>• {product.barcode}</span>}
                                                    </div>
                                                </div>
                                                <div className="font-bold text-slate-800">
                                                    ₺{parseFloat(product.price).toFixed(2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quantity & Action */}
                            <div className="flex items-end gap-4 pt-2">
                                <div className="w-24">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Miktar</label>
                                    <input
                                        type="number"
                                        value={tempQty}
                                        onChange={(e) => setTempQty(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                        min="1"
                                    />
                                </div>
                                <button
                                    onClick={handleAddProductToSale}
                                    disabled={!selectedProductToAdd}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
                                >
                                    Listeye Ekle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

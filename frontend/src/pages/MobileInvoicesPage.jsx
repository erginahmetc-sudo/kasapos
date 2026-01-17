import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { invoicesAPI, productsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MobileInvoicesPage() {
    const { logout } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Tümü');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    // Price Check Modal States
    const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
    const [priceCheckProduct, setPriceCheckProduct] = useState(null);
    const [priceCheckSearch, setPriceCheckSearch] = useState('');
    const [showPriceCheckScanner, setShowPriceCheckScanner] = useState(false);
    const priceCheckScannerRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [invRes, prodRes] = await Promise.all([
                invoicesAPI.getAll(),
                productsAPI.getAll()
            ]);
            setInvoices(invRes.data?.invoices || []);
            setProducts(prodRes.data?.products || []);
        } catch (error) {
            console.error('Veri yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const syncInvoices = async () => {
        setSyncing(true);
        try {
            const savedConfig = localStorage.getItem('birfatura_config');
            if (!savedConfig) {
                alert('API ayarları eksik. Lütfen ayarlardan BirFatura entegrasyonunu kontrol edin.');
                setSyncing(false);
                return;
            }
            // Simplified sync - in production this would call the API
            alert('Senkronizasyon başlatıldı...');
            await loadData();
        } catch (error) {
            alert('Senkronizasyon hatası: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    const statuses = ['Tümü', 'Bekliyor', 'İşlendi', 'İşlenmeyecek'];

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = !searchTerm ||
            inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'Tümü' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Bekliyor': return 'bg-amber-100 text-amber-700';
            case 'İşlendi': return 'bg-green-100 text-green-700';
            case 'İşlenmeyecek': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Stats
    const stats = {
        total: invoices.length,
        pending: invoices.filter(i => i.status === 'Bekliyor').length,
        processed: invoices.filter(i => i.status === 'İşlendi').length,
        totalAmount: invoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0)
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 pb-24">
            {/* Header */}
            <header className="bg-gradient-to-r from-violet-600 to-purple-600 text-white sticky top-0 z-20 px-4 py-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <Link to="/mobile-pos" className="text-2xl">←</Link>
                        <div>
                            <h1 className="text-lg font-bold">📄 Gelen Faturalar</h1>
                            <p className="text-violet-200 text-xs">{stats.total} fatura</p>
                        </div>
                    </div>
                    <button
                        onClick={syncInvoices}
                        disabled={syncing}
                        className="px-3 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {syncing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : '🔄'}
                        {syncing ? '' : 'Senkronize'}
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Fatura no veya tedarikçi ara..."
                    className="w-full px-4 py-2.5 bg-white/20 placeholder-violet-200 text-white rounded-xl focus:outline-none focus:bg-white/30"
                />
            </header>

            {/* Stats Cards */}
            <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-600">Bekleyen</p>
                    <p className="text-xl font-bold text-amber-700">{stats.pending}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600">İşlendi</p>
                    <p className="text-xl font-bold text-green-700">{stats.processed}</p>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-violet-600">Toplam</p>
                    <p className="text-lg font-bold text-violet-700">₺{stats.totalAmount.toLocaleString('tr-TR')}</p>
                </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {statuses.map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors
                            ${statusFilter === status
                                ? 'bg-violet-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-200'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Invoice List */}
            <div className="px-4 py-2 space-y-3">
                {filteredInvoices.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        {invoices.length === 0 ? 'Fatura bulunamadı.' : 'Arama sonucu bulunamadı.'}
                    </div>
                ) : (
                    filteredInvoices.map((invoice, index) => (
                        <div
                            key={invoice.id || index}
                            onClick={() => { setSelectedInvoice(invoice); setShowDetail(true); }}
                            className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{invoice.supplier_name || 'Bilinmeyen Tedarikçi'}</h3>
                                    <p className="text-sm text-violet-600 font-mono">{invoice.invoice_number || '-'}</p>
                                </div>
                                <div className="text-right ml-3">
                                    <p className="text-lg font-bold text-emerald-600">
                                        ₺{parseFloat(invoice.total || 0).toLocaleString('tr-TR')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">{formatDate(invoice.date)}</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(invoice.status)}`}>
                                    {invoice.status || 'Bekliyor'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Invoice Detail Modal */}
            {showDetail && selectedInvoice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowDetail(false)}>
                    <div
                        className="absolute bottom-0 w-full bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Fatura Detayı</h2>
                                <p className="text-sm text-violet-600 font-mono">{selectedInvoice.invoice_number}</p>
                            </div>
                            <button
                                onClick={() => setShowDetail(false)}
                                className="p-2 bg-gray-100 rounded-full text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Invoice Info */}
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-1">Tedarikçi</p>
                                <p className="font-semibold text-gray-800">{selectedInvoice.supplier_name || '-'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Tarih</p>
                                    <p className="font-semibold text-gray-800">{formatDate(selectedInvoice.date)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Durum</p>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(selectedInvoice.status)}`}>
                                        {selectedInvoice.status || 'Bekliyor'}
                                    </span>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 text-center">
                                <p className="text-emerald-100 text-sm mb-1">Toplam Tutar</p>
                                <p className="text-3xl font-black text-white">
                                    ₺{parseFloat(selectedInvoice.total || 0).toLocaleString('tr-TR')}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            {selectedInvoice.status === 'Bekliyor' && (
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={async () => {
                                            try {
                                                await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlenmeyecek');
                                                setShowDetail(false);
                                                loadData();
                                            } catch (err) {
                                                alert('Hata: ' + err.message);
                                            }
                                        }}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                                    >
                                        İşlenmeyecek
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlendi');
                                                setShowDetail(false);
                                                loadData();
                                            } catch (err) {
                                                alert('Hata: ' + err.message);
                                            }
                                        }}
                                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-bold"
                                    >
                                        ✓ İşlendi
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Price Check Modal */}
            {showPriceCheckModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                💰 Fiyat Sorgula
                            </h2>
                            <button
                                onClick={() => {
                                    setShowPriceCheckModal(false);
                                    setPriceCheckProduct(null);
                                    if (priceCheckScannerRef.current) {
                                        priceCheckScannerRef.current.stop().catch(() => { });
                                        priceCheckScannerRef.current = null;
                                    }
                                    setShowPriceCheckScanner(false);
                                }}
                                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl hover:bg-white/30 transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            {/* Barcode Scanner Button */}
                            {!showPriceCheckScanner ? (
                                <button
                                    onClick={async () => {
                                        setShowPriceCheckScanner(true);
                                        setPriceCheckProduct(null);
                                        setTimeout(async () => {
                                            try {
                                                const scanner = new Html5Qrcode('invoice-price-check-scanner');
                                                priceCheckScannerRef.current = scanner;
                                                await scanner.start(
                                                    { facingMode: 'environment' },
                                                    { fps: 10, qrbox: { width: 250, height: 150 } },
                                                    (decodedText) => {
                                                        const found = products.find(p =>
                                                            p.barcode === decodedText ||
                                                            p.stock_code === decodedText ||
                                                            p.stock_code?.toLowerCase() === decodedText.toLowerCase()
                                                        );
                                                        if (found) {
                                                            setPriceCheckProduct(found);
                                                        } else {
                                                            setPriceCheckProduct({ notFound: true, searchTerm: decodedText });
                                                        }
                                                        scanner.stop().catch(() => { });
                                                        priceCheckScannerRef.current = null;
                                                        setShowPriceCheckScanner(false);
                                                    },
                                                    () => { }
                                                );
                                            } catch (err) {
                                                console.error('Kamera hatası:', err);
                                                setShowPriceCheckScanner(false);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] transition-all"
                                >
                                    📷 Barkod Okut
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div id="invoice-price-check-scanner" className="w-full rounded-2xl overflow-hidden"></div>
                                    <button
                                        onClick={() => {
                                            if (priceCheckScannerRef.current) {
                                                priceCheckScannerRef.current.stop().catch(() => { });
                                                priceCheckScannerRef.current = null;
                                            }
                                            setShowPriceCheckScanner(false);
                                        }}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                                    >
                                        İptal
                                    </button>
                                </div>
                            )}

                            {/* Manual Search */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={priceCheckSearch}
                                    onChange={(e) => setPriceCheckSearch(e.target.value)}
                                    placeholder="Stok Kodu veya Barkod girin..."
                                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-lg"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && priceCheckSearch.trim()) {
                                            const found = products.find(p =>
                                                p.barcode === priceCheckSearch.trim() ||
                                                p.stock_code === priceCheckSearch.trim() ||
                                                p.stock_code?.toLowerCase() === priceCheckSearch.trim().toLowerCase()
                                            );
                                            if (found) {
                                                setPriceCheckProduct(found);
                                            } else {
                                                setPriceCheckProduct({ notFound: true, searchTerm: priceCheckSearch.trim() });
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (priceCheckSearch.trim()) {
                                            const found = products.find(p =>
                                                p.barcode === priceCheckSearch.trim() ||
                                                p.stock_code === priceCheckSearch.trim() ||
                                                p.stock_code?.toLowerCase() === priceCheckSearch.trim().toLowerCase()
                                            );
                                            if (found) {
                                                setPriceCheckProduct(found);
                                            } else {
                                                setPriceCheckProduct({ notFound: true, searchTerm: priceCheckSearch.trim() });
                                            }
                                        }
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                >
                                    Ara
                                </button>
                            </div>

                            {/* Product Result */}
                            {priceCheckProduct && (
                                <div className="mt-4 animate-slide-up">
                                    {priceCheckProduct.notFound ? (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
                                            <span className="text-4xl">❌</span>
                                            <p className="text-lg font-semibold text-red-600 mt-2">Ürün Bulunamadı</p>
                                            <p className="text-gray-500 text-sm mt-1">"{priceCheckProduct.searchTerm}"</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
                                            {priceCheckProduct.image_url && (
                                                <div className="flex justify-center">
                                                    <img src={priceCheckProduct.image_url} alt={priceCheckProduct.name} className="w-24 h-24 object-cover rounded-xl shadow-md" />
                                                </div>
                                            )}
                                            <div className="space-y-2 text-center">
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">Ürün Adı</p>
                                                <p className="text-lg font-bold text-gray-800">{priceCheckProduct.name}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                <div className="bg-white rounded-xl p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500">Stok Kodu</p>
                                                    <p className="font-semibold text-gray-700">{priceCheckProduct.stock_code}</p>
                                                </div>
                                                <div className="bg-white rounded-xl p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500">Barkod</p>
                                                    <p className="font-semibold text-gray-700 font-mono text-sm">{priceCheckProduct.barcode || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 text-center shadow-lg shadow-emerald-500/30">
                                                <p className="text-emerald-100 text-sm mb-1">Satış Fiyatı</p>
                                                <p className="text-4xl font-black text-white">
                                                    {priceCheckProduct.price?.toFixed(2)} TL
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setPriceCheckProduct(null);
                                                    setPriceCheckSearch('');
                                                }}
                                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                            >
                                                🔄 Yeni Arama
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-2 px-1 z-30">
                <Link to="/mobile-pos" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">🛒</span>
                    <span className="text-[10px]">Satış</span>
                </Link>
                <button onClick={() => { setShowPriceCheckModal(true); setPriceCheckProduct(null); setPriceCheckSearch(''); }} className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">💰</span>
                    <span className="text-[10px]">Fiyat Gör</span>
                </button>
                <Link to="/mobile-products" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">📦</span>
                    <span className="text-[10px]">Ürünler</span>
                </Link>
                <Link to="/mobile-customers" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">👥</span>
                    <span className="text-[10px]">Bakiyeler</span>
                </Link>
                <Link to="/mobile-sales" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">📋</span>
                    <span className="text-[10px]">Satışlar</span>
                </Link>
                <Link to="/mobile-invoices" className="flex flex-col items-center text-blue-600 min-w-[40px]">
                    <span className="text-lg">📄</span>
                    <span className="text-[10px] font-bold">Faturalar</span>
                </Link>
                <button onClick={() => logout()} className="flex flex-col items-center text-red-500 min-w-[40px]">
                    <span className="text-lg">🚪</span>
                    <span className="text-[10px]">Çıkış</span>
                </button>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}

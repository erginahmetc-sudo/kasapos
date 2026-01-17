import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { birFaturaAPI } from '../services/birFaturaService';

export default function MobileInvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        try {
            const response = await birFaturaAPI.getInvoices();
            setInvoices(response.data?.invoiceList || []);
        } catch (error) {
            console.error('Faturalar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm ||
            inv.belgeNo?.toLowerCase().includes(searchLower) ||
            inv.gondericiUnvan?.toLowerCase().includes(searchLower);
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR');
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
                    <h1 className="text-xl font-bold text-gray-800">Gelen Faturalar</h1>
                    <span className="ml-auto bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-semibold">
                        {invoices.length}
                    </span>
                </div>

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Fatura no veya gönderici ara..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
            </header>

            {/* Invoice List */}
            <div className="p-4 space-y-3">
                {filteredInvoices.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        {invoices.length === 0 ? 'Fatura bulunamadı veya entegrasyon aktif değil.' : 'Arama sonucu bulunamadı.'}
                    </div>
                ) : (
                    filteredInvoices.map((invoice, index) => (
                        <div
                            key={invoice.ettn || index}
                            className="bg-white rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{invoice.gondericiUnvan || '-'}</h3>
                                    <p className="text-sm text-gray-500">{invoice.belgeNo || '-'}</p>
                                </div>
                                <div className="text-right ml-3">
                                    <p className="text-lg font-bold text-green-600">
                                        {parseFloat(invoice.toplamTutar || 0).toFixed(2)} TL
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">{formatDate(invoice.belgeTarihi)}</span>
                                <span className={`px-2 py-1 rounded-full ${invoice.durum === 'Onaylandı' ? 'bg-green-100 text-green-700' :
                                        invoice.durum === 'Beklemede' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {invoice.durum || 'Bilinmiyor'}
                                </span>
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
                <Link to="/mobile-sales" className="flex flex-col items-center text-gray-600">
                    <span className="text-xl">📋</span>
                    <span className="text-xs">Satışlar</span>
                </Link>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customersAPI } from '../services/api';

export default function MobileCustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await customersAPI.getAll();
            setCustomers(response.data?.customers || []);
        } catch (error) {
            console.error('Müşteriler yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm ||
            c.name?.toLowerCase().includes(searchLower) ||
            c.customer_code?.toLowerCase().includes(searchLower) ||
            c.phone?.includes(searchTerm);
    });

    // Calculate totals
    const totalDebt = customers.reduce((sum, c) => {
        const balance = parseFloat(c.balance) || 0;
        return balance > 0 ? sum + balance : sum;
    }, 0);

    const totalCredit = customers.reduce((sum, c) => {
        const balance = parseFloat(c.balance) || 0;
        return balance < 0 ? sum + Math.abs(balance) : sum;
    }, 0);

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
                    <h1 className="text-xl font-bold text-gray-800">Bakiyeler</h1>
                    <span className="ml-auto bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-semibold">
                        {customers.length}
                    </span>
                </div>

                {/* Summary Cards */}
                <div className="flex gap-2 mb-3">
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs text-red-600">Toplam Borç</p>
                        <p className="text-lg font-bold text-red-600">{totalDebt.toFixed(2)} TL</p>
                    </div>
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs text-green-600">Toplam Alacak</p>
                        <p className="text-lg font-bold text-green-600">{totalCredit.toFixed(2)} TL</p>
                    </div>
                </div>

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Müşteri ara..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
            </header>

            {/* Customer List */}
            <div className="p-4 space-y-3">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Müşteri bulunamadı.</div>
                ) : (
                    filteredCustomers.map(customer => {
                        const balance = parseFloat(customer.balance) || 0;
                        return (
                            <Link
                                key={customer.id}
                                to={`/customer/${encodeURIComponent(customer.name)}`}
                                className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4 no-underline"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {customer.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{customer.name}</h3>
                                    <p className="text-sm text-gray-500">{customer.customer_code || '-'}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {Math.abs(balance).toFixed(2)} TL
                                    </p>
                                    <p className={`text-xs ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                        {balance > 0 ? 'Borçlu' : balance < 0 ? 'Alacaklı' : 'Nötr'}
                                    </p>
                                </div>
                            </Link>
                        );
                    })
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
                <Link to="/mobile-customers" className="flex flex-col items-center text-blue-600">
                    <span className="text-xl">👥</span>
                    <span className="text-xs font-bold">Bakiyeler</span>
                </Link>
                <Link to="/mobile-sales" className="flex flex-col items-center text-gray-600">
                    <span className="text-xl">📋</span>
                    <span className="text-xs">Satışlar</span>
                </Link>
            </div>
        </div>
    );
}

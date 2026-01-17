import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customersAPI } from '../services/api';
import SaleDetailModal from '../components/modals/SaleDetailModal';

export default function CustomerDetailPage() {
    const { customerName } = useParams();
    const [customer, setCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState(null);

    const handleTransactionClick = (tx) => {
        // Only open modal for sales (where we have products or items)
        // If it's a payment, we don't show sale detail modal but maybe a simple info?
        // Actually, requirement says "Diğer işlem türü satırlarına tıklayarak satış detaylarını görüntüleyebilme"

        // Check if it's a sale transaction (has sale_code or is not a payment type)
        if (tx.transactionType === 'Fatura' || tx.transactionType === 'Nakit' || tx.transactionType === 'K.Kartı' || tx.transactionType === 'Veresiye') {
            // Adapt tx to sale object expected by SaleDetailModal
            // The modal expects { sale_code, customer, payment_method, date, total, items/products ... }

            // If tx comes from sales table join, it might have items.
            // If it comes from customer_transactions view/rpc, check structure.
            // Assuming getTransactions returns enough info or we might need to fetch sale detail?
            // Let's assume tx object has enough info for now or we pass what we have.
            // Note: processedTransactions adds fields. Use raw tx if needed but processed is fine too.

            const saleObj = {
                sale_code: tx.sale_code || tx.id, // Fallback
                customer: customer.name,
                payment_method: tx.payment_method,
                date: tx.created_at,
                total: tx.total,
                items: tx.items || tx.products || [], // Access jsonb items (or products legacy)
                is_deleted: false // Assuming history items are valid
            };
            setSelectedSale(saleObj);
        }
    };

    const handleDeletePayment = async (e, tx) => {
        e.stopPropagation(); // Prevent row click

        if (!confirm('Bu ödemeyi silmek müşterinin borcunu artıracaktır. Emin misiniz?')) return;

        try {
            await customersAPI.deletePayment(tx.id, customer.id, tx.total); // tx.total is amount for payment
            alert('Ödeme silindi.');
            loadCustomerData();
        } catch (error) {
            console.error(error);
            alert('Hata: ' + (error.message || 'Ödeme silinemedi'));
        }
    };

    useEffect(() => {
        loadCustomerData();
    }, [customerName]);

    const loadCustomerData = async () => {
        try {
            // Get all customers and find the one matching the name
            const { data: customersData } = await customersAPI.getAll();
            const customers = customersData?.customers || [];
            const foundCustomer = customers.find(c => c.name === decodeURIComponent(customerName));

            if (foundCustomer) {
                setCustomer(foundCustomer);

                // Get transactions for this customer
                const { data: txData } = await customersAPI.getTransactions(foundCustomer.id);
                setTransactions(txData?.transactions || []);
            }
        } catch (error) {
            console.error('Müşteri verileri yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatCurrency = (amount) => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Calculate running balance and categorize transactions
    const processedTransactions = transactions.map((tx, index) => {
        const total = parseFloat(tx.total) || 0;
        const paidAmount = parseFloat(tx.paid_amount) || 0;

        // Business Logic:
        // - Nakit/Kredi Kartı: Customer pays immediately → debt and credit equal → balance unchanged
        // - Veresiye: Customer doesn't pay → only debt → balance increases
        // - Payment (Ödeme Al): Customer pays off existing debt → only credit → balance decreases

        let debtAmount = 0;
        let creditAmount = 0;

        if (tx.type === 'payment') {
            // Payment transaction - customer paying off debt
            creditAmount = total;
            debtAmount = 0;
        } else if (tx.payment_method === 'veresiye') {
            // Veresiye sale - customer doesn't pay, full amount is debt
            debtAmount = total;
            creditAmount = 0; // No payment received
        } else {
            // Nakit or Kredi Kartı - customer pays immediately
            // Both debt and credit are equal = balanced transaction
            debtAmount = total;
            creditAmount = total; // Paid in full
        }

        // Get transaction type
        let transactionType = 'Fatura';
        if (tx.type === 'payment') transactionType = 'Ödeme';
        else if (tx.payment_method === 'nakit') transactionType = 'Nakit';
        else if (tx.payment_method === 'kredi_karti') transactionType = 'K.Kartı';
        else if (tx.payment_method === 'veresiye') transactionType = 'Veresiye';

        // Row colors based on net effect
        const netEffect = debtAmount - creditAmount;
        let rowColor = 'bg-green-100'; // Balanced (nakit/kredi kartı)
        if (netEffect > 0) rowColor = 'bg-yellow-100'; // Debt increased (veresiye)
        else if (netEffect < 0) rowColor = 'bg-cyan-100'; // Credit (payment received)

        return {
            ...tx,
            debtAmount,
            creditAmount,
            transactionType,
            rowColor
        };
    });

    // Calculate totals from transactions
    const totals = processedTransactions.reduce((acc, tx) => ({
        debt: acc.debt + tx.debtAmount,
        credit: acc.credit + tx.creditAmount
    }), { debt: 0, credit: 0 });

    // Use customer.balance from database for accuracy (this is the source of truth)
    const customerBalance = parseFloat(customer?.balance) || 0;
    // calculated balance from transactions for reference
    const calculatedBalance = totals.debt - totals.credit;
    // Use the database balance as the primary balance
    const netBalance = customerBalance;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="bg-white rounded-lg p-8 text-center shadow-md">
                    <h2 className="text-2xl font-bold text-gray-700">Müşteri Bulunamadı</h2>
                    <Link to="/customers" className="mt-4 inline-block px-6 py-2 bg-blue-500 text-white rounded-lg">
                        Müşterilere Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white px-6 py-4 shadow-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/customers"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Cari Hareket Raporu</h1>
                            <p className="text-gray-500 text-sm">
                                {customer.customer_code} - {customer.name}
                            </p>
                        </div>
                    </div>

                    {/* Balance Summary */}
                    <div className="flex gap-4">
                        <div className="px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                            <span className="text-sm text-red-600">Toplam Borç:</span>
                            <span className="ml-2 font-bold text-red-700">{formatCurrency(totals.debt)} TL</span>
                        </div>
                        <div className="px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                            <span className="text-sm text-green-600">Toplam Alacak:</span>
                            <span className="ml-2 font-bold text-green-700">{formatCurrency(totals.credit)} TL</span>
                        </div>
                        <div className={`px-4 py-2 rounded-lg border ${netBalance > 0 ? 'bg-red-100 border-red-300' : netBalance < 0 ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'}`}>
                            <span className="text-sm text-gray-600">Net Bakiye:</span>
                            <span className={`ml-2 font-bold ${netBalance > 0 ? 'text-red-700' : netBalance < 0 ? 'text-green-700' : 'text-gray-700'}`}>
                                {formatCurrency(Math.abs(netBalance))} TL {netBalance > 0 ? '(Borçlu)' : netBalance < 0 ? '(Alacaklı)' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Table */}
            <div className="p-4">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-blue-600 text-white">
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Cari Kodu</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Ticari Ünvanı</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Evrak No</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">İşlem Tarihi</th>
                                    <th className="px-3 py-2 text-right font-semibold border-r border-blue-500">Borç Tutarı</th>
                                    <th className="px-3 py-2 text-right font-semibold border-r border-blue-500">Alacak Tutarı</th>
                                    <th className="px-3 py-2 text-right font-semibold border-r border-blue-500">KPB Bakiyesi</th>
                                    <th className="px-3 py-2 text-center font-semibold border-r border-blue-500">KPB B/A/S</th>
                                    <th className="px-3 py-2 text-center font-semibold border-r border-blue-500">İşlem Türü</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Açıklama</th>
                                    <th className="px-3 py-2 text-center font-semibold w-16">Sil</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                            Bu müşteriye ait hareket bulunmamaktadır.
                                        </td>
                                    </tr>
                                ) : (
                                    processedTransactions.map((tx, idx) => {
                                        // Calculate running balance up to this transaction
                                        const runningBalance = processedTransactions
                                            .slice(0, idx + 1)
                                            .reduce((acc, t) => acc + t.debtAmount - t.creditAmount, 0);

                                        return (
                                            <tr
                                                key={tx.id || idx}
                                                className={`${tx.rowColor} border-b border-gray-200 hover:opacity-80 cursor-pointer transition-colors`}
                                                onClick={() => handleTransactionClick(tx)}
                                            >
                                                <td className="px-3 py-2 border-r border-gray-200 font-medium">
                                                    {customer.customer_code}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200">
                                                    {customer.name}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 font-mono text-xs">
                                                    {tx.sale_code || tx.id?.substring(0, 8) || '-'}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">
                                                    {formatDate(tx.created_at)}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 text-right font-medium">
                                                    {tx.debtAmount > 0 ? formatCurrency(tx.debtAmount) : ''}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 text-right font-medium">
                                                    {tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : ''}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 text-right font-bold">
                                                    {formatCurrency(Math.abs(runningBalance))}
                                                </td>
                                                <td className={`px-3 py-2 border-r border-gray-200 text-center font-bold ${runningBalance > 0 ? 'text-red-600' : runningBalance < 0 ? 'text-green-600' : 'text-gray-600'
                                                    }`}>
                                                    {runningBalance > 0 ? 'Borç' : runningBalance < 0 ? 'Alacak' : 'Sıfır'}
                                                </td>
                                                <td className={`px-3 py-2 border-r border-gray-200 text-center font-semibold ${tx.transactionType === 'Fatura' ? 'text-blue-600' :
                                                    tx.transactionType === 'Nakit' ? 'text-green-600' :
                                                        tx.transactionType === 'Ödeme' ? 'text-purple-600' : 'text-gray-600'
                                                    }`}>
                                                    {tx.transactionType}
                                                </td>
                                                <td className="px-3 py-2 text-left max-w-md truncate border-r border-gray-200">
                                                    <span className="truncate" title={tx.description || ''}>
                                                        {(tx.items || tx.products)?.map(p => p.name).join(', ') || tx.description || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {tx.transactionType === 'Ödeme' && (
                                                        <button
                                                            onClick={(e) => handleDeletePayment(e, tx)}
                                                            className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200 transition-colors"
                                                            title="Ödemeyi Sil"
                                                        >
                                                            Sil
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}

                                {/* Totals Row */}
                                {processedTransactions.length > 0 && (
                                    <tr className={`font-bold text-base ${netBalance > 0 ? 'bg-red-200' : netBalance < 0 ? 'bg-green-200' : 'bg-gray-200'}`}>
                                        <td colSpan={4} className="px-3 py-3 border-r border-gray-300 text-right uppercase">
                                            Toplam:
                                        </td>
                                        <td className="px-3 py-3 border-r border-gray-300 text-right text-red-700">
                                            {formatCurrency(totals.debt)}
                                        </td>
                                        <td className="px-3 py-3 border-r border-gray-300 text-right text-green-700">
                                            {formatCurrency(totals.credit)}
                                        </td>
                                        <td className="px-3 py-3 border-r border-gray-300 text-right">
                                            {formatCurrency(Math.abs(netBalance))}
                                        </td>
                                        <td className={`px-3 py-3 border-r border-gray-300 text-center ${netBalance > 0 ? 'text-red-700' : netBalance < 0 ? 'text-green-700' : ''
                                            }`}>
                                            {netBalance > 0 ? 'YÜKSEL' : netBalance < 0 ? 'ALACAK' : 'SIFIR'}
                                        </td>
                                        <td colSpan={3} className="px-3 py-3"></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sale Detail Modal */}
            {selectedSale && (
                <SaleDetailModal
                    sale={selectedSale}
                    onClose={() => setSelectedSale(null)}
                    onUpdate={() => {
                        loadCustomerData();
                        setSelectedSale(null);
                    }}
                    onDelete={() => {
                        loadCustomerData();
                        setSelectedSale(null);
                    }}
                />
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';

export default function LabelPrintModal({ isOpen, onClose, products }) {
    const [filterName, setFilterName] = useState('');
    const [filterGroup, setFilterGroup] = useState('Tümü');

    const [sourceList, setSourceList] = useState([]);
    const [printQueue, setPrintQueue] = useState([]);

    useEffect(() => {
        let filtered = products;
        if (filterName) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(filterName.toLowerCase()));
        }
        if (filterGroup && filterGroup !== 'Tümü') {
            filtered = filtered.filter(p => p.group === filterGroup);
        }
        setSourceList(filtered);
    }, [products, filterName, filterGroup]);

    const addToQueue = (product) => {
        setPrintQueue(prev => [...prev, { ...product, quantity: 1 }]);
    };

    const addAllFiltered = () => {
        const toAdd = sourceList.slice(0, 100).map(p => ({ ...p, quantity: 1 }));
        setPrintQueue(prev => [...prev, ...toAdd]);
    };

    const removeFromQueue = (index) => {
        setPrintQueue(prev => prev.filter((_, i) => i !== index));
    };

    const updateQuantity = (index, val) => {
        const newQ = [...printQueue];
        newQ[index].quantity = parseInt(val) || 1;
        setPrintQueue(newQ);
    };

    const handlePrint = () => {
        if (printQueue.length === 0) return alert("Listeye ürün ekleyin.");

        const printWindow = window.open('', '_blank');
        const html = `
            <html>
                <head>
                    <title>Etiket Yazdır</title>
                    <style>
                        body { font-family: sans-serif; margin: 0; padding: 10px; }
                        .label-container { display: flex; flex-wrap: wrap; gap: 5px; }
                        .label {
                            width: 200px; height: 100px;
                            border: 1px dotted #ccc;
                            display: flex; flex-direction: column; 
                            align-items: center; justify-content: center;
                            text-align: center;
                            page-break-inside: avoid;
                            padding: 5px;
                            box-sizing: border-box;
                        }
                        .name { font-size: 11px; font-weight: bold; overflow: hidden; max-height: 28px; line-height: 14px; margin-bottom: 4px; }
                        .price { font-size: 20px; font-weight: 900; color: #000; }
                        .barcode { font-family: monospace; font-size: 10px; margin-top: 5px; letter-spacing: 1px; }
                        @media print { .label { border: none; } }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        ${printQueue.flatMap(item => Array(item.quantity).fill(item)).map(p => `
                            <div class="label">
                                <div class="name">${p.name}</div>
                                <div class="price">₺${parseFloat(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                <div class="barcode">${p.barcode || p.stock_code}</div>
                            </div>
                        `).join('')}
                    </div>
                    <script>window.print();</script>
                </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    const uniqueGroups = ['Tümü', ...new Set(products.map(p => p.group).filter(Boolean))];
    const totalLabels = printQueue.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-8 py-6 flex-shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                                Ürün Etiketi Yazdır
                            </h2>
                            <p className="text-white/80 mt-2 text-sm">Ürünleriniz için fiyat etiketi oluşturun ve yazdırın</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Stats */}
                    {printQueue.length > 0 && (
                        <div className="mt-4 flex gap-4">
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                                <span className="text-white/70 text-sm">Ürün:</span>
                                <span className="text-white font-bold ml-2">{printQueue.length}</span>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                                <span className="text-white/70 text-sm">Toplam Etiket:</span>
                                <span className="text-white font-bold ml-2">{totalLabels}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex min-h-0 bg-gradient-to-br from-gray-50 to-orange-50/30 p-4 gap-4">
                    {/* LEFT PANEL: Filters */}
                    <div className="w-64 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col p-5 gap-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filtrele
                        </h3>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ürün Adı</label>
                            <input
                                className="w-full mt-2 px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                placeholder="Ara..."
                                value={filterName}
                                onChange={e => setFilterName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grup</label>
                            <select
                                className="w-full mt-2 px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                value={filterGroup}
                                onChange={e => setFilterGroup(e.target.value)}
                            >
                                {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={() => { setFilterName(''); setFilterGroup('Tümü'); }}
                            className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-all text-sm"
                        >
                            Temizle
                        </button>
                        <div className="mt-auto pt-4 border-t border-gray-100">
                            <button
                                onClick={addAllFiltered}
                                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                Tümünü Ekle
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* CENTER PANEL: Source List */}
                    <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <span className="font-bold text-gray-800 text-sm">Ürün Listesi</span>
                            <span className="text-gray-500 text-xs">{sourceList.length} ürün</span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 w-16">Ekle</th>
                                        <th className="px-4 py-3">Stok Kodu</th>
                                        <th className="px-4 py-3">Ürün Adı</th>
                                        <th className="px-4 py-3 text-right">Fiyat</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sourceList.map((p) => (
                                        <tr key={p.stock_code} className="hover:bg-orange-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => addToQueue(p)}
                                                    className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:shadow-md transition-all"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">{p.stock_code}</span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-[200px]">{p.name}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">₺{parseFloat(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {sourceList.length === 0 && (
                                <div className="text-center py-12 text-gray-400">Ürün bulunamadı</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Print Queue */}
                    <div className="w-80 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-5 py-4 border-b border-gray-100">
                            <span className="font-bold text-gray-800 text-sm">Yazdırılacak Etiketler</span>
                        </div>
                        <div className="flex-1 overflow-auto p-4 space-y-2">
                            {printQueue.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-orange-50/50 p-3 rounded-xl border border-gray-100 group">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-800 text-sm truncate">{item.name}</div>
                                        <div className="text-xs text-orange-600 font-mono">{item.stock_code}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            min="1"
                                            onChange={(e) => updateQuantity(i, e.target.value)}
                                            className="w-14 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                        <button
                                            onClick={() => removeFromQueue(i)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {printQueue.length === 0 && (
                                <div className="text-center py-12">
                                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    <p className="text-gray-400 text-sm">Liste boş</p>
                                    <p className="text-gray-300 text-xs mt-1">Ürün eklemek için "+" butonuna tıklayın</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 space-y-2">
                            <button
                                onClick={handlePrint}
                                disabled={printQueue.length === 0}
                                className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${printQueue.length === 0
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:-translate-y-0.5'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Etiketleri Yazdır
                            </button>
                            {printQueue.length > 0 && (
                                <button
                                    onClick={() => setPrintQueue([])}
                                    className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-all text-sm"
                                >
                                    Listeyi Temizle
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

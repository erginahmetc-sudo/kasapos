import { useState, useEffect } from 'react';
import { productsAPI, shortcutsAPI } from '../../services/api';

export default function GroupContentModal({ isOpen, onClose, groupName }) {
    const [allProducts, setAllProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [groupItems, setGroupItems] = useState([]); // { ...product, orderVal: 1 }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && groupName) {
            loadData();
        }
    }, [isOpen, groupName]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Load All Products
            const pRes = await productsAPI.getAll();
            const products = pRes.data?.products || [];
            setAllProducts(products);

            // 2. Load Group Data to get current items
            const sRes = await shortcutsAPI.getAll();
            const shortcuts = sRes.data?.shortcuts || [];
            const currentGroup = shortcuts.find(s => s.name === groupName);

            if (currentGroup && currentGroup.items && Array.isArray(currentGroup.items)) {
                // Map existing items (stock_codes) to product objects
                // Preserving order from DB (which is the saved order)
                const mapped = currentGroup.items.map((code, index) => {
                    const p = products.find(prod => prod.stock_code === code);
                    if (!p) return null;
                    return { ...p, orderVal: index + 1 };
                }).filter(Boolean); // changes: Remove nulls
                setGroupItems(mapped);
            } else {
                setGroupItems([]);
            }

        } catch (error) {
            console.error(error);
            alert("Veriler yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = (product) => {
        if (groupItems.some(item => item.stock_code === product.stock_code)) return; // Already exists

        // Auto increment order
        const maxOrder = groupItems.reduce((max, item) => Math.max(max, parseInt(item.orderVal) || 0), 0);
        setGroupItems([...groupItems, { ...product, orderVal: maxOrder + 1 }]);
    };

    const handleRemoveItem = (stockCode) => {
        setGroupItems(groupItems.filter(item => item.stock_code !== stockCode));
    };

    const handleOrderChange = (index, val) => {
        const newItems = [...groupItems];
        newItems[index].orderVal = val;
        setGroupItems(newItems);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Sort items by orderVal
            const sortedItems = [...groupItems].sort((a, b) => {
                const orderA = parseInt(a.orderVal) || 9999;
                const orderB = parseInt(b.orderVal) || 9999;
                return orderA - orderB;
            });

            // Extract stock codes
            const itemCodes = sortedItems.map(item => item.stock_code);

            await shortcutsAPI.updateCategory(groupName, { items: itemCodes });
            onClose(); // Close and Refetch parent? Parent should refetch.
            alert("Grup güncellendi!");
        } catch (error) {
            console.error(error);
            alert("Kaydetme başarısız.");
        } finally {
            setSaving(false);
        }
    };

    // Filter left list
    const filteredSource = allProducts.filter(p => {
        if (groupItems.some(item => item.stock_code === p.stock_code)) return false; // Hide already added
        const search = searchTerm.toLowerCase();
        return p.name.toLowerCase().includes(search) || p.stock_code.toLowerCase().includes(search);
    }).slice(0, 50); // Limit display

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60] font-sans">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-gray-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            Grubu Düzenle: <span className="text-blue-600">{groupName}</span>
                        </h2>
                        <p className="text-sm text-gray-500">Ürünleri seçin ve sıralama numarası vererek düzenleyin.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors">✕</button>
                </div>

                {/* Body */}
                <div className="flex-1 flex min-h-0 bg-gray-50 p-4 gap-4">

                    {/* LEFT: Source */}
                    <div className="w-1/3 bg-white border border-gray-200 rounded-lg flex flex-col shadow-sm">
                        <div className="p-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                            <h3 className="font-bold text-gray-700 text-sm mb-2">Ürün Listesi</h3>
                            <input
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ürün Ara..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredSource.map(p => (
                                <div
                                    key={p.stock_code}
                                    onClick={() => handleAddItem(p)}
                                    className="p-2 border border-gray-100 rounded hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors group flex justify-between items-center"
                                >
                                    <div className="overflow-hidden">
                                        <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{p.stock_code}</div>
                                    </div>
                                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 font-bold px-2">+</span>
                                </div>
                            ))}
                            {filteredSource.length === 0 && <div className="text-center text-gray-400 text-sm py-4">Ürün bulunamadı</div>}
                        </div>
                    </div>

                    {/* RIGHT: Selected Items */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg flex flex-col shadow-sm">
                        <div className="p-3 border-b border-gray-100 bg-blue-50 rounded-t-lg flex justify-between items-center">
                            <h3 className="font-bold text-blue-800 text-sm">Grup İçeriği ({groupItems.length})</h3>
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Sıra Numarasına Göre Kaydedilir</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 w-20">Sıra</th>
                                        <th className="px-3 py-2">Ürün</th>
                                        <th className="px-3 py-2 text-right">Fiyat</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {groupItems.map((item, index) => (
                                        <tr key={item.stock_code} className="hover:bg-gray-50 group">
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={item.orderVal}
                                                    onChange={(e) => handleOrderChange(index, e.target.value)}
                                                    className="w-16 border border-gray-300 rounded px-1 py-1 text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-gray-800">{item.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{item.stock_code}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                {item.price} ₺
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    onClick={() => handleRemoveItem(item.stock_code)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors font-bold text-lg"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {groupItems.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-center py-10 text-gray-400 italic">
                                                Bu grupta henüz ürün yok. Soldan ürün seçiniz.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                    >
                        Vazgeç
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                        {saving ? 'Kaydediliyor...' : '✅ Kaydet ve Kapat'}
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI } from '../services/api';

export default function MobileProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            setProducts(response.data?.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm ||
            p.name?.toLowerCase().includes(searchLower) ||
            p.barcode?.toLowerCase().includes(searchLower) ||
            p.stock_code?.toLowerCase().includes(searchLower);
    });

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
                    <h1 className="text-xl font-bold text-gray-800">Ürün Listesi</h1>
                    <span className="ml-auto bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-semibold">
                        {products.length}
                    </span>
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ürün ara (ad, barkod, stok kodu)..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
            </header>

            {/* Product List */}
            <div className="p-4 space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Ürün bulunamadı.</div>
                ) : (
                    filteredProducts.map(product => (
                        <div
                            key={product.id || product.stock_code}
                            className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4"
                        >
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-lg" />
                            ) : (
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl text-gray-400">📦</div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-800 truncate">{product.name}</h3>
                                <p className="text-sm text-gray-500">{product.stock_code}</p>
                                <p className="text-xs text-gray-400">{product.barcode || '-'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-green-600">{product.price?.toFixed(2)} TL</p>
                                <p className="text-xs text-gray-500">Stok: {product.stock || 0}</p>
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
                <Link to="/mobile-products" className="flex flex-col items-center text-blue-600">
                    <span className="text-xl">📦</span>
                    <span className="text-xs font-bold">Ürünler</span>
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

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, salesAPI } from '../services/api';

export default function SalesPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Tümü');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const res = await productsAPI.getAll();
            setProducts(res.data?.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const clearCart = () => setCart([]);

    const handleCheckout = async (paymentMethod) => {
        if (cart.length === 0) return;

        try {
            const saleData = {
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    price: item.price
                })),
                payment_method: paymentMethod,
                total_amount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            };

            await salesAPI.create(saleData);
            clearCart();
            alert('Satış başarıyla tamamlandı!');
        } catch (error) {
            console.error('Satış hatası:', error);
            alert('Satış işlemi başarısız oldu.');
        }
    };

    const filteredProducts = products.filter(p =>
        (selectedCategory === 'Tümü' || p.category === selectedCategory) &&
        (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.includes(searchQuery))
    );

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Kategori listesi (statik veya ürünlerden türetilebilir)
    const categories = ['Tümü', 'Gıda', 'İçecek', 'Temizlik', 'Elektronik', 'Tekstil'];

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-display text-slate-900">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 z-50 flex-none">
                <div className="flex items-center gap-3 w-1/4">
                    <div className="w-9 h-9 rounded-lg bg-pos-primary flex items-center justify-center text-white shadow-lg shadow-pos-primary/20">
                        <span className="material-symbols-outlined text-xl">point_of_sale</span>
                    </div>
                    <h1 className="text-pos-primary font-bold text-lg tracking-tight">Kasa POS</h1>
                </div>
                <nav className="flex items-center justify-center gap-2 flex-1">
                    <Link to="/" className="flex flex-col items-center justify-center px-6 h-16 border-b-2 border-pos-accent-blue text-pos-accent-blue transition-all bg-pos-accent-blue/5">
                        <span className="material-symbols-outlined">shopping_cart</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Satış</span>
                    </Link>
                    <Link to="/products" className="flex flex-col items-center justify-center px-6 h-16 border-b-2 border-transparent text-slate-400 hover:text-pos-primary hover:bg-slate-50 transition-all">
                        <span className="material-symbols-outlined">inventory_2</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Ürünler</span>
                    </Link>
                    <Link to="/reports" className="flex flex-col items-center justify-center px-6 h-16 border-b-2 border-transparent text-slate-400 hover:text-pos-primary hover:bg-slate-50 transition-all">
                        <span className="material-symbols-outlined">analytics</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Raporlar</span>
                    </Link>
                    <Link to="/settings" className="flex flex-col items-center justify-center px-6 h-16 border-b-2 border-transparent text-slate-400 hover:text-pos-primary hover:bg-slate-50 transition-all">
                        <span className="material-symbols-outlined">settings</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Ayarlar</span>
                    </Link>
                </nav>
                <div className="flex items-center justify-end gap-4 w-1/4">
                    <div className="text-right hidden lg:block leading-tight">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date().toLocaleDateString('tr-TR')}</p>
                        <p className="text-sm font-extrabold text-pos-primary">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors">
                        <span className="material-symbols-outlined text-xl">person</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Cart */}
                <aside className="w-[420px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl shadow-slate-200/50">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pos-accent-blue transition-colors">barcode_scanner</span>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-pos-accent-blue/20 focus:border-pos-accent-blue transition-all outline-none shadow-sm placeholder:text-slate-400"
                                placeholder="Barkod veya ürün ara..."
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white border-b border-slate-100">
                        <span className="flex-1">Sepetteki Ürünler</span>
                        <span className="w-16 text-center">Adet</span>
                        <span className="w-20 text-right">Tutar</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-0 py-0 divide-y divide-slate-100">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">shopping_cart_off</span>
                                <p className="text-sm font-medium">Sepet boş</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="flex items-center gap-2 pl-0 pr-2 py-1.5 hover:bg-slate-50 group transition-all">
                                    <div className="w-10 h-10 bg-slate-100 overflow-hidden flex-shrink-0 border-r border-slate-100">
                                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                                            {/* Placeholder image if no image url */}
                                            <span className="material-symbols-outlined text-sm">image</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 pl-1">
                                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                                        <p className="text-[10px] text-slate-500">₺{item.price?.toFixed(2)}</p>
                                    </div>
                                    <div className="w-16 flex items-center justify-center gap-1">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold">-</button>
                                        <div className="h-6 px-1 flex items-center justify-center text-xs font-bold text-slate-700">{item.quantity}</div>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold">+</button>
                                    </div>
                                    <div className="w-20 text-right">
                                        <span className="text-xs font-bold text-red-500">₺{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                    <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100">
                                        <span className="material-symbols-outlined text-base">close</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10">
                        <div className="space-y-0 mb-4">
                            <div className="flex justify-between items-end pt-2">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">TOPLAM</span>
                                <span className="text-3xl font-extrabold text-pos-primary tracking-tighter">₺{cartTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleCheckout('Nakit')} className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-pos-accent-green hover:bg-pos-accent-green/5 hover:shadow-md transition-all group">
                                <span className="material-symbols-outlined text-pos-accent-green mb-1 group-hover:scale-110 transition-transform">payments</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-pos-accent-green">NAKİT</span>
                            </button>
                            <button onClick={() => handleCheckout('Kredi Kartı')} className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-pos-accent-blue hover:bg-pos-accent-blue/5 hover:shadow-md transition-all group">
                                <span className="material-symbols-outlined text-pos-accent-blue mb-1 group-hover:scale-110 transition-transform">credit_card</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-pos-accent-blue">KREDİ KARTI</span>
                            </button>
                            <button className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 hover:shadow-md transition-all group">
                                <span className="material-symbols-outlined text-orange-500 mb-1 group-hover:scale-110 transition-transform">assignment</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-orange-600">VERESİYE</span>
                            </button>
                            <button onClick={clearCart} className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-rose-500 hover:bg-rose-50 hover:shadow-md transition-all group">
                                <span className="material-symbols-outlined text-rose-500 mb-1 group-hover:scale-110 transition-transform">delete_sweep</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-rose-600">İPTAL</span>
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content: Products Grid */}
                <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden relative">
                    <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 bg-white flex-none z-10">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                        ? 'bg-pos-primary text-white shadow-sm hover:shadow-md hover:bg-slate-800'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-pos-accent-blue hover:text-pos-accent-blue hover:bg-pos-accent-blue/5'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="flex-none overflow-x-auto custom-scrollbar p-6 bg-slate-50/50 border-b border-slate-200 shadow-inner h-full overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-12 h-12 border-4 border-pos-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-1/2 text-slate-400">
                                <span className="material-symbols-outlined text-5xl mb-3 opacity-30">inventory_2</span>
                                <p className="font-medium">Ürün bulunamadı</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20">
                                {filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm hover:shadow-lg hover:border-pos-accent-blue/30 hover:-translate-y-0.5 transition-all group flex flex-col cursor-pointer h-40"
                                    >
                                        <div className="w-full h-16 rounded-lg bg-slate-50 overflow-hidden relative flex-shrink-0 border border-slate-100 mb-2 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-slate-300 text-2xl">image</span>
                                        </div>
                                        <div className="flex flex-col flex-1 px-0.5 relative">
                                            <h3 className="text-[10px] font-bold text-slate-700 leading-snug line-clamp-2 mb-auto group-hover:text-pos-accent-blue transition-colors">
                                                {product.name}
                                            </h3>
                                            <div className="flex items-center justify-between mt-auto pt-1 w-full">
                                                <span className="text-xs font-extrabold text-pos-primary">₺{product.price?.toFixed(2)}</span>
                                                <div className="w-6 h-6 rounded bg-slate-50 text-slate-400 group-hover:bg-pos-accent-blue group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                                                    <span className="material-symbols-outlined text-sm font-bold">add</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

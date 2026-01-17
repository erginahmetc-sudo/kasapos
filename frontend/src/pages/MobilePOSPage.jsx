import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, salesAPI, customersAPI, shortcutsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MobilePOSPage() {
    const { user, logout } = useAuth();
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [shortcuts, setShortcuts] = useState([]);
    const [categories, setCategories] = useState(['Tümü']);
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedCartIndex, setSelectedCartIndex] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState('Toptan Satış');

    // Modal states
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [showAddQuantityModal, setShowAddQuantityModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);

    const [modalValue, setModalValue] = useState('');
    const [productToAdd, setProductToAdd] = useState(null);
    const [addQuantityValue, setAddQuantityValue] = useState(1);
    const [successMessage, setSuccessMessage] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    useEffect(() => {
        loadProducts();
        loadCustomers();
        loadShortcuts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            const data = response.data || {};
            setProducts(data.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
        }
    };

    const loadCustomers = async () => {
        try {
            const response = await customersAPI.getAll();
            setCustomers(response.data?.customers || []);
        } catch (error) {
            console.error('Müşteriler yüklenirken hata:', error);
        }
    };

    const loadShortcuts = async () => {
        try {
            const res = await shortcutsAPI.getAll();
            const list = res.data?.shortcuts || [];
            setShortcuts(list);
            setCategories(['Tümü', ...list.map(s => s.name)]);
        } catch (err) {
            console.error('Kısayollar yüklenirken hata:', err);
        }
    };

    const filteredProducts = (() => {
        const currentGroup = selectedCategory !== 'Tümü'
            ? shortcuts.find(s => s.name === selectedCategory)
            : null;
        const groupItems = currentGroup?.items || [];

        let result = products.filter(p => {
            let matchesCategory = true;
            if (selectedCategory !== 'Tümü') {
                matchesCategory = groupItems.includes(p.stock_code);
            }

            const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.barcode?.includes(searchTerm) ||
                p.stock_code?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        if (selectedCategory !== 'Tümü' && groupItems.length > 0) {
            result.sort((a, b) => {
                const idxA = groupItems.indexOf(a.stock_code);
                const idxB = groupItems.indexOf(b.stock_code);
                return idxA - idxB;
            });
        }

        return result;
    })();

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        c.phone?.includes(customerSearchTerm)
    );

    const handleProductClick = (product) => {
        setProductToAdd(product);
        setAddQuantityValue(1);
        setShowAddQuantityModal(true);
    };

    const confirmAddToCart = () => {
        if (!productToAdd) return;
        const quantity = parseFloat(addQuantityValue) || 1;

        const existingIndex = cart.findIndex(item => item.stock_code === productToAdd.stock_code);
        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += quantity;
            setCart(newCart);
        } else {
            setCart([...cart, { ...productToAdd, quantity: quantity, discount_rate: 0, final_price: productToAdd.price }]);
        }
        setShowAddQuantityModal(false);
        setProductToAdd(null);
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index][field] = value;
        if (field === 'discount_rate') {
            newCart[index].final_price = newCart[index].price * (1 - value / 100);
        } else if (field === 'price') {
            newCart[index].final_price = value * (1 - (newCart[index].discount_rate || 0) / 100);
        }
        setCart(newCart);
        setShowQuantityModal(false);
        setShowDiscountModal(false);
        setShowPriceModal(false);
    };

    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
        setSelectedCartIndex(null);
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => {
            return sum + (item.final_price * item.quantity);
        }, 0);
    };

    const completeSale = async (paymentMethod) => {
        if (cart.length === 0) {
            alert('Sepet boş!');
            return;
        }

        if (paymentMethod === 'Açık Hesap' && selectedCustomer === 'Toptan Satış') {
            alert('Açık hesap için bir müşteri seçmelisiniz.');
            return;
        }

        try {
            const saleCode = 'SLS-' + Date.now();
            const selectedCustomerObj = customers.find(c => c.name === selectedCustomer);

            await salesAPI.complete({
                sale_code: saleCode,
                customer: selectedCustomerObj || null,
                customer_name: !selectedCustomerObj ? selectedCustomer : undefined,
                payment_method: paymentMethod,
                items: cart.map(item => ({
                    id: item.id,
                    stock_code: item.stock_code,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.final_price,
                    discount_rate: item.discount_rate || 0,
                    amount: item.quantity
                })),
                total: calculateTotal()
            });

            setSuccessMessage('Satış İşlemi Başarılı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setSelectedCustomer('Toptan Satış');
            setShowCartModal(false);
            loadProducts();
        } catch (error) {
            alert('Satış hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="flex flex-col w-screen h-screen bg-gray-100 overflow-hidden select-none">
            {/* Success Message */}
            {successMessage && (
                <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
                    <div className="bg-green-500 text-white px-16 py-8 rounded-xl shadow-2xl text-3xl font-bold animate-pulse">
                        {successMessage}
                    </div>
                </div>
            )}

            {/* Side Menu */}
            <div
                className={`fixed top-0 left-0 h-full bg-slate-800 z-[1001] transition-all duration-500 overflow-hidden flex flex-col gap-2 pt-16 shadow-xl ${showSideMenu ? 'w-64' : 'w-0'}`}
            >
                <button
                    onClick={() => setShowSideMenu(false)}
                    className="absolute top-2 right-4 text-4xl text-white bg-transparent border-none cursor-pointer"
                >
                    &times;
                </button>
                <Link to="/" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    🏠 Ana Sayfa
                </Link>
                <Link to="/customers" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    👥 Müşterileri Gör
                </Link>
                <Link to="/sales" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    📊 Satışları Gör
                </Link>
                <Link to="/products" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    📦 Ürünleri Gör
                </Link>
                <button
                    onClick={() => { logout(); setShowSideMenu(false); }}
                    className="mt-4 px-8 py-4 text-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors border-t border-slate-700 text-left"
                >
                    🚪 Çıkış
                </button>
            </div>

            {/* Header */}
            <header className="flex justify-between items-center p-3 bg-white shadow-md">
                <div className="flex gap-3 items-center flex-1">
                    <button
                        onClick={() => setShowSideMenu(true)}
                        className="bg-blue-50 text-blue-600 border-none rounded-lg p-3 text-xl cursor-pointer hover:bg-blue-600 hover:text-white transition-colors"
                    >
                        ☰
                    </button>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Ürün ara..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div className="flex gap-3 ml-3">
                    <button className="bg-blue-50 text-blue-600 border-none rounded-lg p-3 text-xl cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">
                        📷
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
                {/* Category Buttons */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex-shrink-0 bg-white border-2 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition-all
                                ${selectedCategory === cat
                                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                                    : 'border-gray-300 hover:border-blue-500 hover:text-blue-500'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 content-start pb-24">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id || product.stock_code}
                            onClick={() => handleProductClick(product)}
                            className="bg-white border border-gray-200 rounded-xl p-3 text-center cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 flex flex-col justify-center min-h-[120px]"
                        >
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-md mx-auto mb-2" />
                            ) : (
                                <div className="w-20 h-20 flex items-center justify-center text-4xl text-gray-300 mx-auto mb-2">📦</div>
                            )}
                            <div className="text-xs font-semibold mb-1 line-clamp-2">{product.name}</div>
                            <div className="text-green-600 text-base font-bold">{product.price?.toFixed(2)} TL</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Cart Summary */}
            <div className="fixed bottom-0 left-0 w-full bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] px-5 py-4 flex justify-between items-center z-[500]">
                <span className="text-2xl font-bold text-green-600">{calculateTotal().toFixed(2)} TL</span>
                <button
                    onClick={() => setShowCartModal(true)}
                    className="absolute left-1/2 -translate-x-1/2 bg-blue-600 text-white border-none rounded-lg px-6 py-3 text-lg font-bold cursor-pointer hover:bg-blue-700 transition-colors"
                >
                    <span>{cart.length}</span> Sepet
                </button>
            </div>

            {/* Cart Modal */}
            {showCartModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" onClick={() => setShowCartModal(false)}>
                    <div
                        className="absolute bottom-0 w-full bg-white rounded-t-3xl p-4 shadow-2xl max-h-[80%] flex flex-col animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-2xl font-bold text-slate-800 m-0">Sepetim</h3>
                            <div className="flex-1 text-center font-bold text-blue-600 truncate mx-4">
                                {selectedCustomer}
                            </div>
                            <button
                                onClick={() => setShowCartModal(false)}
                                className="bg-gray-100 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-200"
                            >
                                Geri Dön
                            </button>
                        </div>

                        {/* Cart List */}
                        <div className="flex-1 overflow-y-auto border-b border-gray-200 mb-3">
                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">Sepetinizde ürün bulunmamaktadır.</div>
                            ) : (
                                cart.map((item, index) => (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedCartIndex(index)}
                                        className={`flex justify-between items-center py-3 border-b border-gray-100 cursor-pointer
                                            ${selectedCartIndex === index ? 'bg-yellow-300' : ''}`}
                                    >
                                        <div className="flex-1">
                                            <h4 className="m-0 mb-1 text-base font-semibold">{item.name}</h4>
                                            <p className="m-0 text-sm text-gray-600 flex items-center gap-1">
                                                <span className="text-blue-600 font-bold">{item.quantity}</span>
                                                <span className="font-black">Adet x</span>
                                                <span className="text-blue-600 font-bold">{item.final_price?.toFixed(2)} TL</span>
                                            </p>
                                        </div>
                                        <div className="font-bold text-green-600 text-lg w-20 text-right">
                                            {(item.final_price * item.quantity).toFixed(2)} TL
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}
                                            className="ml-3 bg-red-500 text-white border-none rounded-full w-9 h-9 text-lg cursor-pointer flex items-center justify-center hover:bg-red-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Edit Buttons */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <button
                                onClick={() => {
                                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                        setModalValue(cart[selectedCartIndex].quantity);
                                        setShowQuantityModal(true);
                                    }
                                }}
                                disabled={selectedCartIndex === null}
                                className="py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed bg-green-500 text-white hover:bg-green-600 disabled:hover:bg-gray-200"
                            >
                                Miktar Düzenle
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                        setModalValue(cart[selectedCartIndex].discount_rate || 0);
                                        setShowDiscountModal(true);
                                    }
                                }}
                                disabled={selectedCartIndex === null}
                                className="py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed bg-yellow-500 text-white hover:bg-yellow-600 disabled:hover:bg-gray-200"
                            >
                                İskonto Ekle
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                        setModalValue(cart[selectedCartIndex].price);
                                        setShowPriceModal(true);
                                    }
                                }}
                                disabled={selectedCartIndex === null}
                                className="py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed bg-cyan-500 text-white hover:bg-cyan-600 disabled:hover:bg-gray-200"
                            >
                                Fiyat Düzenle
                            </button>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center bg-yellow-300 rounded-lg p-4 mb-3">
                            <span className="text-lg">Genel Toplam</span>
                            <span className="text-2xl font-bold">{calculateTotal().toFixed(2)} TL</span>
                        </div>

                        {/* Customer Select Button */}
                        <button
                            onClick={() => setShowCustomerModal(true)}
                            className="w-full py-3 bg-cyan-400 text-white rounded-lg font-semibold cursor-pointer hover:bg-cyan-500 transition-colors mb-3"
                        >
                            Müşteri Seç
                        </button>

                        {/* Payment Buttons */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => completeSale('Nakit')}
                                disabled={cart.length === 0}
                                className="py-4 rounded-lg font-semibold text-white cursor-pointer transition-colors bg-green-500 hover:bg-green-600 disabled:opacity-50"
                            >
                                Nakit
                            </button>
                            <button
                                onClick={() => completeSale('POS')}
                                disabled={cart.length === 0}
                                className="py-4 rounded-lg font-semibold text-white cursor-pointer transition-colors bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                            >
                                POS
                            </button>
                            <button
                                onClick={() => completeSale('Açık Hesap')}
                                disabled={cart.length === 0}
                                className="py-4 rounded-lg font-semibold text-white cursor-pointer transition-colors bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
                            >
                                Açık Hesap
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Quantity Modal */}
            {showAddQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowAddQuantityModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Miktar Girin</h3>
                        <p className="text-gray-600 mb-4">{productToAdd?.name}</p>
                        <input
                            type="number"
                            value={addQuantityValue}
                            onChange={(e) => setAddQuantityValue(e.target.value)}
                            className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg mb-4 focus:outline-none"
                            min="1"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={confirmAddToCart}
                            className="w-full py-4 bg-green-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-green-600 transition-colors"
                        >
                            Sepete Ekle
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Quantity Modal */}
            {showQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowQuantityModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Miktar Düzenle</h3>
                        <p className="text-gray-600 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg mb-4 focus:outline-none"
                            min="1"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1)}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowDiscountModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">İskonto Ekle (%)</h3>
                        <p className="text-gray-600 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg mb-4 focus:outline-none"
                            min="0"
                            max="100"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0)}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Price Modal */}
            {showPriceModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowPriceModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Fiyat Düzenle</h3>
                        <p className="text-gray-600 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            step="0.01"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg mb-4 focus:outline-none"
                            min="0"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0)}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Customer Search Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
                        <span
                            onClick={() => setShowCustomerModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Müşteri Ara ve Seç</h3>
                        <input
                            type="text"
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            placeholder="Müşteri adı veya numarası"
                            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-blue-500 mb-4"
                            autoFocus
                        />
                        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg mb-4 max-h-72">
                            {filteredCustomers.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Müşteri bulunamadı.</p>
                            ) : (
                                filteredCustomers.map(customer => (
                                    <div
                                        key={customer.id}
                                        onClick={() => {
                                            setSelectedCustomer(customer.name);
                                            setShowCustomerModal(false);
                                        }}
                                        className="flex flex-col p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors"
                                    >
                                        <h4 className="m-0 text-lg text-slate-800 font-semibold">{customer.name}</h4>
                                        <p className="m-0 text-sm text-gray-500">{customer.phone || 'Telefon Yok'}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setSelectedCustomer('Toptan Satış');
                                setShowCustomerModal(false);
                            }}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Misafir Müşteri Olarak Devam Et
                        </button>
                    </div>
                </div>
            )}

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

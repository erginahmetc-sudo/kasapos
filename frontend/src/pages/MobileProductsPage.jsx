import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { productsAPI } from '../services/api';

export default function MobileProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        stock_code: '',
        barcode: '',
        price: '',
        stock: '',
        image_url: ''
    });
    const [saving, setSaving] = useState(false);
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
    const html5QrCodeRef = useRef(null);
    const lastScannedRef = useRef('');
    const fileInputRef = useRef(null);

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

    const openEditModal = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name || '',
            stock_code: product.stock_code || '',
            barcode: product.barcode || '',
            price: product.price?.toString() || '',
            stock: product.stock?.toString() || '0',
            image_url: product.image_url || ''
        });
        setShowEditModal(true);
    };

    const handleSave = async () => {
        if (!editingProduct) return;

        setSaving(true);
        try {
            const updateData = {
                name: formData.name,
                barcode: formData.barcode,
                price: parseFloat(formData.price) || 0,
                stock: parseInt(formData.stock) || 0,
                image_url: formData.image_url
            };

            // API uses stock_code as identifier
            const response = await productsAPI.update(editingProduct.stock_code, updateData);

            // API returns data array on success
            if (response.data) {
                alert('Ürün güncellendi!');
                setShowEditModal(false);
                loadProducts();
            } else {
                alert('Hata: Güncelleme başarısız');
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('Güncelleme hatası: ' + (error.response?.data?.message || error.message || 'Bilinmeyen hata'));
        } finally {
            setSaving(false);
        }
    };

    // Barcode Scanner
    const startBarcodeScanner = async () => {
        setShowBarcodeScanner(true);
        lastScannedRef.current = '';

        setTimeout(async () => {
            try {
                const html5QrCode = new Html5Qrcode('product-barcode-scanner');
                html5QrCodeRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText) => {
                        if (decodedText !== lastScannedRef.current) {
                            lastScannedRef.current = decodedText;
                            setFormData(prev => ({ ...prev, barcode: decodedText }));
                            stopBarcodeScanner();
                        }
                    },
                    () => { }
                );
            } catch (err) {
                console.error('Kamera hatası:', err);
                alert('Kamera açılamadı');
                setShowBarcodeScanner(false);
            }
        }, 100);
    };

    const stopBarcodeScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (err) { }
            html5QrCodeRef.current = null;
        }
        setShowBarcodeScanner(false);
    };

    // Image handling with compression
    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const compressedImage = await compressImage(file, 300, 0.6);
            setFormData(prev => ({ ...prev, image_url: compressedImage }));
        } catch (error) {
            console.error('Resim sıkıştırma hatası:', error);
            alert('Resim yüklenirken hata oluştu');
        }
    };

    const compressImage = (file, maxSize, quality) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resize if larger than maxSize
                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round((height * maxSize) / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round((width * maxSize) / height);
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to JPEG with compression
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const removeImage = () => {
        setFormData(prev => ({ ...prev, image_url: '' }));
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
                            onClick={() => openEditModal(product)}
                            className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4 cursor-pointer active:bg-gray-50"
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

            {/* Edit Product Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Ürün Düzenle</h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-3xl text-gray-400 hover:text-gray-600"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Product Image */}
                        <div className="flex flex-col items-center mb-4">
                            {formData.image_url ? (
                                <div className="relative">
                                    <img
                                        src={formData.image_url}
                                        alt="Ürün"
                                        className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200"
                                    />
                                    <button
                                        onClick={removeImage}
                                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full text-lg flex items-center justify-center"
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center text-5xl text-gray-300">
                                    📦
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                className="hidden"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-semibold"
                                >
                                    📷 Resim {formData.image_url ? 'Değiştir' : 'Ekle'}
                                </button>
                                <button
                                    onClick={startBarcodeScanner}
                                    className="px-4 py-2 bg-green-100 text-green-600 rounded-lg text-sm font-semibold"
                                >
                                    🔍 Barkod Okut
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Ürün Adı</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Stok Kodu</label>
                                    <input
                                        type="text"
                                        value={formData.stock_code}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50 text-gray-500"
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Barkod</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            placeholder="Barkod girin"
                                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            onClick={startBarcodeScanner}
                                            className="px-3 py-3 bg-blue-500 text-white rounded-xl text-xl"
                                        >
                                            📷
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Show current barcode */}
                            {formData.barcode && (
                                <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500">Mevcut Barkod</p>
                                    <p className="text-lg font-mono font-bold text-gray-800">{formData.barcode}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Fiyat (TL)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-lg font-bold text-green-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Stok Adedi</label>
                                    <input
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Scanner Modal */}
            {showBarcodeScanner && (
                <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
                    <button
                        onClick={stopBarcodeScanner}
                        className="absolute top-5 right-5 text-4xl text-white"
                    >
                        &times;
                    </button>
                    <div id="product-barcode-scanner" className="w-[90%] max-w-[400px] rounded-xl overflow-hidden"></div>
                    <p className="text-white text-lg mt-4">Barkodu okutun...</p>
                </div>
            )}

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

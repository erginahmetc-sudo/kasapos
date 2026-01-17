import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, salesAPI, customersAPI, shortcutsAPI, heldSalesAPI } from '../services/api';
import { birFaturaAPI } from '../services/birFaturaService';
import { useAuth } from '../context/AuthContext';

export default function POSPage() {
    const { user, logout } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState(['Tümü']);
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedCartIndex, setSelectedCartIndex] = useState(null);
    const [customer, setCustomer] = useState('Toptan Satış');
    const [customers, setCustomers] = useState([]);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showWaitlistModal, setShowWaitlistModal] = useState(false);
    const [heldSales, setHeldSales] = useState([]);
    const [shortcuts, setShortcuts] = useState([]);
    const searchInputRef = useRef(null);
    const [keyboardShortcuts, setKeyboardShortcuts] = useState({});

    // Load Keyboard Shortcuts
    useEffect(() => {
        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) {
            try {
                setKeyboardShortcuts(JSON.parse(saved));
            } catch (e) {
                console.error("Shortcuts parse error", e);
            }
        }
    }, []);

    // Handle Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Find action for key
            const action = Object.keys(keyboardShortcuts).find(key => keyboardShortcuts[key] === e.key);

            if (!action) return;

            // Prevent default for F keys to avoid browser actions
            if (e.key.startsWith('F')) {
                e.preventDefault();
            }

            switch (action) {
                case 'search_focus':
                    searchInputRef.current?.focus();
                    break;
                case 'nakit_odeme':
                    if (cart.length > 0) completeSale('Nakit');
                    break;
                case 'pos_odeme':
                    if (cart.length > 0) completeSale('POS');
                    break;
                case 'miktar_duzenle':
                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                        setModalValue(cart[selectedCartIndex].quantity);
                        setShowQuantityModal(true);
                    }
                    break;
                case 'iskonto_ekle':
                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                        setModalValue(cart[selectedCartIndex].discount_rate || 0);
                        setShowDiscountModal(true);
                    }
                    break;
                case 'fiyat_duzenle':
                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                        setModalValue(cart[selectedCartIndex].price);
                        setShowPriceModal(true);
                    }
                    break;
                case 'musteri_sec':
                    setShowCustomerModal(true);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keyboardShortcuts, cart, selectedCartIndex]);

    // Ask Quantity State
    const [showRetailCustomerModal, setShowRetailCustomerModal] = useState(false);
    const [retailCustomerForm, setRetailCustomerForm] = useState({
        name: '', address: '', phone: '', email: '', tax_office: '', tax_number: ''
    });

    const [showAskQuantityModal, setShowAskQuantityModal] = useState(false);
    const [askQuantityValue, setAskQuantityValue] = useState(1);
    const [productToAdd, setProductToAdd] = useState(null);
    const [modalValue, setModalValue] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Context Menu & Cart Settings State
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });
    const [showCartSettingsModal, setShowCartSettingsModal] = useState(false);
    const [expandedColumn, setExpandedColumn] = useState(null); // For accordion font settings

    // Available font options
    const fontSizes = [
        { value: 'text-xs', label: 'Çok Küçük' },
        { value: 'text-sm', label: 'Küçük' },
        { value: 'text-base', label: 'Normal' },
        { value: 'text-lg', label: 'Büyük' },
        { value: 'text-xl', label: 'Çok Büyük' },
        { value: 'text-2xl', label: 'Dev' }
    ];

    const fontWeights = [
        { value: 'font-normal', label: 'Normal' },
        { value: 'font-medium', label: 'Orta' },
        { value: 'font-semibold', label: 'Yarı Kalın' },
        { value: 'font-bold', label: 'Kalın' },
        { value: 'font-extrabold', label: 'Çok Kalın' }
    ];

    const textColors = [
        { value: 'text-gray-900', label: 'Siyah', hex: '#111827' },
        { value: 'text-gray-600', label: 'Gri', hex: '#4B5563' },
        { value: 'text-red-600', label: 'Kırmızı', hex: '#DC2626' },
        { value: 'text-orange-600', label: 'Turuncu', hex: '#EA580C' },
        { value: 'text-amber-600', label: 'Amber', hex: '#D97706' },
        { value: 'text-yellow-600', label: 'Sarı', hex: '#CA8A04' },
        { value: 'text-lime-600', label: 'Lime', hex: '#65A30D' },
        { value: 'text-green-600', label: 'Yeşil', hex: '#16A34A' },
        { value: 'text-emerald-600', label: 'Zümrüt', hex: '#059669' },
        { value: 'text-teal-600', label: 'Teal', hex: '#0D9488' },
        { value: 'text-cyan-600', label: 'Cyan', hex: '#0891B2' },
        { value: 'text-sky-600', label: 'Gök Mavi', hex: '#0284C7' },
        { value: 'text-blue-600', label: 'Mavi', hex: '#2563EB' },
        { value: 'text-indigo-600', label: 'İndigo', hex: '#4F46E5' },
        { value: 'text-violet-600', label: 'Mor', hex: '#7C3AED' },
        { value: 'text-purple-600', label: 'Eflatun', hex: '#9333EA' },
        { value: 'text-fuchsia-600', label: 'Fuşya', hex: '#C026D3' },
        { value: 'text-pink-600', label: 'Pembe', hex: '#DB2777' },
        { value: 'text-rose-600', label: 'Gül', hex: '#E11D48' }
    ];

    // Cart column visibility settings (loaded from localStorage)
    const defaultColumns = {
        stock_code: { visible: true, label: 'Stok Kodu', color: 'text-indigo-600', bg: 'bg-indigo-50', fontSize: 'text-xs', fontWeight: 'font-medium', textColor: 'text-indigo-600', width: 90 },
        name: { visible: true, label: 'Ürün Adı', color: 'text-emerald-700', bg: 'bg-emerald-50', fontSize: 'text-sm', fontWeight: 'font-semibold', textColor: 'text-emerald-700', width: 140 },
        quantity: { visible: true, label: 'Adet', color: 'text-amber-600', bg: 'bg-amber-50', fontSize: 'text-lg', fontWeight: 'font-bold', textColor: 'text-amber-600', width: 60 },
        price: { visible: true, label: 'Fiyat', color: 'text-blue-600', bg: 'bg-blue-50', fontSize: 'text-sm', fontWeight: 'font-medium', textColor: 'text-blue-600', width: 70 },
        discount: { visible: true, label: 'İsk%', color: 'text-rose-500', bg: 'bg-rose-50', fontSize: 'text-sm', fontWeight: 'font-medium', textColor: 'text-rose-600', width: 50 },
        discounted_price: { visible: true, label: 'İsk.Sonrası', color: 'text-purple-600', bg: 'bg-purple-50', fontSize: 'text-sm', fontWeight: 'font-medium', textColor: 'text-purple-600', width: 80 },
        total: { visible: true, label: 'Toplam', color: 'text-gray-900', bg: 'bg-yellow-100', fontSize: 'text-base', fontWeight: 'font-bold', textColor: 'text-gray-900', width: 90 }
    };

    const [cartColumns, setCartColumns] = useState(() => {
        const saved = localStorage.getItem('pos_cart_columns');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to ensure all properties exist
            const merged = {};
            Object.keys(defaultColumns).forEach(key => {
                merged[key] = { ...defaultColumns[key], ...parsed[key] };
            });
            return merged;
        }
        return defaultColumns;
    });

    // Column resize state
    const [resizingColumn, setResizingColumn] = useState(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [columnWidthsChanged, setColumnWidthsChanged] = useState(false);

    // Save cart column settings to localStorage
    const saveCartColumns = (newColumns) => {
        setCartColumns(newColumns);
        localStorage.setItem('pos_cart_columns', JSON.stringify(newColumns));
    };

    // Toggle column visibility
    const toggleColumn = (columnKey) => {
        const updated = {
            ...cartColumns,
            [columnKey]: { ...cartColumns[columnKey], visible: !cartColumns[columnKey].visible }
        };
        saveCartColumns(updated);
    };

    // Update column font setting
    const updateColumnSetting = (columnKey, settingKey, value) => {
        const updated = {
            ...cartColumns,
            [columnKey]: { ...cartColumns[columnKey], [settingKey]: value }
        };
        saveCartColumns(updated);
    };

    // Get combined font classes for a column
    const getColumnFontClass = (col) => {
        return `${col.fontSize || 'text-sm'} ${col.fontWeight || 'font-normal'} ${col.textColor || 'text-gray-900'}`;
    };

    // Handle column resize start
    const handleResizeStart = (e, columnKey) => {
        e.preventDefault();
        e.stopPropagation();
        setResizingColumn(columnKey);
        setResizeStartX(e.clientX);
        setResizeStartWidth(cartColumns[columnKey].width);
    };

    // Handle column resize move
    useEffect(() => {
        if (!resizingColumn) return;

        const handleMouseMove = (e) => {
            const diff = e.clientX - resizeStartX;
            const newWidth = Math.max(40, resizeStartWidth + diff); // Min 40px
            setCartColumns(prev => ({
                ...prev,
                [resizingColumn]: { ...prev[resizingColumn], width: newWidth }
            }));
            setColumnWidthsChanged(true);
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingColumn, resizeStartX, resizeStartWidth]);

    // Save column widths
    const saveColumnWidths = () => {
        localStorage.setItem('pos_cart_columns', JSON.stringify(cartColumns));
        setColumnWidthsChanged(false);
        setContextMenu({ show: false, x: 0, y: 0 });
    };

    // Handle right-click on cart
    const handleCartContextMenu = (e) => {
        e.preventDefault();
        setContextMenu({ show: true, x: e.clientX, y: e.clientY });
    };

    // Close context menu when clicking elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu({ show: false, x: 0, y: 0 });
        if (contextMenu.show) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu.show]);

    // Get visible columns for grid template
    const visibleColumnsCount = Object.values(cartColumns).filter(c => c.visible).length;
    const getGridCols = () => {
        const cols = [];
        if (cartColumns.stock_code.visible) cols.push(`${cartColumns.stock_code.width}px`);
        if (cartColumns.name.visible) cols.push(`${cartColumns.name.width}px`);
        if (cartColumns.quantity.visible) cols.push(`${cartColumns.quantity.width}px`);
        if (cartColumns.price.visible) cols.push(`${cartColumns.price.width}px`);
        if (cartColumns.discount.visible) cols.push(`${cartColumns.discount.width}px`);
        if (cartColumns.discounted_price.visible) cols.push(`${cartColumns.discounted_price.width}px`);
        if (cartColumns.total.visible) cols.push(`${cartColumns.total.width}px`);
        return cols.join(' ');
    };

    useEffect(() => {
        loadProducts();
        loadCustomers();
        loadHeldSales();
        loadShortcuts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            const data = response.data || {};
            const productList = data.products || [];
            setProducts(productList);
            setProducts(productList);
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

    const loadHeldSales = async () => {
        try {
            const response = await heldSalesAPI.getAll();
            setHeldSales(response.data?.held_sales || []); // FIX: Extract held_sales array
        } catch (error) {
            console.error('Bekleyen satışlar yüklenirken hata:', error);
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

        // Sort by custom order if category selected
        if (selectedCategory !== 'Tümü' && groupItems.length > 0) {
            result.sort((a, b) => {
                const idxA = groupItems.indexOf(a.stock_code);
                const idxB = groupItems.indexOf(b.stock_code);
                return idxA - idxB;
            });
        }

        return result;
    })();

    const handleRetailCustomerChange = (e) => {
        const { name, value } = e.target;
        setRetailCustomerForm(prev => ({ ...prev, [name]: value }));
    };

    const handleRetailCustomerSubmit = (e) => {
        e.preventDefault();
        if (!retailCustomerForm.name.trim()) {
            alert('İsim Soyisim zorunludur!');
            return;
        }
        setCustomer(`${retailCustomerForm.name} (Perakende)`);
        setShowRetailCustomerModal(false);
        setShowCustomerModal(false);
    };

    const addToCart = (product) => {
        const askQty = localStorage.getItem('pos_settings_ask_quantity') === 'true';

        if (askQty) {
            setProductToAdd(product);
            setAskQuantityValue(''); // Start empty or 1? User said "miktarı tuşlayıp...". Empty might be better flow? Or 1 selected?
            // User said "miktarı tuşlayıp enter". If 1 is default, they might just hit enter.
            // Let's set it to '' so they type. Or '1' selected?
            // "Miktar sorsun" implies entering.
            setAskQuantityValue('1');
            setShowAskQuantityModal(true);
            return;
        }

        const existingIndex = cart.findIndex(item => item.stock_code === product.stock_code);
        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += 1;
            setCart(newCart);
        } else {
            setCart([...cart, { ...product, quantity: 1, discount_rate: 0 }]);
        }
    };

    const confirmAddQuantity = (e) => {
        e.preventDefault();
        if (!productToAdd) return;
        const quantity = parseFloat(askQuantityValue) || 1;

        const existingIndex = cart.findIndex(item => item.stock_code === productToAdd.stock_code);
        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += quantity;
            setCart(newCart);
        } else {
            setCart([...cart, { ...productToAdd, quantity: quantity, discount_rate: 0 }]);
        }
        setShowAskQuantityModal(false);
        setProductToAdd(null);
        setBarcodeInput(''); // Clear barcode focus/input
    };

    const handleBarcodeInput = (e) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            const product = products.find(p =>
                p.barcode === barcodeInput.trim() ||
                p.stock_code?.toLowerCase() === barcodeInput.trim().toLowerCase()
            );
            if (product) {
                addToCart(product);
                setBarcodeInput('');
            } else {
                alert('Ürün bulunamadı: ' + barcodeInput);
            }
        }
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index][field] = value;
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
            const price = item.price * item.quantity;
            const discount = price * (item.discount_rate || 0) / 100;
            return sum + (price - discount);
        }, 0);
    };

    const completeSale = async (paymentMethod) => {
        if (cart.length === 0) {
            alert('Sepet boş!');
            return;
        }

        try {
            // Generate unique sale code
            const saleCode = 'SLS-' + Date.now();

            // Find customer object if selected
            const selectedCustomer = customers.find(c => c.name === customer);

            await salesAPI.complete({
                sale_code: saleCode,
                customer: selectedCustomer || null,
                customer_name: !selectedCustomer ? customer : undefined,
                payment_method: paymentMethod,
                items: cart.map(item => ({
                    id: item.id,
                    stock_code: item.stock_code,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    discount_rate: item.discount_rate || 0,
                    amount: item.quantity
                })),
                total: calculateTotal()
            });

            // BirFatura Integration
            const sendToBirFatura = localStorage.getItem('integration_send_sales_to_birfatura') === 'true';
            if (sendToBirFatura) {
                const salePayload = {
                    sale_code: saleCode,
                    customer: selectedCustomer || null,
                    customer_name: !selectedCustomer ? customer : undefined,
                    items: cart.map(item => ({
                        stock_code: item.stock_code,
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    total: calculateTotal()
                };

                birFaturaAPI.createOrder(salePayload).then(result => {
                    if (!result.success) {
                        console.error("BirFatura Error:", result.message);
                        // Optional: alert users or just log. Choosing alert for visibility.
                        alert("BirFatura Entegrasyon Uyarısı: " + result.message);
                    }
                });
            }

            setSuccessMessage('Satış İşlemi Başarılı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setCustomer('Toptan Satış');
            loadProducts();
        } catch (error) {
            alert('Satış hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const holdSale = async () => {
        if (cart.length === 0) {
            alert('Sepet boş!');
            return;
        }
        try {
            await heldSalesAPI.add({ customer, items: cart });
            setSuccessMessage('Satış Beklemeye Alındı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setCustomer('Toptan Satış');
            loadHeldSales();
        } catch (error) {
            alert('Beklemeye alma hatası: ' + (error.response?.data?.message || error.message || 'Bilinmeyen hata'));
        }
    };

    const restoreHeldSale = async (sale) => {
        setCart(sale.items || []);
        setCustomer(sale.customer_name || 'Toptan Satış');
        // Delete held sale after restoring
        try {
            await heldSalesAPI.delete(sale.id);
            loadHeldSales();
        } catch (error) {
            console.error('Bekleyen satış silme hatası:', error);
        }
        setShowWaitlistModal(false);
    };

    const deleteHeldSale = async (saleId) => {
        try {
            await heldSalesAPI.delete(saleId);
            loadHeldSales();
        } catch (error) {
            alert('Silme hatası: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col bg-gray-100 h-[calc(100vh-9rem)] md:h-[calc(100vh-6rem)] overflow-hidden">
            {/* Success Message */}
            {successMessage && (
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-green-500 text-white px-16 py-8  shadow-2xl text-3xl font-bold animate-pulse">
                        {successMessage}
                    </div>
                </div>
            )}

            {/* Header */}


            {/* Main Content */}
            <div className="flex-1 flex gap-3 p-3 overflow-hidden">
                {/* Left Side - Cart */}
                <div className="w-[35%] bg-white  shadow-md p-4 flex flex-col h-full overflow-hidden">
                    {/* Top Bar - Actions & Customer */}
                    <div className="flex gap-1 mb-2">
                        <button
                            onClick={holdSale}
                            className="flex-1 h-14 bg-orange-500 text-white  font-semibold text-sm hover:bg-orange-600 transition-colors flex items-center justify-center"
                        >
                            Beklemeye Al
                        </button>
                        <button
                            onClick={() => setShowWaitlistModal(true)}
                            className="flex-1 h-14 bg-gray-500 text-white  font-semibold text-sm hover:bg-gray-600 transition-colors flex items-center justify-center"
                        >
                            Bekleme Listesi
                        </button>
                        <button
                            onClick={() => setShowCustomerModal(true)}
                            className="flex-1 h-14 bg-blue-400 text-white  font-semibold text-sm hover:bg-blue-500 transition-colors flex items-center justify-center"
                        >
                            Müşteri Seç
                        </button>
                        <div className="flex-[1.5] h-14 bg-gray-100 border border-gray-200  font-semibold text-gray-700 text-sm flex items-center justify-center px-2 truncate">
                            {customer}
                        </div>
                    </div>

                    {/* Barcode Input - Yellow Highlight */}
                    <div className="mb-2">
                        <input
                            type="text"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            onKeyDown={handleBarcodeInput}
                            placeholder="Barkod veya Stok Kodu..."
                            className="w-full px-4 py-3 text-xl font-bold text-gray-800 bg-yellow-100 border-2 border-yellow-200  focus:outline-none focus:border-yellow-400 placeholder-gray-400/70"
                            autoFocus
                        />
                    </div>

                    {/* Cart Table with Context Menu */}
                    <div
                        className="flex-1 border border-gray-300 bg-white flex flex-col min-h-0  overflow-hidden shadow-sm"
                        onContextMenu={handleCartContextMenu}
                    >
                        {/* Header with Resize Handles */}
                        <div
                            className="grid gap-0 bg-gradient-to-r from-slate-100 to-slate-200 border-b border-gray-300 text-xs font-bold text-gray-700 text-center items-center h-10"
                            style={{ gridTemplateColumns: getGridCols() }}
                        >
                            {cartColumns.stock_code.visible && (
                                <div className="relative py-2 border-r border-gray-300 bg-indigo-100 text-indigo-700 select-none">
                                    Stok Kodu
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'stock_code')}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400 transition-colors"
                                    />
                                </div>
                            )}
                            {cartColumns.name.visible && (
                                <div className="relative py-2 border-r border-gray-300 bg-emerald-100 text-emerald-700 select-none">
                                    Ürün Adı
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'name')}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-400 transition-colors"
                                    />
                                </div>
                            )}
                            {cartColumns.quantity.visible && (
                                <div className="relative py-2 border-r border-gray-300 bg-amber-100 text-amber-700 select-none">
                                    Adet
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'quantity')}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400 transition-colors"
                                    />
                                </div>
                            )}
                            {cartColumns.price.visible && (
                                <div className="relative py-2 border-r border-gray-300 bg-blue-100 text-blue-700 select-none">
                                    Fiyat
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'price')}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 transition-colors"
                                    />
                                </div>
                            )}
                            {cartColumns.discount.visible && (
                                <div className="relative py-2 border-r border-gray-300 bg-rose-100 text-rose-600 select-none">
                                    İsk%
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'discount')}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-rose-400 transition-colors"
                                    />
                                </div>
                            )}
                            {cartColumns.discounted_price.visible && (
                                <div className="relative py-2 border-r border-gray-300 bg-purple-100 text-purple-700 select-none">
                                    İsk.Sonrası
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'discounted_price')}
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-purple-400 transition-colors"
                                    />
                                </div>
                            )}
                            {cartColumns.total.visible && (
                                <div className="py-2 bg-yellow-100 text-yellow-800 select-none">
                                    Toplam
                                </div>
                            )}
                        </div>
                        {/* Items */}
                        <div className="flex-1 overflow-y-auto">
                            {cart.map((item, index) => {
                                const subtotal = item.price * item.quantity;
                                const discounted = subtotal * (1 - (item.discount_rate || 0) / 100);
                                return (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedCartIndex(index)}
                                        className={`grid gap-0 border-b border-gray-200 text-sm cursor-pointer transition-all duration-150 ${selectedCartIndex === index ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : 'hover:bg-gray-50'}`}
                                        style={{ gridTemplateColumns: getGridCols() }}
                                    >
                                        {cartColumns.stock_code.visible && (
                                            <div className={`p-2 border-r border-gray-100 truncate ${getColumnFontClass(cartColumns.stock_code)} ${selectedCartIndex === index ? '' : cartColumns.stock_code.bg}`}>
                                                {item.stock_code}
                                            </div>
                                        )}
                                        {cartColumns.name.visible && (
                                            <div className={`p-2 border-r border-gray-100 truncate ${getColumnFontClass(cartColumns.name)} ${selectedCartIndex === index ? '' : cartColumns.name.bg}`}>
                                                {item.name}
                                            </div>
                                        )}
                                        {cartColumns.quantity.visible && (
                                            <div className={`p-2 border-r border-gray-100 text-center ${getColumnFontClass(cartColumns.quantity)} ${selectedCartIndex === index ? '' : cartColumns.quantity.bg}`}>
                                                {item.quantity}
                                            </div>
                                        )}
                                        {cartColumns.price.visible && (
                                            <div className={`p-2 border-r border-gray-100 text-right ${getColumnFontClass(cartColumns.price)} ${selectedCartIndex === index ? '' : cartColumns.price.bg}`}>
                                                {item.price?.toFixed(2)}
                                            </div>
                                        )}
                                        {cartColumns.discount.visible && (
                                            <div className={`p-2 border-r border-gray-100 text-center ${getColumnFontClass(cartColumns.discount)} ${selectedCartIndex === index ? '' : cartColumns.discount.bg}`}>
                                                {item.discount_rate || 0}%
                                            </div>
                                        )}
                                        {cartColumns.discounted_price.visible && (
                                            <div className={`p-2 border-r border-gray-100 text-right ${getColumnFontClass(cartColumns.discounted_price)} ${selectedCartIndex === index ? '' : cartColumns.discounted_price.bg}`}>
                                                {(item.price * (1 - (item.discount_rate || 0) / 100)).toFixed(2)}
                                            </div>
                                        )}
                                        {cartColumns.total.visible && (
                                            <div className={`p-2 text-right ${getColumnFontClass(cartColumns.total)} ${selectedCartIndex === index ? '' : cartColumns.total.bg}`}>
                                                {discounted.toFixed(2)} ₺
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Context Menu */}
                    {contextMenu.show && (
                        <div
                            className="fixed bg-white  shadow-2xl border border-gray-200 py-2 z-50 min-w-52 overflow-hidden"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                        >
                            <button
                                onClick={() => {
                                    setContextMenu({ show: false, x: 0, y: 0 });
                                    setShowCartSettingsModal(true);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 flex items-center gap-3 transition-all duration-200"
                            >
                                <span className="text-xl">⚙️</span>
                                <span className="font-medium text-gray-700">Sepeti Düzenle</span>
                            </button>
                            {columnWidthsChanged && (
                                <>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                        onClick={saveColumnWidths}
                                        className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 flex items-center gap-3 transition-all duration-200"
                                    >
                                        <span className="text-xl">�</span>
                                        <span className="font-medium text-green-700">Sütun Genişliğini Kaydet</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-2 space-y-2">
                        {/* Total Bar */}
                        <div className="bg-yellow-400 p-2  flex justify-between items-center px-4">
                            <span className="font-bold text-gray-900 text-lg">TOPLAM:</span>
                            <span className="font-bold text-gray-900 text-2xl">{calculateTotal().toFixed(2)} TL</span>
                        </div>

                        {/* Action Buttons (Gray) */}
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                onClick={() => { if (selectedCartIndex !== null) { setModalValue(cart[selectedCartIndex].quantity); setShowQuantityModal(true); } }}
                                disabled={selectedCartIndex === null}
                                className="h-14 bg-gray-200 text-gray-800  font-bold text-base hover:bg-gray-300 disabled:opacity-50 flex flex-col items-center justify-center leading-tight transition-all"
                            >
                                Adet<br />Değiştir
                            </button>
                            <button
                                onClick={() => { if (selectedCartIndex !== null) { setModalValue(cart[selectedCartIndex].discount_rate || 0); setShowDiscountModal(true); } }}
                                disabled={selectedCartIndex === null}
                                className="h-14 bg-gray-200 text-gray-800  font-bold text-base hover:bg-gray-300 disabled:opacity-50 flex flex-col items-center justify-center leading-tight transition-all"
                            >
                                İskonto<br />Uygula
                            </button>
                            <button
                                onClick={() => { if (selectedCartIndex !== null) { setModalValue(cart[selectedCartIndex].price); setShowPriceModal(true); } }}
                                disabled={selectedCartIndex === null}
                                className="h-14 bg-gray-200 text-gray-800  font-bold text-base hover:bg-gray-300 disabled:opacity-50 flex flex-col items-center justify-center leading-tight transition-all"
                            >
                                Fiyat<br />Düzenle
                            </button>
                            <button
                                onClick={() => { if (selectedCartIndex !== null) removeFromCart(selectedCartIndex); }}
                                disabled={selectedCartIndex === null}
                                className="h-14 bg-gray-200 text-gray-800  font-bold text-base hover:bg-gray-300 disabled:opacity-50 flex flex-col items-center justify-center leading-tight transition-all"
                            >
                                Satırı<br />Sil
                            </button>
                        </div>

                        {/* Payment Buttons (Colored) */}
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                onClick={() => completeSale('Nakit')}
                                className="h-14 bg-green-500 text-white  font-bold text-2xl hover:bg-green-600 shadow-lg hover:shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center"
                            >
                                Nakit
                            </button>
                            <button
                                onClick={() => completeSale('POS')}
                                className="h-14 bg-blue-600 text-white  font-bold text-2xl hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center"
                            >
                                Kredi Kartı
                            </button>
                            <button
                                onClick={() => completeSale('Açık Hesap')}
                                className="h-14 bg-orange-500 text-white  font-bold text-2xl hover:bg-orange-600 shadow-lg hover:shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center"
                            >
                                Veresiye
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm('Sepeti temizlemek istiyor musunuz?')) {
                                        setCart([]);
                                        setCustomer('Toptan Satış');
                                    }
                                }}
                                className="h-14 bg-red-600 text-white  font-bold text-2xl hover:bg-red-700 shadow-lg hover:shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center"
                            >
                                İptal Et
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side - Products */}
                <div className="w-[65%] bg-white  shadow-md p-4 flex flex-col h-full overflow-hidden">
                    {/* Search - Modern 2026 Design */}
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative group">
                            {/* Gradient Border Effect */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500  blur opacity-30 group-hover:opacity-60 group-focus-within:opacity-100 transition-all duration-500"></div>

                            {/* Main Input Container */}
                            <div className="relative flex items-center bg-white/90 backdrop-blur-xl  border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden">
                                {/* Search Icon */}
                                <div className="pl-5 pr-2">
                                    <svg className="w-6 h-6 text-gray-400 group-focus-within:text-violet-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                {/* Input Field */}
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Ürün Ara..."
                                    className="flex-1 py-4 pr-5 bg-transparent text-gray-800 text-lg font-medium placeholder:text-gray-400 placeholder:text-center focus:outline-none focus:placeholder:text-violet-400 transition-all duration-300"
                                />

                                {/* Clear Button (shows when there's text) */}
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="pr-4 text-gray-400 hover:text-violet-500 transition-colors duration-200"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Barkod Button - Modern Style */}
                        <button className="px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white  font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            Barkod Oku
                        </button>
                    </div>

                    {/* Categories */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 mb-3">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`p-3 h-20 border-2  font-bold text-sm text-center transition-all ${selectedCategory === cat
                                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                                    : 'bg-white border-gray-200 hover:border-blue-500 hover:text-blue-500'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-0 content-start">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id || product.stock_code}
                                onClick={() => addToCart(product)}
                                className="h-28 border border-gray-200  cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden bg-white"
                            >
                                {product.image_url ? (
                                    <img src={product.image_url} alt="" className="absolute inset-0 w-full h-full object-contain p-1" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-4xl text-gray-300">📦</div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center">
                                    <div className="text-xs font-semibold p-1 line-clamp-2">{product.name}</div>
                                    <div className="text-sm font-bold pb-1">{product.price?.toFixed(2)} TL</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Customer Modal - Modern Design */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white  w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header with Gradient */}
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-6 py-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm  flex items-center justify-center">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Musteri Sec</h3>
                                        <p className="text-white/80 text-sm">{customers.length} kayitli musteri</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRetailCustomerModal(true)}
                                    className="ml-auto mr-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold  transition-colors text-sm shadow-lg shadow-orange-500/30 whitespace-nowrap"
                                >
                                    Perakende Müşteri İsmi Gir
                                </button>
                                <button
                                    onClick={() => setShowCustomerModal(false)}
                                    className="w-10 h-10 bg-white/20 hover:bg-white/30  flex items-center justify-center transition-all"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="mt-4 relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Musteri ara..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm text-white placeholder-blue-200  border border-white/30 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
                            {/* Quick Select - Toptan Satış */}
                            <div
                                onClick={() => { setCustomer('Toptan Satis'); setShowCustomerModal(false); }}
                                className="mb-3 p-4 bg-gradient-to-r from-emerald-500 to-green-500  cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20  flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-white font-bold text-lg truncate">Toptan Satis</h4>
                                        <p className="text-white/80 text-sm truncate">Varsayilan satis tipi</p>
                                    </div>
                                    <svg className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>

                            {customers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 -full flex items-center justify-center mb-4">
                                        <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-700 mb-2">Musteri Bulunamadi</h4>
                                    <p className="text-gray-500 max-w-xs">Henuz kayitli musteri yok. Musteriler sayfasindan yeni musteri ekleyebilirsiniz.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {customers.map((c, index) => (
                                        <div
                                            key={c.id}
                                            onClick={() => { setCustomer(c.name); setShowCustomerModal(false); }}
                                            className="bg-white  border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden group"
                                        >
                                            <div className="p-4 flex items-center gap-4">
                                                {/* Avatar */}
                                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500  flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                                    <span className="text-white font-bold text-lg">
                                                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </span>
                                                </div>

                                                {/* Customer Info */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600 transition-colors">
                                                        {c.name}
                                                    </h4>
                                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                                        {c.phone && (
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                                </svg>
                                                                {c.phone}
                                                            </span>
                                                        )}
                                                        {c.address && (
                                                            <span className="flex items-center gap-1 truncate">
                                                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                <span className="truncate">{c.address}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Balance */}
                                                {c.balance !== undefined && c.balance !== 0 && (
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={`text-lg font-bold ${c.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                            {Math.abs(c.balance).toFixed(2)}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{c.balance > 0 ? 'Borc' : 'Alacak'}</p>
                                                    </div>
                                                )}

                                                {/* Arrow */}
                                                <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80 backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Secili: <span className="font-bold text-gray-800">{customer}</span>
                                </p>
                                <button
                                    onClick={() => setShowCustomerModal(false)}
                                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold  hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quantity Modal */}
            {showQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white  p-8 w-96 text-center">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Miktar Düzenle</h3>
                        <p className="text-gray-500 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-3xl text-center border-2 border-blue-500  mb-4 focus:outline-none"
                            min="1"
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1)}
                            className="w-full p-4 bg-blue-500 text-white text-xl font-semibold  hover:bg-blue-600"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white  p-8 w-96 text-center">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">İskonto Ekle (%)</h3>
                        <p className="text-gray-500 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-3xl text-center border-2 border-blue-500  mb-4 focus:outline-none"
                            min="0"
                            max="100"
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0)}
                            className="w-full p-4 bg-blue-500 text-white text-xl font-semibold  hover:bg-blue-600"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Price Modal */}
            {showPriceModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white  p-8 w-96 text-center">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Fiyat Düzenle</h3>
                        <p className="text-gray-500 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            step="0.01"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-3xl text-center border-2 border-blue-500  mb-4 focus:outline-none"
                            min="0"
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0)}
                            className="w-full p-4 bg-blue-500 text-white text-xl font-semibold  hover:bg-blue-600"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Waitlist Modal - Modern Design */}
            {showWaitlistModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white  w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header with Gradient */}
                        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-6 py-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm  flex items-center justify-center">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Bekleme Listesi</h3>
                                        <p className="text-white/80 text-sm">{heldSales.length} adet bekleyen satis</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowWaitlistModal(false)}
                                    className="w-10 h-10 bg-white/20 hover:bg-white/30  flex items-center justify-center transition-all"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
                            {heldSales.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 -full flex items-center justify-center mb-6">
                                        <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-700 mb-2">Bekleyen Satis Yok</h4>
                                    <p className="text-gray-500 max-w-xs">Bir satisi beklemeye almak icin sepete urun ekleyip "Beklemeye Al" butonuna basin.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {heldSales.map((sale, index) => {
                                        const saleTotal = sale.items?.reduce((sum, item) => {
                                            const price = item.price * item.quantity;
                                            const discount = price * (item.discount_rate || 0) / 100;
                                            return sum + (price - discount);
                                        }, 0) || 0;
                                        const createdAt = sale.created_at ? new Date(sale.created_at) : null;
                                        const timeAgo = createdAt ? Math.round((Date.now() - createdAt.getTime()) / 60000) : null;

                                        return (
                                            <div
                                                key={sale.id}
                                                className="bg-white  border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
                                            >
                                                {/* Card Header */}
                                                <div className="p-4 flex items-center gap-4">
                                                    {/* Order Number Badge */}
                                                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500  flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
                                                        <span className="text-white font-bold text-lg">#{index + 1}</span>
                                                    </div>

                                                    {/* Customer & Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-gray-800 text-lg truncate">
                                                                {sale.customer_name || 'Genel Musteri'}
                                                            </h4>
                                                            {timeAgo !== null && timeAgo < 60 && (
                                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium -full">
                                                                    Yeni
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                                </svg>
                                                                {sale.items?.length || 0} urun
                                                            </span>
                                                            {timeAgo !== null && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    {timeAgo < 60 ? `${timeAgo} dk once` : `${Math.round(timeAgo / 60)} saat once`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Total Amount */}
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                                            {saleTotal.toFixed(2)}
                                                        </p>
                                                        <p className="text-sm text-gray-500 font-medium">TL</p>
                                                    </div>
                                                </div>

                                                {/* Products Preview - Collapsible */}
                                                <div className="px-4 pb-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {sale.items?.slice(0, 3).map((item, idx) => (
                                                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs  truncate max-w-[140px]">
                                                                {item.quantity}x {item.name}
                                                            </span>
                                                        ))}
                                                        {sale.items?.length > 3 && (
                                                            <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs  font-medium">
                                                                +{sale.items.length - 3} daha
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex border-t border-gray-100">
                                                    <button
                                                        onClick={() => restoreHeldSale(sale)}
                                                        className="flex-1 py-3.5 text-green-600 font-bold hover:bg-green-50 transition-colors flex items-center justify-center gap-2 text-base"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        Geri Yukle
                                                    </button>
                                                    <div className="w-px bg-gray-100"></div>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Bu bekleyen satisi silmek istediginize emin misiniz?')) {
                                                                deleteHeldSale(sale.id);
                                                            }
                                                        }}
                                                        className="flex-1 py-3.5 text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-base"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Sil
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {heldSales.length > 0 && (
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80 backdrop-blur-sm">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-500">
                                        Toplam bekleyen tutar: <span className="font-bold text-gray-800">
                                            {heldSales.reduce((total, sale) => {
                                                return total + (sale.items?.reduce((sum, item) => {
                                                    const price = item.price * item.quantity;
                                                    const discount = price * (item.discount_rate || 0) / 100;
                                                    return sum + (price - discount);
                                                }, 0) || 0);
                                            }, 0).toFixed(2)} TL
                                        </span>
                                    </p>
                                    <button
                                        onClick={() => setShowWaitlistModal(false)}
                                        className="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold  hover:bg-gray-300 transition-colors"
                                    >
                                        Kapat
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Ask Quantity Modal */}
            {showAskQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white  p-6 w-96 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Miktar Giriniz</h3>
                        <div className="mb-2 text-center font-medium text-gray-600">{productToAdd?.name}</div>
                        <form onSubmit={confirmAddQuantity}>
                            <input
                                type="number"
                                value={askQuantityValue}
                                onChange={(e) => setAskQuantityValue(e.target.value)}
                                className="w-full p-4 text-3xl text-center border-2 border-blue-500  mb-4 focus:outline-none font-bold"
                                min="0.01"
                                step="any"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                            />
                            <button
                                type="submit"
                                className="w-full p-4 bg-green-500 text-white text-xl font-bold  hover:bg-green-600 transition-colors"
                            >
                                Ekle (Enter)
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Retail Customer Modal */}
            {showRetailCustomerModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white  w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6">
                            <h3 className="text-2xl font-bold text-white">Perakende Müşteri Bilgileri</h3>
                            <p className="text-orange-100 text-sm mt-1">Hızlı satış için müşteri detaylarını giriniz</p>
                        </div>
                        <form onSubmit={handleRetailCustomerSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    İsim Soyisim <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={retailCustomerForm.name}
                                    onChange={handleRetailCustomerChange}
                                    className="w-full px-4 py-3  border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="Müşteri Adı"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Telefon</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={retailCustomerForm.phone}
                                        onChange={handleRetailCustomerChange}
                                        className="w-full px-4 py-3  border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                        placeholder="05..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">E-Posta</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={retailCustomerForm.email}
                                        onChange={handleRetailCustomerChange}
                                        className="w-full px-4 py-3  border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                        placeholder="ornek@mail.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Adres</label>
                                <textarea
                                    name="address"
                                    value={retailCustomerForm.address}
                                    onChange={handleRetailCustomerChange}
                                    rows="2"
                                    className="w-full px-4 py-3  border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all resize-none"
                                    placeholder="Adres detayları..."
                                ></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Vergi Dairesi</label>
                                    <input
                                        type="text"
                                        name="tax_office"
                                        value={retailCustomerForm.tax_office}
                                        onChange={handleRetailCustomerChange}
                                        className="w-full px-4 py-3  border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                        placeholder="Vergi Dairesi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Vergi Numarası</label>
                                    <input
                                        type="text"
                                        name="tax_number"
                                        value={retailCustomerForm.tax_number}
                                        onChange={handleRetailCustomerChange}
                                        className="w-full px-4 py-3  border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                        placeholder="Vergi No"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRetailCustomerModal(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold  hover:bg-gray-200 transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold  hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Tamamla
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cart Settings Modal */}
            {showCartSettingsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white  shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6 flex-shrink-0">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <span>⚙️</span> Sepeti Düzenle
                                </h3>
                                <button
                                    onClick={() => { setShowCartSettingsModal(false); setExpandedColumn(null); }}
                                    className="text-white/80 hover:text-white text-3xl transition-colors"
                                >
                                    ×
                                </button>
                            </div>
                            <p className="text-white/70 text-sm mt-2">Sütun görünürlüğü ve font ayarlarını yapılandırın</p>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {Object.entries(cartColumns).map(([key, col]) => (
                                <div key={key} className="border border-gray-200  overflow-hidden">
                                    {/* Column Header Row */}
                                    <div
                                        className={`flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 ${col.visible ? 'bg-violet-50' : 'bg-gray-50'}`}
                                    >
                                        {/* Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={col.visible}
                                            onChange={() => toggleColumn(key)}
                                            className="w-5 h-5 text-violet-600  focus:ring-violet-500 focus:ring-2"
                                        />

                                        {/* Label */}
                                        <span className={`flex-1 font-medium ${col.visible ? 'text-violet-700' : 'text-gray-500'}`}>
                                            {col.label}
                                        </span>

                                        {/* Font Preview */}
                                        <div
                                            className={`px-3 py-1  bg-white border shadow-sm ${getColumnFontClass(col)}`}
                                        >
                                            Örnek
                                        </div>

                                        {/* Expand/Collapse Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedColumn(expandedColumn === key ? null : key);
                                            }}
                                            className={`p-2  transition-all duration-200 ${expandedColumn === key ? 'bg-violet-200 text-violet-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            title="Font Ayarları"
                                        >
                                            <svg className={`w-5 h-5 transition-transform duration-200 ${expandedColumn === key ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Expanded Font Settings Panel */}
                                    {expandedColumn === key && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
                                            {/* Font Size */}
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                    <span>📏</span> Yazı Büyüklüğü
                                                </label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {fontSizes.map(size => (
                                                        <button
                                                            key={size.value}
                                                            onClick={() => updateColumnSetting(key, 'fontSize', size.value)}
                                                            className={`py-2 px-3  text-sm font-medium transition-all ${col.fontSize === size.value
                                                                ? 'bg-violet-500 text-white shadow-md'
                                                                : 'bg-white border border-gray-200 text-gray-700 hover:border-violet-300'}`}
                                                        >
                                                            {size.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Font Weight */}
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                    <span>🔤</span> Kalın Yazı
                                                </label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {fontWeights.map(weight => (
                                                        <button
                                                            key={weight.value}
                                                            onClick={() => updateColumnSetting(key, 'fontWeight', weight.value)}
                                                            className={`py-2 px-3  text-sm transition-all ${col.fontWeight === weight.value
                                                                ? 'bg-violet-500 text-white shadow-md'
                                                                : 'bg-white border border-gray-200 text-gray-700 hover:border-violet-300'}`}
                                                            style={{ fontWeight: weight.value.replace('font-', '') }}
                                                        >
                                                            {weight.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Text Color */}
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                    <span>🎨</span> Yazı Rengi
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {textColors.map(color => (
                                                        <button
                                                            key={color.value}
                                                            onClick={() => updateColumnSetting(key, 'textColor', color.value)}
                                                            className={`w-8 h-8 -full border-2 transition-all hover:scale-110 ${col.textColor === color.value
                                                                ? 'border-gray-800 ring-2 ring-violet-400 ring-offset-2'
                                                                : 'border-gray-300'}`}
                                                            style={{ backgroundColor: color.hex }}
                                                            title={color.label}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 flex gap-3 flex-shrink-0 bg-white">
                            <button
                                onClick={() => { saveCartColumns(defaultColumns); setExpandedColumn(null); }}
                                className="flex-1 py-3 bg-gray-100 text-gray-700  font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Varsayılana Dön
                            </button>
                            <button
                                onClick={() => { setShowCartSettingsModal(false); setExpandedColumn(null); }}
                                className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white  font-semibold hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg"
                            >
                                Tamam
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .menu-btn {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          background-color: #e9f2ff;
          color: #007bff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          text-decoration: none;
        }
        .menu-btn:hover {
          background-color: #007bff;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
      `}</style>
        </div>
    );
}


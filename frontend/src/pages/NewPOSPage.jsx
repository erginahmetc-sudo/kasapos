import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productsAPI, salesAPI, customersAPI, shortcutsAPI, heldSalesAPI, settingsAPI } from '../services/api';
import { birFaturaAPI } from '../services/birFaturaService';
import { useAuth } from '../context/AuthContext';
import defaultTemplate from '../data/default_receipt_template.json';
import template80mm from '../data/receipt_template_80mm.json';
import template58mm from '../data/receipt_template_58mm.json';

// Mobile detection hook
function useMobileRedirect() {
    const navigate = useNavigate();

    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                navigate('/mobile-pos', { replace: true });
            }
        };

        // Check on mount
        checkMobile();

        // Optional: check on resize
        // window.addEventListener('resize', checkMobile);
        // return () => window.removeEventListener('resize', checkMobile);
    }, [navigate]);
}

// Product Card Component to handle Image State separately
const ProductCard = memo(({ product, onAddToCart }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            onClick={() => onAddToCart(product)}
            className="h-full bg-white rounded-xl border border-slate-200 p-2 shadow-sm hover:shadow-lg hover:border-blue-600/30 hover:-translate-y-0.5 transition-all group flex flex-col cursor-pointer"
        >
            <div className="w-full h-24 rounded-lg bg-slate-50 overflow-hidden relative flex-shrink-0 border border-slate-100 mb-1">
                {!imgError ? (
                    <img
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        src={product.image_url || 'https://via.placeholder.com/150'}
                        onError={() => setImgError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                        <span className="material-symbols-outlined text-3xl">image</span>
                        <span className="text-[10px] font-medium">Görsel Yok</span>
                    </div>
                )}
            </div>
            <div className="flex flex-col flex-1 px-1">
                {/* Fixed height for 2 lines of text to ensure alignment */}
                <h3 className="text-sm font-bold text-slate-700 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                </h3>
                <span className="text-base font-extrabold text-red-600 leading-none mt-0.5">{product.price?.toFixed(2)} ₺</span>
            </div>
        </div>
    );
});

export default function NewPOSPage() {
    // Mobile redirect
    useMobileRedirect();

    const { user, logout } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState(['Tümü']);
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [cart, setCart] = useState([]);
    const cartRef = useRef(cart); // Ref to hold latest cart
    const [selectedCartIndex, setSelectedCartIndex] = useState(null);
    const [customer, setCustomer] = useState('Toptan Satış');
    const [customers, setCustomers] = useState([]);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');

    // Modals
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showWaitlistModal, setShowWaitlistModal] = useState(false);

    const [heldSales, setHeldSales] = useState([]);
    const [shortcuts, setShortcuts] = useState([]);
    const searchInputRef = useRef(null);
    const [keyboardShortcuts, setKeyboardShortcuts] = useState({});

    // Retail Customer Logic
    const [showRetailCustomerModal, setShowRetailCustomerModal] = useState(false);
    const defaultRetailForm = {
        name: '',
        address: 'Fatih mh.',
        phone: '',
        email: '',
        tax_office: '',
        tax_number: '11111111111'
    };
    const [retailCustomerForm, setRetailCustomerForm] = useState(defaultRetailForm);

    // Ask Quantity Logic
    const [showAskQuantityModal, setShowAskQuantityModal] = useState(false);
    const [askQuantityValue, setAskQuantityValue] = useState(1);
    const [productToAdd, setProductToAdd] = useState(null);
    const [modalValue, setModalValue] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Cart Settings (Simplified for new design - mostly unused but keeping for compatibility)
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });

    // Undefined Product Logic
    const [showUndefinedProductModal, setShowUndefinedProductModal] = useState(false);
    const [undefinedProductStep, setUndefinedProductStep] = useState(0); // 0: Name, 1: Qty, 2: Price
    const [undefinedProductData, setUndefinedProductData] = useState({ name: '', quantity: 1, price: '' });
    const undefinedNameRef = useRef(null);
    const undefinedQtyRef = useRef(null);
    const undefinedPriceRef = useRef(null);

    // Sync cartRef with cart state
    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    // Load Data
    useEffect(() => {
        loadProducts();
        loadCustomers();
        loadHeldSales();
        loadShortcuts();
        loadSettings();

        // Load Shortcuts
        const defaultShortcuts = {
            'miktar_duzenle': 'F2',
            'iskonto_ekle': 'F3',
            'fiyat_duzenle': 'F4',
            'nakit_odeme': 'F8',
            'pos_odeme': 'F9',
            'musteri_sec': 'F10',
            'search_focus': 'F1',
            'tanimsiz_urun': 'Insert'
        };

        // Listen for shortcut updates
        const handleShortcutUpdate = () => {
            const saved = localStorage.getItem('pos_keyboard_shortcuts');
            if (saved) {
                try {
                    setKeyboardShortcuts({ ...defaultShortcuts, ...JSON.parse(saved) });
                } catch (e) {
                    console.error("Shortcuts parse error", e);
                }
            } else {
                setKeyboardShortcuts(defaultShortcuts);
            }
        };

        window.addEventListener('shortcutsUpdated', handleShortcutUpdate);

        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) {
            try {
                setKeyboardShortcuts({ ...defaultShortcuts, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Shortcuts parse error", e);
                setKeyboardShortcuts(defaultShortcuts);
            }
        } else {
            setKeyboardShortcuts(defaultShortcuts);
        }

        return () => {
            window.removeEventListener('shortcutsUpdated', handleShortcutUpdate);
        };
    }, []);

    // Helper Functions
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

    const loadHeldSales = async () => {
        try {
            const response = await heldSalesAPI.getAll();
            setHeldSales(response.data?.held_sales || []);
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

    const loadSettings = async () => {
        try {
            const { data } = await settingsAPI.getAll();
            if (data && data.pos_settings_ask_quantity !== undefined) {
                // Update localStorage so addToCart can use it synchronously
                localStorage.setItem('pos_settings_ask_quantity', data.pos_settings_ask_quantity);
            }
        } catch (error) {
            console.error('Ayarlar yüklenirken hata:', error);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Handle +/- for quantity on selected item
            if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                if (e.key === '+' || e.key === 'Add') {
                    e.preventDefault();
                    updateCartItem(selectedCartIndex, 'quantity', cart[selectedCartIndex].quantity + 1);
                    return;
                }
                if (e.key === '-' || e.key === 'Subtract') {
                    e.preventDefault();
                    const newQty = cart[selectedCartIndex].quantity - 1;
                    if (newQty >= 1) {
                        updateCartItem(selectedCartIndex, 'quantity', newQty);
                    }
                    return;
                }
            }

            const action = Object.keys(keyboardShortcuts).find(key => keyboardShortcuts[key] === e.key);
            if (!action) return;
            if (e.key.startsWith('F')) e.preventDefault();

            switch (action) {
                case 'search_focus': searchInputRef.current?.focus(); break;
                case 'nakit_odeme': if (cart.length > 0) completeSale('Nakit'); break;
                case 'pos_odeme': if (cart.length > 0) completeSale('POS'); break;
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
                case 'musteri_sec': setShowCustomerModal(true); break;
                case 'tanimsiz_urun':
                    setUndefinedProductData({ name: '', quantity: 1, price: '' });
                    setUndefinedProductStep(0);
                    setShowUndefinedProductModal(true);
                    setTimeout(() => undefinedNameRef.current?.focus(), 100);
                    break;
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keyboardShortcuts, cart, selectedCartIndex]);

    // Auto-scroll to selected item
    const cartItemsRef = useRef([]);
    useEffect(() => {
        if (selectedCartIndex !== null && cartItemsRef.current[selectedCartIndex]) {
            cartItemsRef.current[selectedCartIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedCartIndex]);

    // Filtering (Memoized)
    const filteredProducts = useMemo(() => {
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
    }, [products, selectedCategory, searchTerm, shortcuts]);

    // Handlers
    const addToCart = useCallback((product) => {
        const askQty = localStorage.getItem('pos_settings_ask_quantity') === 'true';
        if (askQty) {
            setProductToAdd(product);
            setAskQuantityValue('1');
            setShowAskQuantityModal(true);
            return;
        }

        const currentCart = cartRef.current;
        const existingIndex = currentCart.findIndex(item => item.stock_code === product.stock_code);

        if (existingIndex >= 0) {
            const newCart = [...currentCart];
            newCart[existingIndex] = {
                ...newCart[existingIndex],
                quantity: newCart[existingIndex].quantity + 1
            };
            setCart(newCart);
            setSelectedCartIndex(existingIndex);
        } else {
            setCart([...currentCart, { ...product, quantity: 1, discount_rate: 0 }]);
            setSelectedCartIndex(currentCart.length);
        }
    }, []); // Empty dependency array = Stable Reference!

    const confirmAddQuantity = (e) => {
        e.preventDefault();
        if (!productToAdd) return;
        const quantity = parseFloat(askQuantityValue) || 1;
        const existingIndex = cart.findIndex(item => item.stock_code === productToAdd.stock_code);
        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += quantity;
            setCart(newCart);
            setSelectedCartIndex(existingIndex);
        } else {
            setCart([...cart, { ...productToAdd, quantity: quantity, discount_rate: 0 }]);
            setSelectedCartIndex(cart.length);
        }
        setShowAskQuantityModal(false);
        setProductToAdd(null);
        setBarcodeInput('');
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
        const newCart = cart.filter((_, i) => i !== index);
        setCart(newCart);
        if (selectedCartIndex === index) setSelectedCartIndex(null);
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => {
            const price = item.price * item.quantity;
            const discount = price * (item.discount_rate || 0) / 100;
            return sum + (price - discount);
        }, 0);
    };

    const handleRetailCustomerSubmit = (e) => {
        e.preventDefault();
        if (!retailCustomerForm.name.trim()) return alert('İsim Soyisim zorunludur!');
        setCustomer(`${retailCustomerForm.name.trim()} (Perakende)`);
        setShowRetailCustomerModal(false);
        setShowCustomerModal(false);
    };

    const handleRetailCustomerChange = (e) => {
        const { name, value } = e.target;
        setRetailCustomerForm(prev => ({ ...prev, [name]: value }));
    };

    const completeSale = async (paymentMethod) => {
        if (cart.length === 0) return alert('Sepet boş!');
        try {
            const saleCode = 'SLS-' + Date.now();
            const selectedCustomer = customers.find(c => c.name === customer);
            const cleanCustomerName = (customer || 'Toptan Satış').replace(/ \(Perakende\)$/i, '').trim();

            await salesAPI.complete({
                sale_code: saleCode,
                customer: selectedCustomer || null,
                customer_name: !selectedCustomer ? cleanCustomerName : undefined,
                payment_method: paymentMethod,
                items: cart.map(item => ({
                    id: item.id, stock_code: item.stock_code, barcode: item.barcode, name: item.name,
                    quantity: item.quantity, price: item.price, discount_rate: item.discount_rate || 0,
                    amount: item.quantity
                })),
                total: calculateTotal()
            });

            if (localStorage.getItem('integration_send_sales_to_birfatura') === 'true') {
                birFaturaAPI.createOrder({
                    sale_code: saleCode,
                    customer: selectedCustomer || null,
                    customer_name: !selectedCustomer ? cleanCustomerName : undefined,
                    items: cart.map(item => ({ stock_code: item.stock_code, name: item.name, quantity: item.quantity, price: item.price })),
                    total: calculateTotal()
                }).then(res => { if (!res.success) alert("BirFatura Hatası: " + res.message); });
            }

            if (localStorage.getItem('receipt_auto_print') === 'true') {
                printReceipt({
                    customer: customer, paymentMethod: paymentMethod, items: cart,
                    total: calculateTotal(), customerData: selectedCustomer
                });
            }

            setSuccessMessage('Satış İşlemi Başarılı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setCustomer('Toptan Satış');
            setRetailCustomerForm(defaultRetailForm);
            loadProducts();
        } catch (error) {
            alert('Satış hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const holdSale = async () => {
        if (cart.length === 0) return alert('Sepet boş!');
        try {
            await heldSalesAPI.add({ customer, items: cart });
            setSuccessMessage('Satış Beklemeye Alındı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setCustomer('Toptan Satış');
            loadHeldSales();
        } catch (error) {
            alert('Beklemeye alma hatası: ' + error.message);
        }
    };

    const restoreHeldSale = async (sale) => {
        setCart(sale.items || []);
        setCustomer(sale.customer_name || 'Toptan Satış');
        try { await heldSalesAPI.delete(sale.id); loadHeldSales(); }
        catch (error) { console.error(error); }
        setShowWaitlistModal(false);
    };

    const deleteHeldSale = async (saleId) => {
        try { await heldSalesAPI.delete(saleId); loadHeldSales(); }
        catch (error) { alert('Silme hatası: ' + error.message); }
    };

    // Paper size dimensions in pixels (for print)
    const PAPER_SIZES = {
        'A5 (148x210mm)': { width: 420, height: 595 },
        'A4 (210x297mm)': { width: 595, height: 842 },
        'Termal 80mm': { width: 280, height: 'auto' },
        'Termal 58mm': { width: 200, height: 'auto' },
    };

    // Print Receipt Function - Uses saved template or default template
    const printReceipt = (saleData) => {
        // Get selected paper size
        const paperSize = localStorage.getItem('receipt_paper_size') || 'Termal 80mm';

        // Use dynamic template for ALL paper sizes
        const savedKey = `receipt_design_template_${paperSize}`;
        const savedTemplate = localStorage.getItem(savedKey);

        let template;
        try {
            template = savedTemplate ? JSON.parse(savedTemplate) : null;
        } catch {
            template = null;
        }

        // If no saved template, use the default template for the paper size
        if (!template) {
            switch (paperSize) {
                case 'Termal 80mm':
                    template = { ...template80mm };
                    break;
                case 'Termal 58mm':
                    template = { ...template58mm };
                    break;
                case 'A4 (210x297mm)':
                case 'A5 (148x210mm)':
                    // Use clean HTML table-based receipt for A4/A5
                    printA5Receipt(saleData, paperSize);
                    return;
                default:
                    template = { ...defaultTemplate };
                    break;
            }
        }

        const dimensions = PAPER_SIZES[paperSize] || PAPER_SIZES['Termal 80mm'];
        const now = new Date();

        // Replace variables in text
        const replaceVariables = (text, item = null) => {
            if (!text) return '';
            let result = text;
            result = result.replace('{{TARIH}}', now.toLocaleDateString('tr-TR'));
            result = result.replace('{{SAAT}}', now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
            result = result.replace('{{FIS_NO}}', now.getTime().toString());
            result = result.replace('{{MUSTERI_ADI}}', saleData.customer || 'Müşteri');
            result = result.replace('{{ODEME_TIPI}}', saleData.paymentMethod || 'Nakit');
            result = result.replace('{{GENEL_TOPLAM}}', saleData.total.toFixed(2));

            // Balance variables
            const previousBalance = saleData.customerData?.balance || 0;
            const newBalance = previousBalance + saleData.total;

            result = result.replace('{{ESKI_BAKIYE}}', previousBalance.toFixed(2));
            result = result.replace('{{YENI_BAKIYE}}', newBalance.toFixed(2));

            if (item) {
                result = result.replace('{{URUN_ADI}}', item.name || '');
                result = result.replace('{{MIKTAR}}', item.quantity?.toString() || '1');
                result = result.replace('{{FIYAT}}', item.price?.toFixed(2) || '0.00');
                result = result.replace('{{ISKONTO}}', (item.discount_rate || 0).toString());
                const lineTotal = (item.price * item.quantity * (1 - (item.discount_rate || 0) / 100));
                result = result.replace('{{SATIR_TOPLAM}}', lineTotal.toFixed(2));
            }
            return result;
        };

        // Separate product rows from static items
        // Show balance logic: Explicit setting enabled AND (Customer is selected AND not 'Toptan Satış' AND not Retail/Perakende)
        const showBalanceSetting = localStorage.getItem('receipt_show_balance') === 'true';
        const isRegisteredCustomer = saleData.customer &&
            saleData.customer !== 'Toptan Satış' &&
            !saleData.customer.includes('(Perakende)');
        const shouldShowBalance = showBalanceSetting && isRegisteredCustomer;

        // Separate product rows from static items and filter footer items
        const staticItems = template.items.filter(i => !i.is_product_row && !i.is_dynamic_footer);
        const productRowTemplates = template.items.filter(i => i.is_product_row);

        // Filter out balance items if shouldShowBalance is false
        const footerItems = template.items.filter(i => {
            if (!i.is_dynamic_footer) return false;

            if (!shouldShowBalance) {
                // Check if item is related to balance
                const isBalanceItem = (i.id && (i.id.includes('bakiye') || i.id === 'eski_bakiye' || i.id === 'yeni_bakiye')) ||
                    (i.text && (i.text.includes('Bakiye') || i.text.includes('{{ESKI_BAKIYE}}') || i.text.includes('{{YENI_BAKIYE}}')));
                if (isBalanceItem) return false;
            }
            return true;
        });

        // Build HTML for static items
        let staticHtml = '';
        staticItems.forEach(item => {
            const style = `
                position: absolute;
                left: ${item.x}px;
                top: ${item.y}px;
                width: ${item.text_width || item.width || 100}px;
                height: ${item.text_height || item.height || 20}px;
                font-family: 'Tahoma', sans-serif;
                font-size: ${item.font_size || 10}px;
                font-weight: ${item.font_bold ? 'bold' : 'normal'};
                color: ${item.color || '#000'};
                text-align: ${item.text_align || 'left'};
                background-color: ${item.type === 'shape' ? (item.fill_color || 'transparent') : 'transparent'};
                display: flex;
                align-items: center;
                justify-content: ${item.text_align === 'center' ? 'center' : item.text_align === 'right' ? 'flex-end' : 'flex-start'};
                overflow: hidden;
                white-space: nowrap;
            `;
            if (item.type === 'text') {
                staticHtml += `<div style="${style}">${replaceVariables(item.text)}</div>`;
            } else if (item.type === 'shape') {
                staticHtml += `<div style="${style}"></div>`;
            } else if (item.type === 'image') {
                staticHtml += `<div style="${style}"><img src="${item.src}" style="width: 100%; height: 100%; object-fit: contain;"></div>`;
            }
        });

        // Build HTML for product rows
        let productRowsHtml = '';
        let currentY = productRowTemplates.length > 0 ? productRowTemplates[0].y : 120;
        const rowHeight = 16;

        saleData.items.forEach((product, index) => {
            productRowTemplates.forEach(templateItem => {
                const yOffset = index * rowHeight;
                const style = `
                    position: absolute;
                    left: ${templateItem.x}px;
                    top: ${templateItem.y + yOffset}px;
                    width: ${templateItem.text_width || 100}px;
                    height: ${templateItem.text_height || 14}px;
                    font-family: 'Tahoma', sans-serif;
                    font-size: ${templateItem.font_size || 9}px;
                    font-weight: ${templateItem.font_bold ? 'bold' : 'normal'};
                    color: ${templateItem.color || '#000'};
                    text-align: ${templateItem.text_align || 'left'};
                    display: flex;
                    align-items: center;
                    justify-content: ${templateItem.text_align === 'center' ? 'center' : templateItem.text_align === 'right' ? 'flex-end' : 'flex-start'};
                    overflow: hidden;
                    white-space: nowrap;
                `;
                productRowsHtml += `<div style="${style}">${replaceVariables(templateItem.text, product)}</div>`;
            });
            currentY += rowHeight;
        });

        // Build HTML for footer items (positioned after products)
        let footerHtml = '';
        const footerOffset = (saleData.items.length - 1) * rowHeight;
        footerItems.forEach(item => {
            const style = `
                position: absolute;
                left: ${item.x}px;
                top: ${item.y + footerOffset}px;
                width: ${item.text_width || item.width || 100}px;
                height: ${item.text_height || item.height || 20}px;
                font-family: 'Tahoma', sans-serif;
                font-size: ${item.font_size || 10}px;
                font-weight: ${item.font_bold ? 'bold' : 'normal'};
                color: ${item.color || '#000'};
                text-align: ${item.text_align || 'left'};
                background-color: ${item.type === 'shape' ? (item.fill_color || 'transparent') : 'transparent'};
                display: flex;
                align-items: center;
                justify-content: ${item.text_align === 'center' ? 'center' : item.text_align === 'right' ? 'flex-end' : 'flex-start'};
                overflow: hidden;
            `;
            if (item.type === 'text') {
                footerHtml += `<div style="${style}">${replaceVariables(item.text)}</div>`;
            } else if (item.type === 'shape') {
                footerHtml += `<div style="${style}"></div>`;
            } else if (item.type === 'image') {
                footerHtml += `<div style="${style}"><img src="${item.src}" style="width: 100%; height: 100%; object-fit: contain;"></div>`;
            }
        });

        const totalHeight = currentY + 100; // Extra space for footer

        const receiptContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Satış Fişi</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        width: ${dimensions.width}px; 
                        margin: 0 auto;
                        transform-origin: top left;
                    }
                    .receipt { position: relative; width: ${dimensions.width}px; min-height: ${totalHeight}px; }
                    @media print { 
                        body { 
                            margin: 0; 
                            ${(paperSize.includes('A5') || paperSize.includes('A4')) ? 'transform: scale(1.35);' : ''}
                        } 
                        @page { 
                            margin: 0; 
                            size: ${(paperSize.includes('A5') || paperSize.includes('A4')) ? 'auto' : `${dimensions.width}px auto`}; 
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    ${staticHtml}
                    ${productRowsHtml}
                    ${footerHtml}
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', `width=${dimensions.width + 50},height=600`);
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 100);
        }
    };

    // A5/A4 Clean HTML Table-based Receipt - Fixed width approach
    const printA5Receipt = (saleData, paperSize) => {
        const isA4 = paperSize === 'A4 (210x297mm)';
        // Use exact pixel dimensions for reliable printing
        // A5: 148mm x 210mm at 96dpi = ~559px x 794px
        // A4: 210mm x 297mm at 96dpi = ~794px x 1123px
        const contentWidth = isA4 ? 754 : 519; // Page width minus margins (20mm = ~76px each side for A4, 20mm = ~40px for A5)
        const companyName = localStorage.getItem('receipt_company_name') || 'FIRMA ADI';
        const companyAddress = localStorage.getItem('receipt_company_address') || 'Adres Bilgisi';
        const companyPhone = localStorage.getItem('receipt_company_phone') || 'Tel: 0XXX XXX XX XX';

        const receiptContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Satış Fişi</title>
    <style>
        @page {
            size: ${isA4 ? 'A4' : 'A5'};
            margin: 10mm;
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        html, body { 
            width: 100%;
            margin: 0;
            padding: 0;
            font-family: 'Tahoma', 'Segoe UI', Arial, sans-serif;
            font-size: ${isA4 ? '11px' : '10px'};
            color: #333;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .receipt-container {
            width: 100%;
            padding: 0;
        }
        .receipt-header { 
            text-align: center; 
            border-bottom: 1px solid #333; 
            padding-bottom: 8px; 
            margin-bottom: 8px; 
        }
        .receipt-header h1 { 
            font-size: ${isA4 ? '18px' : '14px'}; 
            margin-bottom: 2px; 
            color: #000;
            font-weight: bold;
        }
        .receipt-header .sub-info { 
            font-size: ${isA4 ? '10px' : '8px'}; 
            color: #0066cc; 
            line-height: 1.4;
        }
        .info-line {
            display: table;
            width: 100%;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
            font-size: ${isA4 ? '10px' : '9px'};
        }
        .info-line .left { 
            display: table-cell;
            text-align: left;
            width: 50%;
        }
        .info-line .right { 
            display: table-cell;
            text-align: right;
            width: 50%;
            font-weight: bold;
        }
        table.items { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 12px;
        }
        table.items th { 
            background: transparent; 
            color: #333; 
            padding: 4px 2px; 
            font-size: ${isA4 ? '9px' : '8px'};
            font-weight: bold;
            border-bottom: 1px solid #333;
        }
        table.items th.col-name { width: 50%; text-align: left; }
        table.items th.col-qty { width: 12%; text-align: center; }
        table.items th.col-price { width: 18%; text-align: center; }
        table.items th.col-total { width: 20%; text-align: center; }
        table.items td { 
            padding: 3px 2px; 
            font-size: ${isA4 ? '9px' : '8px'};
            vertical-align: top;
        }
        table.items td.col-name { text-align: left; }
        table.items td.col-qty { text-align: center; }
        table.items td.col-price { text-align: center; }
        table.items td.col-total { text-align: center; }
        .total-section { 
            margin-top: 15px;
            text-align: center;
        }
        .total-amount {
            font-size: ${isA4 ? '14px' : '12px'}; 
            font-weight: bold;
        }
        .footer-msg { 
            text-align: center; 
            margin-top: 20px;
            color: #0066cc; 
            font-size: ${isA4 ? '9px' : '8px'}; 
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="receipt-header">
            <h1>${companyName}</h1>
            <div class="sub-info">${companyAddress}<br>${companyPhone}</div>
        </div>
        <div class="info-line">
            <span class="left">${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="right">${saleData.customer?.includes('Perakende') ? 'Perakende Satış' : 'Toptan Satış'}</span>
        </div>
        <table class="items">
            <thead>
                <tr>
                    <th class="col-name">URUN</th>
                    <th class="col-qty">ADET</th>
                    <th class="col-price">FIYAT</th>
                    <th class="col-total">TUTAR</th>
                </tr>
            </thead>
            <tbody>
                ${(saleData.items || []).map(item => {
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const lineTotal = price * qty * (1 - discount / 100);
            return `<tr>
                        <td class="col-name">${item.name || ''}</td>
                        <td class="col-qty">${qty.toFixed(0)}</td>
                        <td class="col-price">${price.toFixed(2)}</td>
                        <td class="col-total">${lineTotal.toFixed(2)}</td>
                    </tr>`;
        }).join('')}
            </tbody>
        </table>
        <div class="total-section">
            <span class="total-amount">TOPLAM: ${(saleData.total || 0).toFixed(2)} TL</span>
        </div>
        <div class="footer-msg">Bizi tercih ettiğiniz için teşekkürler!</div>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', `width=${isA4 ? 800 : 600},height=${isA4 ? 1000 : 800}`);
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 200);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-100" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {/* Header removed - using Global Layout Header */}

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Cart) */}
                <aside className="w-[500px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl shadow-slate-200/50">
                    <div className="p-3 bg-white border-b border-slate-200 shadow-sm z-20">
                        <div className="grid grid-cols-4 gap-2">
                            {/* Customer Button (Takes 2 cols) */}
                            <button
                                className={`col-span-2 border rounded-lg p-2 flex items-center gap-2 transition-all text-left group ${customer !== 'Toptan Satış'
                                    ? 'bg-yellow-100 border-yellow-400 hover:border-yellow-500'
                                    : 'bg-slate-50 border-slate-200 hover:border-blue-400'
                                    }`}
                                onClick={() => setShowCustomerModal(true)}
                                title="Müşteri Seç"
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${customer !== 'Toptan Satış'
                                    ? 'bg-yellow-400 text-yellow-800'
                                    : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                                    }`}>
                                    <span className="material-symbols-outlined text-lg">person</span>
                                </div>
                                <div className="min-w-0 overflow-hidden">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase leading-none mb-0.5">Müşteri</p>
                                    <p className={`truncate leading-none ${customer !== 'Toptan Satış' ? 'text-sm font-extrabold text-black' : 'text-[11px] font-bold text-slate-800'}`}>{customer}</p>
                                </div>
                            </button>

                            {/* Hold Button (1 col) */}
                            <button
                                onClick={holdSale}
                                className="col-span-1 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center p-2 hover:bg-orange-100 hover:border-orange-400 transition-all"
                                title="Satışı Beklemeye Al"
                            >
                                <span className="text-xs font-extrabold text-orange-700 text-center leading-tight">BEKLEMEYE<br />AL</span>
                            </button>

                            {/* Waitlist Button (1 col) */}
                            <button
                                onClick={() => setShowWaitlistModal(true)}
                                className="col-span-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center p-2 hover:bg-slate-100 hover:border-slate-400 transition-all relative"
                                title="Bekleyen Satışlar"
                            >
                                {heldSales.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">{heldSales.length}</span>
                                )}
                                <span className="text-xs font-extrabold text-slate-700 text-center leading-tight">BEKLEME<br />LİSTESİ</span>
                            </button>
                        </div>

                        {/* Barcode Input */}
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">barcode_scanner</span>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                placeholder="Barkod okutun..."
                                type="text"
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                onKeyDown={handleBarcodeInput}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex items-center px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white border-b border-slate-100">
                        <span className="flex-1">Sepetteki Ürünler</span>
                        <span className="w-16 text-center">Adet</span>
                        <span className="w-24 text-right">Tutar</span>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-0 py-0 divide-y divide-slate-100">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">shopping_basket</span>
                                <p className="text-sm font-medium">Sepet boş</p>
                            </div>
                        ) : (
                            cart.map((item, index) => (
                                <div
                                    key={item.id || `${item.stock_code}-${index}`}
                                    ref={el => cartItemsRef.current[index] = el}
                                    className={`flex items-center gap-1.5 pr-2 py-0.5 hover:bg-slate-50 group transition-all border-l-4 ${selectedCartIndex === index ? 'bg-green-100 border-green-500' : 'border-transparent pl-1'}`}
                                    onClick={() => setSelectedCartIndex(index)}
                                >
                                    <div className="w-8 h-8 bg-slate-100 overflow-hidden flex-shrink-0 border-r border-slate-100">
                                        {item.image_url ? (
                                            <img
                                                alt={item.name}
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                                src={item.image_url}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div className={`w-full h-full flex-col items-center justify-center bg-slate-100 text-slate-400 ${item.image_url ? 'hidden' : 'flex'}`}>
                                            <span className="text-[6px] text-center leading-tight font-medium">Görsel<br />Yok</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 pl-0.5">
                                        <h4 className="text-lg font-bold text-slate-800 line-clamp-1 leading-tight">{item.name}</h4>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {item.discount_rate > 0 ? (
                                                <div className="flex flex-col leading-none">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm text-slate-400 line-through decoration-red-400">{item.price?.toFixed(2)} ₺</span>
                                                        <p className="text-xl font-bold text-emerald-600">
                                                            {(item.price * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-bold text-red-700 bg-yellow-300 px-2 py-0.5 rounded">
                                                        %{item.discount_rate} iskonto uygulanmıştır
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xl font-bold text-blue-600">{item.price?.toFixed(2)} ₺</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-16 flex items-center justify-center">
                                        <div
                                            className="h-8 px-2 bg-slate-100 rounded flex items-center justify-center text-lg font-bold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setModalValue(item.quantity);
                                                setSelectedCartIndex(index);
                                                setShowQuantityModal(true);
                                                // Focus and select is handled in the modal's input autoFocus + onFocus
                                            }}
                                        >
                                            {item.quantity}
                                        </div>
                                    </div>
                                    <div className="w-24 text-right">
                                        <span className="text-lg font-bold text-red-500">
                                            {(item.price * item.quantity * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-rose-500 transition-all ml-1"
                                    >
                                        <span className="material-symbols-outlined text-xl">close</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10">
                        <div className="space-y-0 mb-4">
                            <div className="flex justify-between items-end pt-2">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">TOPLAM</span>
                                <span className="text-3xl font-extrabold text-slate-900 tracking-tighter">{calculateTotal().toFixed(2)} ₺</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {/* Row 1: Payment Methods */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => completeSale('Nakit')}
                                    className="flex items-center justify-center p-2 bg-emerald-50 border border-emerald-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-100 hover:shadow-md transition-all"
                                >
                                    <span className="text-base font-extrabold text-emerald-700 whitespace-nowrap">NAKİT</span>
                                </button>
                                <button
                                    onClick={() => completeSale('POS')}
                                    className="flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-100 hover:shadow-md transition-all"
                                >
                                    <span className="text-base font-extrabold text-blue-700 whitespace-nowrap">KREDİ KARTI</span>
                                </button>
                                <button
                                    onClick={() => completeSale('Açık Hesap')}
                                    className="flex items-center justify-center p-2 bg-orange-50 border border-orange-200 rounded-xl hover:border-orange-500 hover:bg-orange-100 hover:shadow-md transition-all"
                                >
                                    <span className="text-base font-extrabold text-orange-700 whitespace-nowrap">VERESİYE</span>
                                </button>
                            </div>

                            {/* Row 2: Item Actions */}
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                            setModalValue(cart[selectedCartIndex].quantity);
                                            setShowQuantityModal(true);
                                        } else {
                                            alert('Lütfen sepetten bir ürün seçin');
                                        }
                                    }}
                                    className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-slate-700">MİKTAR DÜZENLE</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                            setModalValue(cart[selectedCartIndex].price);
                                            setShowPriceModal(true);
                                        } else {
                                            alert('Lütfen sepetten bir ürün seçin');
                                        }
                                    }}
                                    className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-slate-700">FİYAT DÜZENLE</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                            setModalValue(cart[selectedCartIndex].discount_rate || 0);
                                            setShowDiscountModal(true);
                                        } else {
                                            alert('Lütfen sepetten bir ürün seçin');
                                        }
                                    }}
                                    className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-slate-700">İSKONTO DÜZENLE</span>
                                </button>
                                <button
                                    onClick={() => { if (window.confirm('Sepeti temizle?')) setCart([]); }}
                                    className="flex items-center justify-center p-3 bg-rose-50 border border-rose-200 rounded-lg hover:border-rose-400 hover:bg-rose-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-rose-700">SEPETİ BOŞALT</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">

                    {/* Categories */}
                    <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 bg-white flex-none z-10">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                    ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar (Main) */}
                    <div className="mt-4 px-6">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                placeholder="Ürün adı ile ara..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                ref={searchInputRef}
                            />
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1 overflow-x-auto custom-scrollbar p-6 bg-slate-50/50 border-b border-slate-200 shadow-inner h-auto">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                            {filteredProducts.map(product => (
                                <ProductCard
                                    key={product.id || product.stock_code}
                                    product={product}
                                    onAddToCart={addToCart}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Stats / Actions (Bottom Right) */}
                    <div className="flex-none p-4 bg-white flex items-center justify-center gap-4 border-t border-slate-200">
                        {/* Product Count Info or other small footer stats if needed, or empty */}
                        <p className="text-xs text-slate-400 font-medium">
                            {filteredProducts.length} ürün listeleniyor
                        </p>
                    </div>
                </main>
            </div>

            {/* MODALS */}

            {/* Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-6 py-5 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">Müşteri Seç</h3>
                            <button onClick={() => setShowCustomerModal(false)} className="text-white hover:bg-white/20 rounded p-1"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-4 bg-slate-50 border-b">
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-slate-200"
                                placeholder="Müşteri ara..."
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            <div
                                onClick={() => { setCustomer('Toptan Satış'); setShowCustomerModal(false); }}
                                className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 cursor-pointer flex justify-between items-center group"
                            >
                                <span className="font-bold text-slate-800">Toptan Satış (Varsayılan)</span>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500">check_circle</span>
                            </div>
                            {customers
                                .filter(c => c.name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone?.includes(customerSearchQuery))
                                .map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => { setCustomer(c.name); setShowCustomerModal(false); }}
                                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 cursor-pointer flex justify-between items-center group"
                                    >
                                        <div>
                                            <p className="font-bold text-slate-800">{c.name}</p>
                                            <p className="text-xs text-slate-500">{c.phone}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${c.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{c.balance?.toFixed(2)} ₺</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowRetailCustomerModal(true)}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                            >
                                + Perakende Müşteri
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Retail Customer Modal */}
            {showRetailCustomerModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                        <div className="bg-slate-900 px-10 py-8 text-white">
                            <h3 className="text-3xl font-bold">Perakende Müşteri</h3>
                            <p className="text-slate-400">Hızlı satış için bilgileri doldurun</p>
                        </div>
                        <form onSubmit={handleRetailCustomerSubmit} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="block font-semibold text-slate-700">İsim Soyisim *</label>
                                <input name="name" value={retailCustomerForm.name} onChange={handleRetailCustomerChange} className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none" required />
                            </div>
                            <div className="space-y-2">
                                <label className="block font-semibold text-slate-700">Telefon</label>
                                <input name="phone" value={retailCustomerForm.phone} onChange={handleRetailCustomerChange} className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none" />
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowRetailCustomerModal(false)} className="flex-1 py-4 bg-slate-100 font-bold text-slate-600 rounded-2xl hover:bg-slate-200">İptal</button>
                                <button type="submit" className="flex-[2] py-4 bg-blue-600 font-bold text-white rounded-2xl hover:bg-blue-700">✓ Tamamla</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quantity Modal */}
            {showQuantityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowQuantityModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    Miktar Düzenle
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {cart[selectedCartIndex]?.name}
                                </p>
                            </div>
                            <div className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        onClick={() => setModalValue(prev => Math.max(1, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            type="number"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1);
                                                }
                                            }}
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            autoFocus
                                        />
                                        <div className="h-1 w-8 bg-blue-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        onClick={() => setModalValue(prev => ((parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1)}
                                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Kaydet</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">check</span>
                                </button>
                            </div>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Price Modal */}
            {showPriceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowPriceModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    Fiyat Düzenle
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {cart[selectedCartIndex]?.name}
                                </p>
                            </div>
                            <div className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        onClick={() => setModalValue(prev => Math.max(0, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            type="number"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0);
                                                }
                                            }}
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            autoFocus
                                        />
                                        <div className="h-1 w-8 bg-blue-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        onClick={() => setModalValue(prev => ((parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0)}
                                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Kaydet</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">check</span>
                                </button>
                            </div>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    İskonto Ekle (%)
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {cart[selectedCartIndex]?.name}
                                </p>
                            </div>
                            <div className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        onClick={() => setModalValue(prev => Math.max(0, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            type="number"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0);
                                                }
                                            }}
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            autoFocus
                                            placeholder="%"
                                        />
                                        <div className="h-1 w-8 bg-orange-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        onClick={() => setModalValue(prev => Math.min(100, (parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0)}
                                    className="w-full h-16 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Kaydet</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">check</span>
                                </button>
                            </div>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Waitlist Modal - Bekleme Listesi */}
            {showWaitlistModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white w-[500px] max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Bekleme Listesi</h3>
                            <button onClick={() => setShowWaitlistModal(false)} className="text-white/60 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {heldSales.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">
                                    <span className="material-symbols-outlined text-4xl mb-2">hourglass_empty</span>
                                    <p>Bekleyen satış yok</p>
                                </div>
                            ) : (
                                heldSales.map((sale, index) => {
                                    const saleTotal = (sale.items || []).reduce((sum, item) => {
                                        const price = item.price * (1 - (item.discount_rate || 0) / 100);
                                        return sum + (price * item.quantity);
                                    }, 0);
                                    const customerName = sale.customer_name || sale.customer || 'Toptan Satış';
                                    return (
                                        <div key={sale.id || index} className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-blue-400 transition-all flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-bold text-slate-800 truncate">{customerName}</p>
                                                    <p className="font-extrabold text-lg text-red-600">{saleTotal.toFixed(2)} ₺</p>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <span className="text-sm font-bold">{new Date(sale.created_at).toLocaleDateString('tr-TR')}</span>
                                                    <span className="text-sm font-bold">{new Date(sale.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="text-xs">• {sale.items?.length || 0} ürün</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => { restoreHeldSale(sale); setShowWaitlistModal(false); }}
                                                    className="px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700"
                                                >
                                                    Yükle
                                                </button>
                                                <button
                                                    onClick={() => deleteHeldSale(sale.id)}
                                                    className="px-2 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showAskQuantityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowAskQuantityModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    Miktar Giriniz
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {productToAdd?.name}
                                </p>
                            </div>
                            <form onSubmit={confirmAddQuantity} className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        type="button"
                                        onClick={() => setAskQuantityValue(prev => Math.max(1, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            type="number"
                                            value={askQuantityValue}
                                            onChange={(e) => setAskQuantityValue(e.target.value)}
                                            autoFocus
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <div className="h-1 w-8 bg-emerald-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAskQuantityValue(prev => ((parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Ekle</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">chevron_right</span>
                                </button>
                            </form>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}



            {/* Undefined Product Modal */}
            {
                showUndefinedProductModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined">add_circle</span>
                                    Hızlı Ürün Ekle
                                </h3>
                                <button onClick={() => setShowUndefinedProductModal(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Step 1: Name */}
                                <div className={`space-y-2 transition-all duration-300 ${undefinedProductStep === 0 ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                                    <label className="block text-sm font-bold text-slate-700">1. Ürün İsmi</label>
                                    <input
                                        ref={undefinedNameRef}
                                        disabled={undefinedProductStep !== 0}
                                        value={undefinedProductData.name}
                                        onChange={(e) => setUndefinedProductData({ ...undefinedProductData, name: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && undefinedProductData.name.trim()) {
                                                setUndefinedProductStep(1);
                                                setTimeout(() => undefinedQtyRef.current?.focus(), 100);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white outline-none font-bold text-lg disabled:opacity-60"
                                        placeholder="Örn: Çay"
                                    />
                                </div>

                                {/* Step 2: Quantity */}
                                <div className={`space-y-2 transition-all duration-300 ${undefinedProductStep === 1 ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                                    <label className="block text-sm font-bold text-slate-700">2. Adet</label>
                                    <input
                                        ref={undefinedQtyRef}
                                        type="number"
                                        disabled={undefinedProductStep !== 1}
                                        value={undefinedProductData.quantity}
                                        onChange={(e) => setUndefinedProductData({ ...undefinedProductData, quantity: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && undefinedProductData.quantity) {
                                                setUndefinedProductStep(2);
                                                setTimeout(() => undefinedPriceRef.current?.focus(), 100);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white outline-none font-bold text-lg disabled:opacity-60"
                                        placeholder="1"
                                    />
                                </div>

                                {/* Step 3: Price */}
                                <div className={`space-y-2 transition-all duration-300 ${undefinedProductStep === 2 ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                                    <label className="block text-sm font-bold text-slate-700">3. Fiyat (TL)</label>
                                    <input
                                        ref={undefinedPriceRef}
                                        type="number"
                                        disabled={undefinedProductStep !== 2}
                                        value={undefinedProductData.price}
                                        onChange={(e) => setUndefinedProductData({ ...undefinedProductData, price: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && undefinedProductData.price) {
                                                const newProduct = {
                                                    id: `TEMP-${Date.now()}`,
                                                    stock_code: 'TANIMSIZ',
                                                    name: undefinedProductData.name,
                                                    price: parseFloat(undefinedProductData.price),
                                                    quantity: parseFloat(undefinedProductData.quantity),
                                                    discount_rate: 0
                                                };

                                                // Add to cart
                                                const existingIndex = cart.findIndex(item => item.name === newProduct.name && item.price === newProduct.price);
                                                if (existingIndex >= 0) {
                                                    const newCart = [...cart];
                                                    newCart[existingIndex].quantity += newProduct.quantity;
                                                    setCart(newCart);
                                                    setSelectedCartIndex(existingIndex);
                                                } else {
                                                    setCart([...cart, newProduct]);
                                                    setSelectedCartIndex(cart.length);
                                                }

                                                setShowUndefinedProductModal(false);
                                                setUndefinedProductData({ name: '', quantity: 1, price: '' });
                                                setUndefinedProductStep(0);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white outline-none font-bold text-lg disabled:opacity-60"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowUndefinedProductModal(false)}
                                    className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg"
                                >
                                    İptal
                                </button>
                                {undefinedProductStep > 0 && (
                                    <button
                                        onClick={() => setUndefinedProductStep(prev => prev - 1)}
                                        className="px-4 py-2 text-violet-600 font-bold hover:bg-violet-50 rounded-lg"
                                    >
                                        Geri
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Success Message Toaster */}
            {
                successMessage && (
                    <div className="fixed bottom-10 right-10 z-50 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl text-lg font-bold animate-pulse flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        {successMessage}
                    </div>
                )
            }

        </div >
    );
}

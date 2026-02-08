import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productsAPI, salesAPI, customersAPI, shortcutsAPI, heldSalesAPI } from '../services/api';
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
    const [selectedCartIndex, setSelectedCartIndex] = useState(null);
    const [customer, setCustomer] = useState('Toptan Satış');
    const [customers, setCustomers] = useState([]);
    const [showCustomerModal, setShowCustomerModal] = useState(false);

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

    // Load Data
    useEffect(() => {
        loadProducts();
        loadCustomers();
        loadHeldSales();
        loadShortcuts();

        // Load Shortcuts
        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) {
            try {
                setKeyboardShortcuts(JSON.parse(saved));
            } catch (e) {
                console.error("Shortcuts parse error", e);
            }
        }
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

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
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
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keyboardShortcuts, cart, selectedCartIndex]);

    // Filtering
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

    // Handlers
    const addToCart = (product) => {
        const askQty = localStorage.getItem('pos_settings_ask_quantity') === 'true';
        if (askQty) {
            setProductToAdd(product);
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
                    id: item.id, stock_code: item.stock_code, name: item.name,
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
                <aside className="w-[420px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl shadow-slate-200/50">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                        {/* Customer Display */}
                        <div
                            className="bg-white border border-slate-200 rounded-xl p-3 mb-3 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
                            onClick={() => setShowCustomerModal(true)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg">person</span>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase">Müşteri</p>
                                    <p className="text-sm font-bold text-slate-800">{customer}</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-400">expand_more</span>
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
                        <span className="w-20 text-right">Tutar</span>
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
                                    key={index}
                                    className={`flex items-center gap-2 pl-0 pr-2 py-1.5 hover:bg-slate-50 group transition-all ${selectedCartIndex === index ? 'bg-blue-50/50' : ''}`}
                                    onClick={() => setSelectedCartIndex(index)}
                                >
                                    <div className="w-10 h-10 bg-slate-100 overflow-hidden flex-shrink-0 border-r border-slate-100">
                                        <img
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            src={item.image_url || 'https://via.placeholder.com/40'}
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=?'; }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 pl-1">
                                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                                        <p className="text-[10px] text-slate-500">{item.price?.toFixed(2)} ₺ /adet</p>
                                    </div>
                                    <div className="w-16 flex items-center justify-center">
                                        <div
                                            className="h-6 px-2 bg-slate-100 rounded flex items-center justify-center text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-200"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setModalValue(item.quantity);
                                                setSelectedCartIndex(index);
                                                setShowQuantityModal(true);
                                            }}
                                        >
                                            {item.quantity}
                                        </div>
                                    </div>
                                    <div className="w-20 text-right">
                                        <span className="text-xs font-bold text-red-500">{(item.price * item.quantity).toFixed(2)} ₺</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}
                                        className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <span className="material-symbols-outlined text-base">close</span>
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
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => completeSale('Nakit')}
                                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-500/5 hover:shadow-md transition-all group"
                            >
                                <span className="material-symbols-outlined text-emerald-500 mb-1 group-hover:scale-110 transition-transform">payments</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-emerald-600">NAKİT</span>
                            </button>
                            <button
                                onClick={() => completeSale('POS')}
                                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-600 hover:bg-blue-600/5 hover:shadow-md transition-all group"
                            >
                                <span className="material-symbols-outlined text-blue-600 mb-1 group-hover:scale-110 transition-transform">credit_card</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-blue-600">KREDİ KARTI</span>
                            </button>
                            <button
                                onClick={() => completeSale('Açık Hesap')}
                                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 hover:shadow-md transition-all group"
                            >
                                <span className="material-symbols-outlined text-orange-500 mb-1 group-hover:scale-110 transition-transform">assignment</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-orange-600">VERESİYE</span>
                            </button>
                            <button
                                onClick={() => { if (window.confirm('Sepeti temizle?')) setCart([]); }}
                                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-rose-500 hover:bg-rose-50 hover:shadow-md transition-all group"
                            >
                                <span className="material-symbols-outlined text-rose-500 mb-1 group-hover:scale-110 transition-transform">delete_sweep</span>
                                <span className="text-[10px] font-bold text-slate-700 group-hover:text-rose-600">İPTAL</span>
                            </button>
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
                                <div
                                    key={product.id || product.stock_code}
                                    onClick={() => addToCart(product)}
                                    className="h-48 bg-white rounded-xl border border-slate-200 p-2 shadow-sm hover:shadow-lg hover:border-blue-600/30 hover:-translate-y-0.5 transition-all group flex flex-col cursor-pointer"
                                >
                                    <div className="w-full h-24 rounded-lg bg-slate-50 overflow-hidden relative flex-shrink-0 border border-slate-100 mb-2">
                                        <img
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            src={product.image_url || 'https://via.placeholder.com/150'}
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=IMG'; }}
                                        />
                                    </div>
                                    <div className="flex flex-col flex-1 px-0.5 relative">
                                        <h3 className="text-[10px] font-bold text-slate-700 leading-snug line-clamp-2 mb-auto group-hover:text-blue-600 transition-colors">{product.name}</h3>
                                        <div className="flex items-center justify-between mt-auto pt-1 w-full">
                                            <span className="text-xs font-extrabold text-slate-900">{product.price?.toFixed(2)} ₺</span>
                                            <div className="w-6 h-6 rounded bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                                                <span className="material-symbols-outlined text-sm font-bold">add</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats / Actions (Bottom Right) */}
                    <div className="flex-none p-4 bg-white flex items-center justify-center gap-4 border-t border-slate-200">
                        {/* Action Buttons */}
                        <button
                            onClick={holdSale}
                            className="px-4 py-2 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-bold text-xs flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">pause</span>
                            Beklemeye Al
                        </button>
                        <button
                            onClick={() => setShowWaitlistModal(true)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-bold text-xs flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">list</span>
                            Bekleyenler ({heldSales.length})
                        </button>
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
                                onChange={(e) => {/* Implement search locally if list is long */ }}
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
                            {customers.map(c => (
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-8 w-96 text-center rounded-2xl shadow-xl">
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">Miktar Düzenle</h3>
                        <input type="number" value={modalValue} onChange={(e) => setModalValue(e.target.value)} className="w-full p-4 text-3xl text-center border-2 border-blue-500 rounded-xl mb-4 focus:outline-none" autoFocus />
                        <button onClick={() => updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1)} className="w-full p-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700">Kaydet</button>
                        <button onClick={() => setShowQuantityModal(false)} className="w-full mt-2 p-2 text-slate-500 hover:text-slate-800">İptal</button>
                    </div>
                </div>
            )}

            {/* Ask Quantity Modal (Initial Add) */}
            {showAskQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 w-96 shadow-2xl rounded-2xl">
                        <h3 className="text-xl font-bold text-center mb-4">Miktar Giriniz</h3>
                        <p className="text-center text-slate-500 mb-4">{productToAdd?.name}</p>
                        <form onSubmit={confirmAddQuantity}>
                            <input type="number" value={askQuantityValue} onChange={(e) => setAskQuantityValue(e.target.value)} className="w-full p-4 text-3xl text-center border-2 border-blue-500 rounded-xl mb-4 focus:outline-none" autoFocus />
                            <button type="submit" className="w-full p-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600">Ekle</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Waitlist Modal */}
            {showWaitlistModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl rounded-2xl">
                        <div className="bg-orange-500 px-6 py-5 flex justify-between items-center text-white">
                            <h3 className="text-2xl font-bold">Bekleme Listesi</h3>
                            <button onClick={() => setShowWaitlistModal(false)}><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {heldSales.length === 0 ? <p className="text-center text-slate-500 py-10">Bekleyen satış yok.</p> :
                                heldSales.map((sale, i) => (
                                    <div key={sale.id} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm">
                                        <div>
                                            <p className="font-bold">#{i + 1} - {sale.customer_name || 'Genel'}</p>
                                            <p className="text-xs text-slate-500">{sale.items.length} ürün</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => restoreHeldSale(sale)} className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-sm">Geri Yükle</button>
                                            <button onClick={() => deleteHeldSale(sale.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-bold text-sm">Sil</button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Success Message Toaster */}
            {successMessage && (
                <div className="fixed bottom-10 right-10 z-50 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl text-lg font-bold animate-pulse flex items-center gap-2">
                    <span className="material-symbols-outlined">check_circle</span>
                    {successMessage}
                </div>
            )}

        </div>
    );
}

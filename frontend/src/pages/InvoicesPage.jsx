import { useState, useEffect } from 'react';
import { invoicesAPI, productsAPI, customersAPI } from '../services/api';
import axios from 'axios';
import JSZip from 'jszip';
import pako from 'pako';


import ProductMatchModal from '../components/modals/ProductMatchModal';

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceDetail, setInvoiceDetail] = useState(null);

    const [detailLoading, setDetailLoading] = useState(false);

    // View Loading State (for "Faturanız Açılıyor" overlay)
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState(null); // New error state

    // Preview Modal State (In-App Window)
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState(null);


    // Matching State
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [productMatches, setProductMatches] = useState({}); // { lineIndex: productId }
    const [supplierMatch, setSupplierMatch] = useState(null); // customerId
    const [processing, setProcessing] = useState(false);
    const [invoiceDescription, setInvoiceDescription] = useState(""); // New state for description

    // Product Match Modal State
    const [matchModalOpen, setMatchModalOpen] = useState(false);
    const [matchModalData, setMatchModalData] = useState(null); // { index, line }

    useEffect(() => {
        loadInvoices();
        loadDataForMatching();
    }, []);

    const loadDataForMatching = async () => {
        try {
            const [pRes, cRes] = await Promise.all([
                productsAPI.getAll(),
                customersAPI.getAll()
            ]);
            setProducts(pRes.data?.products || []);
            setCustomers(cRes.data?.customers || []);
        } catch (err) {
            console.error("Eşleştirme verileri yüklenemedi", err);
        }
    };
    // Filter states
    const [filters, setFilters] = useState({
        search: '',
        status: 'Tümü',
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], // Last 1 month
        endDate: new Date().toISOString().split('T')[0]
    });

    // Sort state
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Visibility Setting
    const [showTotal, setShowTotal] = useState(true);

    useEffect(() => {
        loadInvoices();
        const savedShowTotal = localStorage.getItem('invoices_show_total');
        if (savedShowTotal !== null) {
            setShowTotal(savedShowTotal === 'true');
        }
    }, []);

    const loadInvoices = async () => {
        try {
            const response = await invoicesAPI.getAll();
            setInvoices(response.data?.invoices || []);
        } catch (error) {
            console.error('Faturalar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewInvoice = async (invoice) => {
        if (!invoice.uuid) {
            alert("Fatura UUID bulunamadı.");
            return;
        }

        setViewLoading(true);
        setViewError(null);
        setPreviewHtml(null);

        try {
            // 1. Get credentials
            const savedConfig = localStorage.getItem('birfatura_config');
            if (!savedConfig) {
                alert("API ayarları eksik. Lütfen ayarlardan BirFatura entegrasyonunu kontrol edin.");
                setViewLoading(false);
                return;
            }
            const config = JSON.parse(savedConfig);

            // Common Headers
            const headers = {
                "X-Api-Key": config.api_key,
                "X-Secret-Key": config.secret_key,
                "X-Integration-Key": config.integration_key,
                "Content-Type": "application/json"
            };

            // --- ADIM 1: HAM VERİYİ İNDİR ---
            const urlDownload = "/birfatura/api/outEBelgeV2/DocumentDownloadByUUID";
            const payloadDownload = {
                "documentUUID": invoice.uuid,
                "inOutCode": "IN",
                "systemTypeCodes": "EFATURA"
            };

            const resp1 = await axios.post(urlDownload, payloadDownload, { headers, timeout: 30000 });

            if (!resp1.data?.Success) {
                throw new Error("İndirme Başarısız: " + (resp1.data?.Message || "Bilinmeyen hata"));
            }

            const contentBase64 = resp1.data.Result?.content;
            if (!contentBase64) {
                throw new Error("Fatura içeriği boş geldi.");
            }

            // --- ADIM 2: ORİJİNAL HTML GÖRÜNTÜSÜNÜ İSTE ---
            const urlPreview = "/birfatura/api/OutEBelgeV2/PreviewDocumentReturnHTML";
            const payloadPreview = {
                "documentBytes": contentBase64,
                "systemTypeCodes": "EFATURA"
            };

            const resp2 = await axios.post(urlPreview, payloadPreview, { headers, timeout: 30000 });

            if (!resp2.data?.Success) {
                throw new Error("Önizleme Başarısız: " + (resp2.data?.Message || "Bilinmeyen hata"));
            }

            const zippedHtmlBase64 = resp2.data.Result?.zipped;
            if (!zippedHtmlBase64) {
                throw new Error("HTML verisi oluşturulamadı.");
            }

            // --- ADIM 3: VERİYİ ÇÖZ (Decompress) ---
            const binaryString = atob(zippedHtmlBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            let htmlString = "";
            try {
                htmlString = pako.ungzip(bytes, { to: 'string' });
            } catch (e) {
                try {
                    htmlString = pako.inflate(bytes, { to: 'string' });
                } catch (e2) {
                    console.warn("Decompression failed, using raw bytes as string", e2);
                    htmlString = new TextDecoder("utf-8").decode(bytes);
                }
            }

            // Success!
            setPreviewHtml(htmlString);
            setPreviewModalOpen(true);
            setViewLoading(false);

        } catch (error) {
            console.error("Görüntüleme Hatası:", error);

            const errorMessage = "Bağlantı Hatası: " + (error.message || "Sunucuya ulaşılamadı.");
            setViewError(errorMessage);
            setViewLoading(false);
        }
    };

    const syncInvoices = async () => {
        setSyncing(true);
        try {
            // 1. Get credentials
            const savedConfig = localStorage.getItem('birfatura_config');
            if (!savedConfig) {
                alert("Lütfen önce Ayarlar > Entegrasyon Ayarları bölümünden API anahtarlarını girin.");
                setSyncing(false);
                return;
            }
            const config = JSON.parse(savedConfig);
            if (!config.api_key || !config.secret_key || !config.integration_key) {
                alert("Eksik API anahtarı. Lütfen ayarları kontrol edin.");
                setSyncing(false);
                return;
            }

            // 2. Prepare BirFatura Request
            // Use filters if set, otherwise default to last 30 days
            const startStr = filters.startDate ? `${filters.startDate}T00:00:00Z` : new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
            const endStr = filters.endDate ? `${filters.endDate}T23:59:59Z` : new Date().toISOString();

            const url = "/birfatura/api/OutEBelgeV2/GetInBoxDocumentsWithDetail";
            const headers = {
                "X-Api-Key": config.api_key,
                "X-Secret-Key": config.secret_key,
                "X-Integration-Key": config.integration_key,
                "Content-Type": "application/json"
            };
            const payload = {
                "systemType": "EFATURA",
                "startDateTime": startStr,
                "endDateTime": endStr,
                "documentType": "INVOICE",
                "readUnReadStatus": "ALL",
                "pageNumber": 0
            };

            // 3. Fetch from BirFatura
            // Note: This requires CORS to be allowed or a proxy. Assuming desktop/electron environment or proxy.
            const bfResponse = await axios.post(url, payload, { headers });

            if (bfResponse.data?.Success) {
                const rawInvoices = bfResponse.data.Result?.InBoxInvoices?.objects || [];

                // 4. Map to our format
                const mappedInvoices = rawInvoices.map(wrap => {
                    const inv = wrap.inBoxInvoice;
                    return {
                        uuid: inv.UUID,
                        invoice_number: inv.InvoiceNo,
                        supplier_name: inv.SenderName,
                        date: (inv.IssueDate || '').split('T')[0] + " 00:00:00",
                        total: inv.PayableAmount || 0,
                        status: 'Bekliyor', // Default status
                        // Store full json or lines if needed, for simplicity storing basic info
                        // In a real app we'd parse lines here too
                    };
                });

                if (mappedInvoices.length > 0) {
                    // 5. Save to Supabase
                    const saveRes = await invoicesAPI.syncBatch(mappedInvoices);
                    if (saveRes.data?.success) {
                        alert(`${mappedInvoices.length} fatura başarıyla senkronize edildi.`);
                        loadInvoices();
                    } else {
                        alert("Faturalar çekildi fakat veritabanına kaydedilemedi.");
                    }
                } else {
                    alert("Seçilen tarih aralığında yeni fatura bulunamadı.");
                }

            } else {
                alert(`BirFatura Hatası: ${bfResponse.data?.Message || 'Bilinmeyen hata'}`);
            }

        } catch (error) {
            console.error("Sync Error Full Object:", error);
            const errorMsg = error.response?.data?.Message || error.response?.data?.message || error.message || "Bilinmeyen hata";
            alert('Senkronizasyon hatası: ' + errorMsg);
        } finally {
            setSyncing(false);
        }
    };

    const openDetailModal = async (invoice) => {
        setSelectedInvoice(invoice);
        setShowDetailModal(true);
        setDetailLoading(true);
        setInvoiceDetail(null);
        setProductMatches({});
        setSupplierMatch(null);

        try {
            // 0. Pre-check credentials presence to avoid ugly errors
            const savedConfig = localStorage.getItem('birfatura_config');
            if (!savedConfig) {
                if (confirm("Fatura detaylarını görüntülemek için API anahtarlarını girmeniz gerekmektedir. Ayarlara gitmek ister misiniz?")) {
                    // Simple redirect for now, or just close
                    window.location.href = '/settings';
                }
                setShowDetailModal(false);
                setDetailLoading(false);
                return;
            }
            const config = JSON.parse(savedConfig);

            // 1. Fetch Detailed Content (ZIP/XML)
            const url = "/birfatura/api/outEBelgeV2/DocumentDownloadByUUID";
            const headers = {
                "X-Api-Key": config.api_key,
                "X-Secret-Key": config.secret_key,
                "X-Integration-Key": config.integration_key,
                "Content-Type": "application/json"
            };
            const payload = {
                "documentUUID": invoice.uuid,
                "inOutCode": "IN",
                "systemTypeCodes": "EFATURA"
            };

            const response = await axios.post(url, payload, { headers });

            if (!response.data.Success) {
                throw new Error(response.data.Message || "İçerik alınamadı");
            }

            const contentBase64 = response.data.Result?.content;
            if (!contentBase64) throw new Error("Dosya içeriği boş.");

            // 3. Unzip Content
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(contentBase64, { base64: true });

            // Find XML file
            const xmlFileName = Object.keys(zipContent.files).find(name => name.toLowerCase().endsWith('.xml'));
            if (!xmlFileName) throw new Error("ZIP içinde XML dosyası bulunamadı.");

            const xmlString = await zipContent.files[xmlFileName].async("string");

            // 4. Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const getText = (parent, tagName) => {
                if (!parent) return "";
                const els = parent.getElementsByTagName("*");
                for (let i = 0; i < els.length; i++) {
                    if (els[i].localName === tagName) return els[i].textContent;
                }
                return "";
            };

            const getTag = (parent, tagName) => {
                if (!parent) return null;
                const els = parent.getElementsByTagName("*");
                for (let i = 0; i < els.length; i++) {
                    if (els[i].localName === tagName) return els[i];
                }
                return null;
            };

            // Extract Supplier
            const supplierParty = getTag(xmlDoc, "AccountingSupplierParty");
            const partyIdent = getTag(supplierParty, "PartyIdentification");
            const supplierTax = getText(partyIdent, "ID");
            const partyNameInfo = getTag(supplierParty, "PartyName");
            const supplierName = getText(partyNameInfo, "Name");

            // Auto-match supplier by VKN/TaxID
            const matchedSupplier = customers.find(c => c.tax_number === supplierTax) ||
                customers.find(c => c.name.toLowerCase() === supplierName?.toLowerCase());
            if (matchedSupplier) {
                setSupplierMatch(matchedSupplier.id);
            }

            // Extract Lines
            const invoiceLines = Array.from(xmlDoc.getElementsByTagName("*")).filter(el => el.localName === "InvoiceLine");
            const lines = invoiceLines.map(line => {
                const itemNode = getTag(line, "Item");
                const priceNode = getTag(line, "Price");

                const quantity = parseFloat(getText(line, "InvoicedQuantity") || 0);
                const priceAmount = parseFloat(getText(priceNode, "PriceAmount") || 0);
                const lineExtensionAmount = parseFloat(getText(line, "LineExtensionAmount") || 0);

                // Discount: Look for AllowanceCharge with ChargeIndicator = false
                let discountAmount = 0;
                const charges = Array.from(line.getElementsByTagName("*")).filter(el => el.localName === "AllowanceCharge");
                for (const charge of charges) {
                    const indicator = getText(charge, "ChargeIndicator");
                    if (indicator === 'false') {
                        discountAmount += parseFloat(getText(charge, "Amount") || 0);
                    }
                }

                // VAT Rate
                const taxCat = getTag(itemNode, "ClassifiedTaxCategory");
                const vatRate = parseFloat(getText(taxCat, "Percent") || 0);

                // Auto-match product by Barcode (unlikely in UBL but try) or Name
                // UBL standard for barcode is usually Item > SellersItemIdentification > ID
                // or Item > StandardItemIdentification > ID

                return {
                    name: getText(itemNode, "Name"),
                    description: getText(itemNode, "Description"),
                    quantity: quantity,
                    unit_price: priceAmount,
                    line_net: lineExtensionAmount,
                    discount: discountAmount,
                    vat_rate: vatRate,
                    total_inc_vat: lineExtensionAmount + (lineExtensionAmount * vatRate / 100) - discountAmount // Approx
                };
            });

            // Auto match products by name
            const initialMatches = {};
            lines.forEach((line, index) => {
                // Try fuzzy match or exact match
                const match = products.find(p => p.name.toLowerCase() === line.name.toLowerCase());
                if (match) initialMatches[index] = match.id;
            });
            setProductMatches(initialMatches);

            // Total
            const legalTotal = getTag(xmlDoc, "LegalMonetaryTotal");
            const totalAmount = parseFloat(getText(legalTotal, "PayableAmount") || 0);

            setInvoiceDetail({
                supplier_name: supplierName,
                supplier_tax_no: supplierTax,
                total_amount: totalAmount,
                lines: lines
            });

        } catch (error) {
            console.error('Fatura detayı yüklenirken hata:', error);
            alert("Detay hatası: " + (error.message || "Bilinmiyor"));
        } finally {
            setDetailLoading(false);
        }
    };

    const markAsProcessed = async () => {
        try {
            await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlendi');
            setShowDetailModal(false);
            loadInvoices();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const markAsNotProcessed = async () => {
        try {
            await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlenmeyecek');
            setShowDetailModal(false);
            loadInvoices();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const statuses = ['Tümü', 'Bekliyor', 'İşlendi', 'İşlenmeyecek', 'İptal Edildi'];

    // Filter and sort invoices
    const getFilteredInvoices = () => {
        let filtered = [...invoices];

        // Apply filters
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(inv =>
                inv.invoice_number?.toLowerCase().includes(term) ||
                inv.supplier_name?.toLowerCase().includes(term)
            );
        }
        if (filters.status !== 'Tümü') {
            filtered = filtered.filter(inv => inv.status === filters.status);
        }
        if (filters.startDate) {
            filtered = filtered.filter(inv => new Date(inv.date) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            filtered = filtered.filter(inv => new Date(inv.date) <= new Date(filters.endDate));
        }

        // Sort
        filtered.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'total') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            if (sortConfig.key === 'date') {
                valA = new Date(valA || 0);
                valB = new Date(valB || 0);
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            const comparison = String(valA || '').toLowerCase().localeCompare(String(valB || '').toLowerCase(), 'tr');
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return filtered;
    };

    const filteredInvoices = getFilteredInvoices();

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            status: 'Tümü',
            startDate: '',
            endDate: ''
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Bekliyor': return 'bg-amber-100 text-amber-700';
            case 'İşlendi': return 'bg-green-100 text-green-700';
            case 'İşlenmeyecek': return 'bg-gray-100 text-gray-700';
            case 'İptal Edildi': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR');
    };

    const totalAmount = filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="spinner" />
            </div>
        );
    }

    // --- PROCESS INVOICE LOGIC ---
    const handleProcessInvoice = async () => {
        if (!invoiceDetail) return;

        // 1. Validate Supplier
        if (!supplierMatch) {
            alert("Lütfen faturayı işlemek için bir cari (tedarikçi) seçin.");
            return;
        }

        // 2. Validate Items (Must all be matched)
        const allMatched = invoiceDetail.lines.every((_, index) => productMatches[index]);
        if (!allMatched) {
            alert("Lütfen tüm satırları stoktaki bir ürünle eşleştirin.");
            return;
        }

        if (!confirm("Bu faturayı işlemek istediğinize emin misiniz? Stoklar artacak ve cari alacağı güncellenecek.")) return;

        setProcessing(true);
        try {
            // A. Update Stocks
            for (let i = 0; i < invoiceDetail.lines.length; i++) {
                const line = invoiceDetail.lines[i];
                const productId = productMatches[i];
                const product = products.find(p => p.id == productId);

                if (product) {
                    // New stock calculation
                    const newStock = (product.stock || 0) + line.quantity;
                    // Also potentially update buying price? User didn't explicitly ask but it's common.
                    // For now just stock.
                    await productsAPI.updateStock(product.stock_code, { stock: newStock, buying_price: line.unit_price });
                }
            }

            // B. Add Transaction to Customer (Supplier)
            await customersAPI.addPurchaseTransaction({
                customer_id: supplierMatch,
                amount: invoiceDetail.total_amount,
                description: `${invoiceDescription || 'Fatura İşleme'} (${selectedInvoice.invoice_number})`
            });

            // C. Update Invoice Status
            await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlendi');

            alert("Fatura başarıyla işlendi ve stoklara alındı!");
            setShowDetailModal(false);
            loadInvoices();

        } catch (error) {
            console.error(error);
            alert("İşlem sırasında hata oluştu: " + error.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-0px)] transition-all duration-300">
            {/* Preview Modal (In-App) */}
            {previewModalOpen && previewHtml && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-gray-600">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </span>
                                Fatura Önizleme
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `fatura_${Date.now()}.html`;
                                        a.click();
                                    }}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    ⬇️ İndir
                                </button>
                                <button
                                    onClick={() => setPreviewModalOpen(false)}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    ✕ Kapat
                                </button>
                            </div>
                        </div>

                        {/* Iframe Content */}
                        <div className="flex-1 bg-gray-100 relative">
                            <iframe
                                title="Invoice Preview"
                                srcDoc={previewHtml}
                                className="w-full h-full border-none"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay (Faturanız Açılıyor) */}
            {viewLoading && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center flex-col animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse"></div>

                        <div className="w-20 h-20 mb-6 relative">
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                            <svg className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-gray-800 mb-2">Faturanız Açılıyor...</h3>
                        <p className="text-gray-500 text-center text-sm">
                            Belge sunucudan indiriliyor ve önizleme hazırlanıyor.
                        </p>

                        <div className="mt-6 flex gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Overlay (Mobile) */}
            {filterOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setFilterOpen(false)}
                />
            )}

            {/* Filter Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-72 bg-white border-r border-gray-200 p-5 overflow-y-auto
                transform transition-transform duration-300 flex flex-col
                ${filterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                    <span>🔍</span> Filtreler
                </h3>

                <div className="space-y-4 flex-1">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Fatura No / Tedarikçi</label>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            placeholder="Ara..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Durum</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            {statuses.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Tarih Aralığı</label>
                        <div className="space-y-2">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-200 space-y-2">
                    <button
                        onClick={clearFilters}
                        className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        ✕ Temizle
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-5 overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setFilterOpen(true)}
                            className="lg:hidden p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">📄 Gelen Faturalar</h1>
                            <p className="text-gray-500 text-sm mt-1">{filteredInvoices.length} fatura</p>
                        </div>
                    </div>
                    <button
                        onClick={syncInvoices}
                        disabled={syncing}
                        className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-purple-700 transition-all flex items-center gap-2 justify-center disabled:opacity-50"
                    >
                        {syncing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Senkronize ediliyor...
                            </>
                        ) : (
                            <>🔄 Faturaları Senkronize Et</>
                        )}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white text-center">
                        <p className="text-amber-100 text-sm">Bekleyen</p>
                        <p className="text-2xl font-bold">{invoices.filter((i) => i.status === 'Bekliyor').length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white text-center">
                        <p className="text-emerald-100 text-sm">İşlendi</p>
                        <p className="text-2xl font-bold">{invoices.filter((i) => i.status === 'İşlendi').length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-4 text-white text-center">
                        <p className="text-gray-100 text-sm">İşlenmeyecek</p>
                        <p className="text-2xl font-bold">{invoices.filter((i) => i.status === 'İşlenmeyecek').length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white text-center">
                        <p className="text-violet-100 text-sm">Toplam Tutar</p>
                        <p className="text-2xl font-bold">
                            {showTotal ? `₺${totalAmount.toLocaleString('tr-TR')}` : '******'}
                        </p>
                    </div>
                </div>

                {/* Invoices Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th
                                        onClick={() => handleSort('invoice_number')}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                    >
                                        Fatura No {getSortIcon('invoice_number')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('supplier_name')}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                    >
                                        Tedarikçi {getSortIcon('supplier_name')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('date')}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                    >
                                        Tarih {getSortIcon('date')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('total')}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                    >
                                        Tutar {getSortIcon('total')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Durum
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                        İşlemler
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-sm text-gray-600">{formatDate(invoice.date)}</td>
                                        <td className="px-4 py-3 font-mono text-sm text-gray-800 font-bold">{invoice.invoice_number}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800 text-sm truncate max-w-xs" title={invoice.supplier_name}>{invoice.supplier_name || '-'}</td>
                                        <td className="px-4 py-3 font-bold text-gray-900">₺{invoice.total?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${invoice.status === 'Bekliyor' ? 'bg-amber-100 text-amber-600' :
                                                invoice.status === 'İşlendi' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {invoice.status || 'Bekliyor'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2 relative z-10">
                                                {/* Görüntüle (Gray) */}
                                                <button
                                                    onClick={() => handleViewInvoice(invoice)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs font-medium transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    Görüntüle
                                                </button>

                                                {/* İşle (Blue/Monitor) */}
                                                <button
                                                    onClick={() => openDetailModal(invoice)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    İşle
                                                </button>

                                                {/* İşlenmeyecek (Yellow/Trash) - Assuming this acts as 'Delete' or 'Ignore' */}
                                                <button
                                                    onClick={() => { setSelectedInvoice(invoice); markAsNotProcessed(); }}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-400 text-white rounded hover:bg-amber-500 text-xs font-medium transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    İşlenmeyecek
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredInvoices.length === 0 && (
                            <div className="text-center py-12 text-gray-500">Fatura bulunamadı.</div>
                        )}
                    </div>
                </div>
            </main>

            {/* Detail Modal Redesign (Modern & enhanced) */}
            {showDetailModal && selectedInvoice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-gray-200">

                        {/* 1. Header (Premium Gradient) */}
                        <div className="bg-gradient-to-r from-slate-50 to-gray-100 p-8 border-b border-gray-200 grid grid-cols-12 gap-8 items-center relative overflow-hidden">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            <div className="col-span-12 md:col-span-8 grid grid-cols-2 gap-x-12 gap-y-4 relative z-10">
                                <div>
                                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">TEDARİKÇİ BİLGİSİ</span>
                                    <span className="text-slate-800 font-extrabold text-xl leading-tight block">{invoiceDetail?.supplier_name || selectedInvoice.supplier_name}</span>
                                    <span className="text-gray-500 text-sm font-medium mt-1 block flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        VKN: {invoiceDetail?.supplier_tax_no || '-'}
                                    </span>
                                </div>
                                <div className="text-right md:text-left">
                                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">FATURA NO</span>
                                    <span className="text-slate-800 font-bold text-xl leading-tight font-mono">{selectedInvoice.invoice_number}</span>
                                </div>

                                {/* Enhanced Supplier Matcher */}
                                <div className="col-span-2 mt-2 bg-white/60 p-1.5 rounded-lg border border-indigo-100 flex items-center gap-2 shadow-sm backdrop-blur-sm">
                                    <span className="text-[10px] font-bold text-indigo-700 whitespace-nowrap px-2 bg-indigo-50 rounded py-1">CARİ EŞLEŞTİRME</span>
                                    <div className="flex-1 flex gap-2">
                                        <select
                                            className="flex-1 bg-transparent border-0 text-sm font-semibold text-gray-700 focus:ring-0 cursor-pointer outline-none"
                                            value={supplierMatch || ''}
                                            onChange={(e) => setSupplierMatch(e.target.value)}
                                        >
                                            <option value="">-- Bir Cari Seçiniz --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>

                                        {!supplierMatch && invoiceDetail?.supplier_name && (
                                            <button
                                                onClick={async () => {
                                                    if (confirm(`"${invoiceDetail.supplier_name}" adında yeni bir cari oluşturulacak. Onaylıyor musunuz?`)) {
                                                        setProcessing(true);
                                                        try {
                                                            const newCustomer = {
                                                                name: invoiceDetail.supplier_name,
                                                                tax_number: invoiceDetail.supplier_tax_no,
                                                                address: '-',
                                                                phone: '-',
                                                                balance: 0
                                                            };
                                                            const res = await customersAPI.add(newCustomer);
                                                            if (res.data?.success) {
                                                                // Refresh customers to get the new one
                                                                const cRes = await customersAPI.getAll();
                                                                setCustomers(cRes.data?.customers || []);
                                                                setSupplierMatch(res.data.id);
                                                                alert("Cari başarıyla oluşturuldu ve seçildi.");
                                                            }
                                                        } catch (e) {
                                                            alert("Hata: " + e.message);
                                                        } finally {
                                                            setProcessing(false);
                                                        }
                                                    }
                                                }}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm transition-all flex items-center gap-1 whitespace-nowrap"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                Yeni Cari Olarak Ekle
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-12 md:col-span-4 text-right relative z-10">
                                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block mb-1">GENEL TOPLAM</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 font-extrabold text-4xl tracking-tight">
                                    {invoiceDetail
                                        ? `₺${invoiceDetail.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : '...'}
                                </span>
                            </div>
                        </div>

                        {/* 2. Content (Modern Table) */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
                            {detailLoading ? (
                                <div className="flex flex-col items-center justify-center py-24 space-y-6">
                                    <div className="relative">
                                        <div className="w-16 h-16 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                                        </div>
                                    </div>
                                    <p className="text-slate-500 font-medium animate-pulse">Fatura detayları analiz ediliyor...</p>
                                </div>
                            ) : invoiceDetail ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-100 font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4 text-center w-16">#</th>
                                                <th className="px-6 py-4 text-left">Ürün / Hizmet</th>
                                                <th className="px-6 py-4 text-center w-28">Miktar</th>
                                                <th className="px-6 py-4 text-right w-36">Birim Fiyat</th>
                                                <th className="px-6 py-4 text-center w-24">İsk. %</th>
                                                <th className="px-6 py-4 text-center w-24">KDV %</th>
                                                <th className="px-6 py-4 text-right w-36">Net Tutar</th>
                                                <th className="px-6 py-4 text-center w-32">Durum</th>
                                                <th className="px-6 py-4 text-center w-48">Eşleştirme</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {invoiceDetail.lines.map((item, index) => {
                                                const isMatched = !!productMatches[index];
                                                const matchedProduct = products.find(p => p.id == productMatches[index]);

                                                return (
                                                    <tr key={index} className={`hover:bg-slate-50 transition-colors group ${isMatched ? 'bg-green-50/40 hover:bg-green-50/60' : ''}`}>
                                                        <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {matchedProduct ? (
                                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                                        {matchedProduct.stock_code}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Eşleşmedi</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{item.quantity}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                            ₺{item.unit_price.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-gray-400">
                                                            {item.discount > 0 ? (
                                                                <span className="text-red-500 font-bold">%{((item.discount / (item.quantity * item.unit_price)) * 100).toFixed(0)}</span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-gray-500">
                                                            %{item.vat_rate}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-gray-800">
                                                            ₺{item.line_net.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                                Bekliyor
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex justify-center">
                                                                {isMatched ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            setMatchModalData({ index, line: item });
                                                                            setMatchModalOpen(true);
                                                                        }}
                                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 shadow-sm transition-all text-xs font-bold"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                                        Değiştir/Düzelt
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setMatchModalData({ index, line: item });
                                                                            setMatchModalOpen(true);
                                                                        }}
                                                                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 shadow-sm transition-all text-xs font-bold"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                                        Eşleştir
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td colSpan="9" className="px-6 py-3 text-right text-xs text-gray-500 italic">
                                                    * Toplam {invoiceDetail.lines.length} kalem ürün listelenmektedir.
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
                                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <h3 className="text-lg font-medium text-gray-900">Görüntülenecek Detay Yok</h3>
                                    <p className="text-gray-500 mt-1">Fatura içeriği henüz yüklenmedi veya ayrıştırılamadı.</p>
                                </div>
                            )}
                        </div>

                        {/* 3. Footer (Action Area) */}
                        <div className="p-6 bg-white border-t border-gray-200 grid grid-cols-12 gap-6 items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                            <div className="col-span-12 md:col-span-7">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Fatura Açıklaması / İşlem Notu (İsteğe Bağlı)"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl pl-10 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                                        value={invoiceDescription}
                                        onChange={(e) => setInvoiceDescription(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="col-span-12 md:col-span-5 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="px-6 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 hover:text-gray-800 transition-colors shadow-sm text-sm"
                                >
                                    Kapat
                                </button>
                                <button
                                    onClick={handleProcessInvoice}
                                    disabled={processing || selectedInvoice.status === 'İşlendi'}
                                    className={`px-8 py-3.5 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 text-sm transform hover:-translate-y-0.5
                                        ${selectedInvoice.status === 'İşlendi'
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none hover:translate-y-0'
                                            : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700'}`}
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            İşleniyor...
                                        </>
                                    ) : selectedInvoice.status === 'İşlendi' ? (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                            Bu Fatura İşlendi
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                            Faturayı Kaydet
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Product Match Modal */}
            <ProductMatchModal
                isOpen={matchModalOpen}
                onClose={() => setMatchModalOpen(false)}
                invoiceLine={matchModalData?.line}
                products={products}
                onSelect={(product) => {
                    setProductMatches({ ...productMatches, [matchModalData.index]: product.id });
                    setMatchModalOpen(false);
                }}
                onCreateNew={async () => {
                    if (!matchModalData?.line) return;
                    const line = matchModalData.line;

                    if (confirm(`"${line.name}" için yeni stok kartı oluşturulacak. Onaylıyor musunuz?`)) {
                        setProcessing(true);
                        try {
                            const newProduct = {
                                stock_code: `GEN-${Date.now().toString().slice(-6)}`,
                                name: line.name,
                                brand: 'Genel',
                                group: 'Genel',
                                price: line.unit_price * 1.5,
                                buying_price: line.unit_price,
                                stock: 0,
                                vat_rate: line.vat_rate,
                                image_url: ''
                            };

                            const res = await productsAPI.add(newProduct);
                            if (res.data) {
                                const pRes = await productsAPI.getAll();
                                setProducts(pRes.data?.products || []);

                                const createdProduct = res.data;
                                setProductMatches({ ...productMatches, [matchModalData.index]: createdProduct.id });
                                setMatchModalOpen(false);
                                alert("Ürün oluşturuldu ve eşleştirildi.");
                            }
                        } catch (err) {
                            alert("Hata: " + err.message);
                        } finally {
                            setProcessing(false);
                        }
                    }
                }}
            />
        </div>
    );
}

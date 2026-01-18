import React, { useState, useEffect } from 'react';
import ShortcutGroupsModal from '../components/modals/ShortcutGroupsModal';
import ReceiptDesignerModal from '../components/modals/ReceiptDesignerModal';
import IntegrationSettingsModal from '../components/modals/IntegrationSettingsModal';
import SecretTokenModal from '../components/modals/SecretTokenModal';
import { settingsAPI, productsAPI } from '../services/api';
import axios from 'axios';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);

    // Settings State
    const [askQuantity, setAskQuantity] = useState(false);
    const [cancelPassword, setCancelPassword] = useState('123456');
    const [editSalePassword, setEditSalePassword] = useState('123456');
    const [showTotalSales, setShowTotalSales] = useState(true);
    const [showTotalRevenue, setShowTotalRevenue] = useState(true);
    const [showInvoiceTotal, setShowInvoiceTotal] = useState(true);
    const [sendSalesToBirFatura, setSendSalesToBirFatura] = useState(false);
    const [secretToken, setSecretToken] = useState('...');

    // Modals
    const [showShortcutModal, setShowShortcutModal] = useState(false);
    const [showReceiptDesigner, setShowReceiptDesigner] = useState(false);
    const [showIntegrationModal, setShowIntegrationModal] = useState(false);
    const [showSecretTokenModal, setShowSecretTokenModal] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { data } = await settingsAPI.getAll();
            if (data) {
                if (data['pos_settings_ask_quantity'] !== undefined) setAskQuantity(data['pos_settings_ask_quantity']);
                if (data['sales_cancel_password']) setCancelPassword(data['sales_cancel_password']);
                if (data['sales_edit_password']) setEditSalePassword(data['sales_edit_password']);
                if (data['sales_show_total_sales'] !== undefined) setShowTotalSales(data['sales_show_total_sales']);
                if (data['sales_show_total_revenue'] !== undefined) setShowTotalRevenue(data['sales_show_total_revenue']);
                if (data['invoices_show_total'] !== undefined) setShowInvoiceTotal(data['invoices_show_total']);
                if (data['integration_send_sales_to_birfatura'] !== undefined) setSendSalesToBirFatura(data['integration_send_sales_to_birfatura']);
                if (data['secret_token']) setSecretToken(data['secret_token']);
            }
        } catch (error) {
            console.error("Settings load error:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key, value) => {
        try {
            await settingsAPI.set(key, value);
        } catch (err) {
            console.error(`Failed to save setting ${key}:`, err);
            alert("Ayar kaydedilemedi.");
        }
    };

    const toggleAskQuantity = () => {
        const newValue = !askQuantity;
        setAskQuantity(newValue);
        updateSetting('pos_settings_ask_quantity', newValue);
    };

    const handlePasswordChange = async (e) => {
        const newPassword = e.target.value;
        setCancelPassword(newPassword);
        updateSetting('sales_cancel_password', newPassword);
    };

    const handleEditSalePasswordChange = async (e) => {
        const newPassword = e.target.value;
        setEditSalePassword(newPassword);
        updateSetting('sales_edit_password', newPassword);
    };

    const toggleShowTotalSales = () => {
        const newValue = !showTotalSales;
        setShowTotalSales(newValue);
        updateSetting('sales_show_total_sales', newValue);
    };

    const toggleShowTotalRevenue = () => {
        const newValue = !showTotalRevenue;
        setShowTotalRevenue(newValue);
        updateSetting('sales_show_total_revenue', newValue);
    };

    const toggleShowInvoiceTotal = () => {
        const newValue = !showInvoiceTotal;
        setShowInvoiceTotal(newValue);
        updateSetting('invoices_show_total', newValue);
    };

    const toggleSendSalesToBirFatura = () => {
        const newValue = !sendSalesToBirFatura;
        setSendSalesToBirFatura(newValue);
        updateSetting('integration_send_sales_to_birfatura', newValue);
    };

    const handleRepairStockCode = async () => {
        const code = prompt("Sorunlu stok kodunu giriniz (Örn: STK-0001):");
        if (!code) return;

        try {
            // Call backend proxy which has admin/service role access
            const response = await axios.post('/api/products/force-delete', { stockCode: code.trim() });

            if (response.data.success) {
                alert(response.data.message);
            } else {
                alert("İşlem başarısız: " + response.data.message);
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message;
            alert("İşlem başarısız: " + msg);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Ayarlar yükleniyor...</div>;
    }

    return (
        <div className="h-[calc(100vh-64px)] overflow-y-auto p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Ayarlar</h1>

            <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satış Ekranı Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Ürün Seçince Miktar Sor</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Aktif edilirse, ürün listesinden veya barkod ile ürün seçildiğinde miktar girmeniz için bir pencere açılır.
                            </p>
                        </div>

                        <button
                            onClick={toggleAskQuantity}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${askQuantity ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${askQuantity ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Satış Ekranındaki Kısayol Grup İsimleri</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satış ekranında görünen özel ürün grubu kategorilerini yönetin.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowShortcutModal(true)}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors shadow-sm"
                        >
                            Grupları Yönet
                        </button>
                    </div>
                </div>
            </div>

            {/* Satış Ayarları / İptal Şifresi */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satış ve İptal Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                        <div>
                            <h3 className="font-semibold text-red-800">Satışı İptal Etme Parolası</h3>
                            <p className="text-sm text-red-600 mt-1">
                                "Satış Detayı" ekranında satışı iptal etmek istediğinizde sorulacak parolayı belirleyin.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Parola:</span>
                            <input
                                type="text"
                                value={cancelPassword}
                                onChange={handlePasswordChange}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-center font-mono w-32"
                                placeholder="******"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div>
                            <h3 className="font-semibold text-orange-800">Satış Detaylarını Değiştirme Parolası</h3>
                            <p className="text-sm text-orange-600 mt-1">
                                Geçmiş satışların detaylarını düzenlerken sorulacak parolayı belirleyin.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Parola:</span>
                            <input
                                type="text"
                                value={editSalePassword}
                                onChange={handleEditSalePasswordChange}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono w-32"
                                placeholder="******"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Satış Kartını Göster</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satışlar sayfasındaki "Toplam Satış" bilgi kartını göster veya gizle.
                            </p>
                        </div>

                        <button
                            onClick={toggleShowTotalSales}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showTotalSales ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showTotalSales ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Ciro Kartını Göster</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satışlar sayfasındaki "Toplam Ciro" bilgi kartını göster veya gizle.
                            </p>
                        </div>

                        <button
                            onClick={toggleShowTotalRevenue}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showTotalRevenue ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showTotalRevenue ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Fiş Tasarımı Bölümü */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satış Sonrası Fiş Tasarımı
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Fiş Görünümü Tasarla</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satış sonrası yazdırılacak fişin görsel tasarımını özelleştirin. Metin, şekil ve resim elementleri ekleyebilirsiniz.
                            </p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Sürükle Bırak</span>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Canlı Önizleme</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Değişken Desteği</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowReceiptDesigner(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Tasarımcıyı Aç
                        </button>
                    </div>
                </div>
            </div>

            {/* Gelen Faturalar Ayarları */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Gelen Faturalar Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Tutar Görünümü</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Gelen Faturalar sayfasındaki toplam tutar kartını göster veya gizle.
                            </p>
                        </div>

                        <button
                            onClick={toggleShowInvoiceTotal}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showInvoiceTotal ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showInvoiceTotal ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Entegrasyon Ayarlari */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Entegrasyon Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">BirFatura Entegrasyonu</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                E-Fatura ve E-Arşiv işlemleriniz için BirFatura API anahtarlarınızı yapılandırın.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowIntegrationModal(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-semibold text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                            </svg>
                            Ayarları Yapılandır
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Satışları BirFaturaya Sipariş Olarak Gönder</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Aktif edilirse, tamamlanan her satış otomatik olarak BirFatura sistemine sipariş olarak iletilir.
                            </p>
                        </div>

                        <button
                            onClick={toggleSendSalesToBirFatura}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${sendSalesToBirFatura ? 'bg-orange-500' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${sendSalesToBirFatura ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Secret Token Row */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Sipariş Entegrasyon Token (Secret Token)</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Kayıtlı Token: <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                                    {secretToken.length > 20 ? secretToken.substring(0, 20) + '...' : secretToken}
                                </span>
                            </p>
                        </div>

                        <button
                            onClick={() => setShowSecretTokenModal(true)}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Düzenle
                        </button>
                    </div>
                </div>
            </div>

            {/* Veri Onarımı / Araçlar */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Veri Onarımı ve Araçlar
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-zinc-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Stok Kodu Çakışması Gider</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                "Stok kodu kullanımda" hatası alıyorsanız ancak ürünü bulamıyorsanız bu aracı kullanın. Silinmiş/gizli kaydı temizler.
                            </p>
                        </div>

                        <button
                            onClick={handleRepairStockCode}
                            className="px-5 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 font-semibold text-sm transition-all shadow-lg shadow-gray-500/25 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Stok Kodu Onar
                        </button>
                    </div>
                </div>
            </div>

            <ShortcutGroupsModal
                isOpen={showShortcutModal}
                onClose={() => setShowShortcutModal(false)}
            />

            <ReceiptDesignerModal
                isOpen={showReceiptDesigner}
                onClose={() => setShowReceiptDesigner(false)}
            />

            <IntegrationSettingsModal
                isOpen={showIntegrationModal}
                onClose={() => setShowIntegrationModal(false)}
            />

            <SecretTokenModal
                isOpen={showSecretTokenModal}
                onClose={() => {
                    setShowSecretTokenModal(false);
                    loadSettings(); // Reload to show new token
                }}
            />
        </div>
    );
}

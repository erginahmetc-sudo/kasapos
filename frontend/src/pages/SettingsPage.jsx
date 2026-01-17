import React, { useState, useEffect } from 'react';
import ShortcutGroupsModal from '../components/modals/ShortcutGroupsModal';
import ReceiptDesignerModal from '../components/modals/ReceiptDesignerModal';
import IntegrationSettingsModal from '../components/modals/IntegrationSettingsModal';
import SecretTokenModal from '../components/modals/SecretTokenModal';
import { supabase } from '../lib/supabaseClient';
import { API_URL } from '../lib/config';

export default function SettingsPage() {
    const [askQuantity, setAskQuantity] = useState(false);
    // Cancellation password state
    const [cancelPassword, setCancelPassword] = useState('');
    const [savedPassword, setSavedPassword] = useState('');

    useEffect(() => {
        const savedSetting = localStorage.getItem('pos_settings_ask_quantity');
        if (savedSetting === 'true') {
            setAskQuantity(true);
        }

        // Load saved password
        const savedPwd = localStorage.getItem('sales_cancel_password');
        if (savedPwd) {
            setSavedPassword(savedPwd);
            setCancelPassword(savedPwd);
        } else {
            // Default password if not set
            setSavedPassword('123456');
            setCancelPassword('123456');
            localStorage.setItem('sales_cancel_password', '123456');
        }
    }, []);

    const toggleAskQuantity = () => {
        const newValue = !askQuantity;
        setAskQuantity(newValue);
        localStorage.setItem('pos_settings_ask_quantity', newValue);
    };

    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setCancelPassword(newPassword);
        localStorage.setItem('sales_cancel_password', newPassword);
        setSavedPassword(newPassword);
    };

    // Sales Page Visibility Settings
    const [showTotalSales, setShowTotalSales] = useState(true);
    const [showTotalRevenue, setShowTotalRevenue] = useState(true);

    useEffect(() => {
        const savedShowSales = localStorage.getItem('sales_show_total_sales');
        if (savedShowSales !== null) {
            setShowTotalSales(savedShowSales === 'true');
        }

        const savedShowRevenue = localStorage.getItem('sales_show_total_revenue');
        if (savedShowRevenue !== null) {
            setShowTotalRevenue(savedShowRevenue === 'true');
        }
    }, []);

    const toggleShowTotalSales = () => {
        const newValue = !showTotalSales;
        setShowTotalSales(newValue);
        localStorage.setItem('sales_show_total_sales', newValue);
    };

    const toggleShowTotalRevenue = () => {
        const newValue = !showTotalRevenue;
        setShowTotalRevenue(newValue);
        localStorage.setItem('sales_show_total_revenue', newValue);
    };

    // Invoice Settings
    const [showInvoiceTotal, setShowInvoiceTotal] = useState(true);

    useEffect(() => {
        const savedShowTotal = localStorage.getItem('invoices_show_total');
        if (savedShowTotal !== null) {
            setShowInvoiceTotal(savedShowTotal === 'true');
        }
    }, []);

    const toggleShowInvoiceTotal = () => {
        const newValue = !showInvoiceTotal;
        setShowInvoiceTotal(newValue);
        localStorage.setItem('invoices_show_total', newValue);
    };

    const [showShortcutModal, setShowShortcutModal] = useState(false);
    const [showReceiptDesigner, setShowReceiptDesigner] = useState(false);
    const [showIntegrationModal, setShowIntegrationModal] = useState(false);
    const [showSecretTokenModal, setShowSecretTokenModal] = useState(false);

    const [sendSalesToBirFatura, setSendSalesToBirFatura] = useState(false);
    const [secretToken, setSecretToken] = useState('...');

    useEffect(() => {
        const savedSendSales = localStorage.getItem('integration_send_sales_to_birfatura');
        if (savedSendSales !== null) {
            setSendSalesToBirFatura(savedSendSales === 'true');
        }

        // Fetch Secret Token for display
        const fetchToken = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                    setSecretToken('Giriş Yapılmalı');
                    return;
                }

                const res = await fetch(`${API_URL}/api/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.secret_token) {
                        setSecretToken(data.secret_token);
                    }
                } else {
                    setSecretToken('Yetkisiz Erişim');
                }
            } catch (err) {
                console.error("Token fetch error:", err);
                setSecretToken('Hata');
            }
        };

        fetchToken();
    }, []);

    const toggleSendSalesToBirFatura = () => {
        const newValue = !sendSalesToBirFatura;
        setSendSalesToBirFatura(newValue);
        localStorage.setItem('integration_send_sales_to_birfatura', newValue);
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Ayarlar</h1>

            <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satis Ekrani Ayarlari
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Urun Secince Miktar Sor</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Aktif edilirse, urun listesinden veya barkod ile urun secildiginde miktar girmeniz icin bir pencere acilir.
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
                            <h3 className="font-semibold text-gray-800">Satis Ekranindaki Kisayol Grup Isimleri</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satis ekraninda gorunen ozel urun grubu kategorilerini yonetin.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowShortcutModal(true)}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors shadow-sm"
                        >
                            Gruplari Yonet
                        </button>
                    </div>
                </div>
            </div>

            {/* Satis Ayarlari / Iptal Sifresi */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satis ve Iptal Ayarlari
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                        <div>
                            <h3 className="font-semibold text-red-800">Satisi Iptal Etme Parolasi</h3>
                            <p className="text-sm text-red-600 mt-1">
                                "Satis Detayi" ekraninda satisi iptal etmek istediginizde sorulacak parolayi belirleyin.
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

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Satis Kartini Goster</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satislar sayfasindaki "Toplam Satis" bilgi kartini goster veya gizle.
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
                            <h3 className="font-semibold text-gray-800">Toplam Ciro Kartini Goster</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satislar sayfasindaki "Toplam Ciro" bilgi kartini goster veya gizle.
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

            {/* Fis Tasarimi Bolumu */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satis Sonrasi Fis Tasarimi
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Fis Gorunumu Tasarla</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satis sonrasi yazdirilacak fisin gorsel tasarimini ozellestin. Metin, sekil ve resim elementleri ekleyebilirsin.
                            </p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Surukle Birak</span>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Canli Onizleme</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Degisken Destegi</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowReceiptDesigner(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Tasarimciyi Ac
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
                onClose={() => setShowSecretTokenModal(false)}
            />
        </div>
    );
}

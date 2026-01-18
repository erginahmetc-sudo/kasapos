import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';

export default function SecretTokenModal({ isOpen, onClose }) {
    const [secretToken, setSecretToken] = useState('Yükleniyor...');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadToken();
        }
    }, [isOpen]);

    const loadToken = async () => {
        try {
            const { data } = await settingsAPI.get('secret_token');
            setSecretToken(data || '');
        } catch (e) {
            console.error("Error fetching secret token", e);
            setSecretToken('Hata');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsAPI.set('secret_token', secretToken.trim());
            alert("Token başarıyla kaydedildi.");
            onClose();
        } catch (e) {
            console.error("Error saving token", e);
            alert("Bağlantı hatası: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                {/* Header - Modern Gradient */}
                <div className="bg-gradient-to-r from-red-500 to-rose-600 px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Entegrasyon Token Yönetimi</h2>
                            <p className="text-red-100 mt-1">Sipariş / Stok Entegrasyon Güvenlik Anahtarı</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-3 rounded-xl transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body - More Spacious */}
                <div className="p-8 space-y-6">
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-xl text-base text-amber-800 border border-amber-200">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p>
                                Bu token, dış sistemlerin (örn. <strong>BirFatura paneli</strong>) bu programa bağlanıp siparişleri çekebilmesi için kullanılır.
                                <strong> Lütfen güvenli bir yerde saklayın ve kimseyle paylaşmayın.</strong>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-base font-semibold text-gray-800">Secret Token</label>
                        <input
                            type="text"
                            value={secretToken}
                            onChange={(e) => setSecretToken(e.target.value)}
                            placeholder="Örn: f8d7b6a5-1234-5678-abcd-ef0123456789"
                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-mono text-base"
                        />
                    </div>
                </div>

                {/* Footer - Larger Buttons */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-5 border-t border-gray-200 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-base font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-base font-bold hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {saving ? 'Kaydediliyor...' : 'Token Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

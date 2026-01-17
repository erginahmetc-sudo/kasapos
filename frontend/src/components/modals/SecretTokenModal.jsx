import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { API_URL } from '../../lib/config';

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
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setSecretToken('Oturum Kapalı');
                return;
            }

            const res = await fetch(`${API_URL}/api/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setSecretToken(data.secret_token || '');
            } else {
                setSecretToken('Yetkisiz Erişim');
            }
        } catch (e) {
            console.error("Error fetching secret token", e);
            setSecretToken('Bağlantı Hatası (Backend çalışmıyor olabilir)');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                alert("Oturum süreniz dolmuş, lütfen tekrar giriş yapın.");
                return;
            }

            const res = await fetch(`${API_URL}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ secret_token: secretToken.trim() })
            });

            if (res.ok) {
                alert("Token başarıyla kaydedildi. Backend'in yeni token ile çalışması için lütfen programı yeniden başlatın.");
                onClose();
            } else {
                alert("Token kaydedilemedi.");
            }
        } catch (e) {
            console.error("Error saving token", e);
            alert("Bağlantı hatası.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden transform transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-50 to-rose-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Entegrasyon Token Yönetimi</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Sipariş / Stok Entegrasyon Güvenliği</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-700 border border-amber-100 mb-4">
                        <p>
                            Bu token, dış sistemlerin (örn. BirFatura paneli) bu programa bağlanıp siparişleri çekebilmesi için kullanılır.
                            Lütfen güvenli bir yerde saklayın.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Secret Token</label>
                        <input
                            type="text"
                            value={secretToken}
                            onChange={(e) => setSecretToken(e.target.value)}
                            placeholder="Örn: f8d7b6a5-..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg text-sm font-medium hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/30 transition-all"
                    >
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

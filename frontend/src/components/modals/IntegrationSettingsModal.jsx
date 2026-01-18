import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';

export default function IntegrationSettingsModal({ isOpen, onClose }) {
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [integrationKey, setIntegrationKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            // Load from database (per-company)
            const apiKeyRes = await settingsAPI.get('birfatura_api_key');
            const secretKeyRes = await settingsAPI.get('birfatura_secret_key');
            const integrationKeyRes = await settingsAPI.get('birfatura_integration_key');

            setApiKey(apiKeyRes.data || '');
            setSecretKey(secretKeyRes.data || '');
            setIntegrationKey(integrationKeyRes.data || '');
        } catch (e) {
            console.error("Error loading birfatura settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save to database (per-company)
            await settingsAPI.set('birfatura_api_key', apiKey.trim());
            await settingsAPI.set('birfatura_secret_key', secretKey.trim());
            await settingsAPI.set('birfatura_integration_key', integrationKey.trim());



            alert("Ayarlar başarıyla kaydedildi.");
            onClose();
        } catch (e) {
            console.error("Error saving settings", e);
            alert("Ayarlar kaydedilemedi: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden transform transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">BirFatura Entegrasyonu</h2>
                        <p className="text-xs text-gray-500 mt-0.5">E-Fatura / E-Arşiv API Anahtarları</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 border border-blue-100 mb-4">
                        <p>Lütfen BirFatura panelinden aldığınız API anahtarlarını giriniz.</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">API Key</label>
                        <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="BirFatura API Key"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Secret Key</label>
                        <input
                            type="password"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            placeholder="BirFatura Secret Key"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Integration Key</label>
                        <input
                            type="text"
                            value={integrationKey}
                            onChange={(e) => setIntegrationKey(e.target.value)}
                            placeholder="BirFatura Integration Key"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono text-sm"
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
                        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/30 transition-all"
                    >
                        {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

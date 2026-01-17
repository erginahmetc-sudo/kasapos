import React, { useState, useEffect } from 'react';

export default function KeyboardShortcutsModal({ onClose, onSave }) {
    // Default shortcuts
    const defaultShortcuts = {
        'miktar_duzenle': 'F2',
        'iskonto_ekle': 'F3',
        'fiyat_duzenle': 'F4',
        'nakit_odeme': 'F8',
        'pos_odeme': 'F9',
        'musteri_sec': 'F10',
        'search_focus': 'F1'
    };

    const [shortcuts, setShortcuts] = useState(defaultShortcuts);

    // Available keys
    const availableKeys = [
        'None', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'
    ];

    useEffect(() => {
        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) {
            try {
                setShortcuts({ ...defaultShortcuts, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Error parsing shortcuts", e);
            }
        }
    }, []);

    const handleChange = (action, key) => {
        setShortcuts(prev => ({ ...prev, [action]: key }));
    };

    const handleSave = () => {
        localStorage.setItem('pos_keyboard_shortcuts', JSON.stringify(shortcuts));
        if (onSave) onSave(shortcuts);
        onClose();
    };

    const actions = [
        { id: 'miktar_duzenle', label: 'Miktar Düzenle' },
        { id: 'iskonto_ekle', label: 'İskonto Ekle' },
        { id: 'fiyat_duzenle', label: 'Fiyat Düzenle' },
        { id: 'nakit_odeme', label: 'Nakit Ödeme' },
        { id: 'pos_odeme', label: 'POS Ödeme' },
        { id: 'musteri_sec', label: 'Müşteri Seç' },
        { id: 'search_focus', label: 'Ürün Arama Odak' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Klavye Kısayolları</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {actions.map(action => (
                        <div key={action.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <span className="font-semibold text-gray-700">{action.label}</span>
                            <div className="flex items-center gap-3">
                                <select
                                    value={shortcuts[action.id] || 'None'}
                                    onChange={(e) => handleChange(action.id, e.target.value)}
                                    className="block w-28 pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm bg-white"
                                >
                                    {availableKeys.map(key => (
                                        <option key={key} value={key}>{key}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md hover:shadow-lg transition-all"
                    >
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}

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
        'search_focus': 'F1',
        'tanimsiz_urun': 'Insert'
    };

    const [shortcuts, setShortcuts] = useState(defaultShortcuts);
    const [activeKey, setActiveKey] = useState(null);

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
        setActiveKey(null);
    };

    const handleSave = () => {
        // Validate for duplicates
        const values = Object.values(shortcuts).filter(v => v !== 'None');
        const uniqueValues = new Set(values);
        if (values.length !== uniqueValues.size) {
            alert("Her tuş 1 kısayola atanabilir");
            return;
        }

        localStorage.setItem('pos_keyboard_shortcuts', JSON.stringify(shortcuts));
        window.dispatchEvent(new Event('shortcutsUpdated'));
        if (onSave) onSave(shortcuts);
        onClose();
    };

    const actions = [
        { id: 'search_focus', label: 'Ürün Arama', icon: '🔍' },
        { id: 'tanimsiz_urun', label: 'Tanımsız Ürün Ekle', icon: '➕' },
        { id: 'miktar_duzenle', label: 'Miktar Düzenle', icon: '🔢' },
        { id: 'iskonto_ekle', label: 'İskonto Ekle', icon: '🏷️' },
        { id: 'fiyat_duzenle', label: 'Fiyat Düzenle', icon: '💵' },
        { id: 'musteri_sec', label: 'Müşteri Seç', icon: '👤' },
        { id: 'nakit_odeme', label: 'Nakit Ödeme', icon: '💶' },
        { id: 'pos_odeme', label: 'Kredi Kartı', icon: '💳' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-white shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Klavye Kısayolları</h2>
                        <p className="text-indigo-100 text-sm mt-1">Hızlı satış işlemleri için tuşları özelleştirin</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all shadow-lg shadow-black/10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                    <div className="grid gap-2 p-2">
                        {actions.map(action => (
                            <div
                                key={action.id}
                                className={`
                                    group flex items-center justify-between p-4 border transition-all duration-200
                                    ${activeKey === action.id
                                        ? 'bg-white border-violet-500 shadow-lg shadow-violet-100 ring-2 ring-violet-100 transform scale-[1.02] z-10'
                                        : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`
                                        w-12 h-12 flex items-center justify-center text-2xl shadow-sm transition-colors
                                        ${activeKey === action.id ? 'bg-violet-100' : 'bg-gray-100 group-hover:bg-gray-200'}
                                    `}>
                                        {action.icon}
                                    </div>
                                    <span className="font-bold text-gray-700 text-lg">{action.label}</span>
                                </div>
                                <div className="relative">
                                    <select
                                        value={shortcuts[action.id] || 'None'}
                                        onChange={(e) => handleChange(action.id, e.target.value)}
                                        onFocus={() => setActiveKey(action.id)}
                                        onBlur={() => setActiveKey(null)}
                                        className={`
                                            appearance-none cursor-pointer w-28 py-2.5 pl-4 pr-8 text-center font-mono font-bold text-lg border-2 outline-none transition-all
                                            ${activeKey === action.id
                                                ? 'bg-violet-50 border-violet-500 text-violet-700 shadow-inner'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                            }
                                        `}
                                    >
                                        {availableKeys.map(key => (
                                            <option key={key} value={key}>{key}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                    <button
                        onClick={handleSave}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <span>Değişiklikleri Kaydet</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full mt-3 py-3 text-gray-500 font-semibold hover:text-gray-700 transition-colors text-sm"
                    >
                        Vazgeç
                    </button>
                </div>
            </div>
        </div>
    );
}

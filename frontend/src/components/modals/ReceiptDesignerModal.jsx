import { useState, useEffect, useRef } from 'react';
import defaultTemplate from '../../data/default_receipt_template.json';
import template80mm from '../../data/receipt_template_80mm.json';
import template58mm from '../../data/receipt_template_58mm.json';

const PAPER_SIZES = {
    'A5 (148x210mm)': { width: 420, height: 595 },
    'A4 (210x297mm)': { width: 595, height: 842 },
    'Termal 80mm': { width: 280, height: 400 },
    'Termal 58mm': { width: 200, height: 400 },
};

// Get default template by paper size
const getDefaultTemplateForSize = (paperSize) => {
    switch (paperSize) {
        case 'Termal 80mm':
            return { ...template80mm };
        case 'Termal 58mm':
            return { ...template58mm };
        case 'A4 (210x297mm)':
        case 'A5 (148x210mm)':
        default:
            return { ...defaultTemplate };
    }
};

const AVAILABLE_VARIABLES = [
    { key: '{{TARIH}}', label: 'Tarih' },
    { key: '{{SAAT}}', label: 'Saat' },
    { key: '{{MUSTERI_ADI}}', label: 'Musteri Adi' },
    { key: '{{URUN_ADI}}', label: 'Urun Adi' },
    { key: '{{MIKTAR}}', label: 'Miktar' },
    { key: '{{FIYAT}}', label: 'Fiyat' },
    { key: '{{SATIR_TOPLAM}}', label: 'Satir Toplam' },
    { key: '{{GENEL_TOPLAM}}', label: 'Genel Toplam' },
    { key: '{{ESKI_BAKIYE}}', label: 'Eski Bakiye' },
    { key: '{{YENI_BAKIYE}}', label: 'Yeni Bakiye' },
];

export default function ReceiptDesignerModal({ isOpen, onClose, initialPaperSize }) {
    const [template, setTemplate] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            // Load from localStorage or use default based on initialPaperSize
            const savedKey = `receipt_design_template_${initialPaperSize || 'default'}`;
            const saved = localStorage.getItem(savedKey);
            if (saved) {
                try {
                    setTemplate(JSON.parse(saved));
                } catch {
                    setTemplate(getDefaultTemplateForSize(initialPaperSize || 'Termal 80mm'));
                }
            } else {
                setTemplate(getDefaultTemplateForSize(initialPaperSize || 'Termal 80mm'));
            }
        }
    }, [isOpen, initialPaperSize]);

    if (!isOpen || !template) return null;

    const paperSize = PAPER_SIZES[template.paper_size] || PAPER_SIZES['A5 (148x210mm)'];

    const handleSave = () => {
        // Always save with the paper size that was selected in Settings
        const savedKey = `receipt_design_template_${initialPaperSize || template.paper_size}`;
        localStorage.setItem(savedKey, JSON.stringify(template));
        alert(`${initialPaperSize || template.paper_size} için tasarım kaydedildi!`);
    };

    const handleReset = () => {
        if (confirm('Varsayilan tasarima donmek istediginize emin misiniz?')) {
            setTemplate(getDefaultTemplateForSize(template.paper_size));
            setSelectedItem(null);
        }
    };

    const handlePaperSizeChange = (newSize) => {
        if (confirm(`Kagit boyutunu "${newSize}" olarak degistirmek istediginize emin misiniz? Bu, mevcut tasarimi sifirlar.`)) {
            setTemplate(getDefaultTemplateForSize(newSize));
            setSelectedItem(null);
        }
    };

    const handleAddText = () => {
        const newItem = {
            type: 'text',
            id: `metin_${Date.now()}`,
            x: 50,
            y: 50,
            text: 'Yeni Metin',
            font_family: 'Inter',
            font_size: 12,
            font_bold: false,
            color: '#000000',
            text_width: 100,
            text_height: 20,
            text_align: 'left',
        };
        setTemplate(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSelectedItem(newItem.id);
    };

    const handleAddShape = () => {
        const newItem = {
            type: 'shape',
            id: `sekil_${Date.now()}`,
            x: 50,
            y: 50,
            width: 100,
            height: 30,
            fill_color: '#e5e7eb',
            border: {
                sides: { top: true, bottom: true, left: true, right: true },
                thickness: 1,
                color: '#000000'
            }
        };
        setTemplate(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSelectedItem(newItem.id);
    };

    const handleDeleteItem = () => {
        if (!selectedItem) return;
        if (confirm('Bu elementi silmek istediginize emin misiniz?')) {
            setTemplate(prev => ({
                ...prev,
                items: prev.items.filter(item => item.id !== selectedItem)
            }));
            setSelectedItem(null);
        }
    };

    const updateSelectedItem = (field, value) => {
        if (!selectedItem) return;
        setTemplate(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === selectedItem ? { ...item, [field]: value } : item
            )
        }));
    };

    const getSelectedItemData = () => {
        return template.items.find(item => item.id === selectedItem);
    };

    // Mouse handlers for drag
    const handleMouseDown = (e, item) => {
        e.stopPropagation();
        setSelectedItem(item.id);
        setDraggedItem(item.id);
        const rect = canvasRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left - item.x,
            y: e.clientY - rect.top - item.y
        });
    };

    const handleMouseMove = (e) => {
        if (!draggedItem) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(paperSize.width - 20, e.clientX - rect.left - dragOffset.x));
        const newY = Math.max(0, Math.min(paperSize.height - 20, e.clientY - rect.top - dragOffset.y));

        setTemplate(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === draggedItem ? { ...item, x: Math.round(newX), y: Math.round(newY) } : item
            )
        }));
    };

    const handleMouseUp = () => {
        setDraggedItem(null);
    };

    const selectedItemData = getSelectedItemData();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Fis Tasarimcisi</h2>
                            <p className="text-white/70 text-sm">Satis sonrasi fis gorunumunu ozellestin</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Tools */}
                    <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4 overflow-y-auto">
                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Kagit Boyutu</h3>
                            <div className="w-full px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700">
                                {initialPaperSize || template.paper_size}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Ayarlar sayfasindan degistirilebilir</p>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Element Ekle</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={handleAddText}
                                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Metin Ekle
                                </button>
                                <button
                                    onClick={handleAddShape}
                                    className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                                    </svg>
                                    Sekil Ekle
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Degiskenler</h3>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {AVAILABLE_VARIABLES.map(v => (
                                    <div key={v.key} className="text-xs bg-white px-2 py-1.5 rounded border border-slate-200 flex justify-between items-center">
                                        <span className="text-slate-600">{v.label}</span>
                                        <code className="bg-slate-100 px-1 rounded text-[10px]">{v.key}</code>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-auto space-y-2">
                            <button
                                onClick={handleSave}
                                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                            >
                                Kaydet
                            </button>
                            <button
                                onClick={handleReset}
                                className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                            >
                                Varsayilana Don
                            </button>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 bg-slate-200 p-6 overflow-auto flex items-start justify-center">
                        <div
                            ref={canvasRef}
                            className="bg-white shadow-xl relative"
                            style={{ width: paperSize.width, height: paperSize.height, minWidth: paperSize.width }}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onClick={() => setSelectedItem(null)}
                        >
                            {template.items.map(item => (
                                <div
                                    key={item.id}
                                    className={`absolute cursor-move ${selectedItem === item.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                                    style={{
                                        left: item.x,
                                        top: item.y,
                                        width: item.type === 'text' ? item.text_width : item.width,
                                        height: item.type === 'text' ? item.text_height : item.height,
                                        backgroundColor: item.type === 'shape' ? item.fill_color : 'transparent',
                                        border: item.border ? `${item.border.thickness}px solid ${item.border.color}` : 'none',
                                        fontFamily: item.font_family,
                                        fontSize: item.font_size,
                                        fontWeight: item.font_bold ? 'bold' : 'normal',
                                        color: item.color,
                                        textAlign: item.text_align,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: item.text_align === 'center' ? 'center' : item.text_align === 'right' ? 'flex-end' : 'flex-start',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, item)}
                                >
                                    {item.type === 'text' && <span>{item.text}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel - Properties */}
                    <div className="w-72 bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto">
                        {selectedItemData ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Ozellikler</h3>
                                    <button
                                        onClick={handleDeleteItem}
                                        className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                        title="Elementi Sil"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="text-xs text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                    ID: <code className="bg-slate-100 px-1 rounded">{selectedItemData.id}</code>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">X</label>
                                        <input
                                            type="number"
                                            value={selectedItemData.x}
                                            onChange={(e) => updateSelectedItem('x', parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Y</label>
                                        <input
                                            type="number"
                                            value={selectedItemData.y}
                                            onChange={(e) => updateSelectedItem('y', parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                        />
                                    </div>
                                </div>

                                {selectedItemData.type === 'text' && (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Metin</label>
                                            <input
                                                type="text"
                                                value={selectedItemData.text}
                                                onChange={(e) => updateSelectedItem('text', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Font Boyutu</label>
                                                <input
                                                    type="number"
                                                    value={selectedItemData.font_size}
                                                    onChange={(e) => updateSelectedItem('font_size', parseInt(e.target.value) || 10)}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Renk</label>
                                                <input
                                                    type="color"
                                                    value={selectedItemData.color}
                                                    onChange={(e) => updateSelectedItem('color', e.target.value)}
                                                    className="w-full h-8 bg-white border border-slate-200 rounded cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItemData.font_bold}
                                                    onChange={(e) => updateSelectedItem('font_bold', e.target.checked)}
                                                    className="rounded"
                                                />
                                                <span className="text-sm font-bold">Kalin</span>
                                            </label>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hizalama</label>
                                            <select
                                                value={selectedItemData.text_align}
                                                onChange={(e) => updateSelectedItem('text_align', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                            >
                                                <option value="left">Sol</option>
                                                <option value="center">Orta</option>
                                                <option value="right">Sag</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Genislik</label>
                                                <input
                                                    type="number"
                                                    value={selectedItemData.text_width}
                                                    onChange={(e) => updateSelectedItem('text_width', parseInt(e.target.value) || 50)}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Yukseklik</label>
                                                <input
                                                    type="number"
                                                    value={selectedItemData.text_height}
                                                    onChange={(e) => updateSelectedItem('text_height', parseInt(e.target.value) || 20)}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {selectedItemData.type === 'shape' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Genislik</label>
                                                <input
                                                    type="number"
                                                    value={selectedItemData.width}
                                                    onChange={(e) => updateSelectedItem('width', parseInt(e.target.value) || 50)}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Yukseklik</label>
                                                <input
                                                    type="number"
                                                    value={selectedItemData.height}
                                                    onChange={(e) => updateSelectedItem('height', parseInt(e.target.value) || 20)}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dolgu Rengi</label>
                                            <input
                                                type="color"
                                                value={selectedItemData.fill_color === '#00000000' ? '#ffffff' : selectedItemData.fill_color}
                                                onChange={(e) => updateSelectedItem('fill_color', e.target.value)}
                                                className="w-full h-8 bg-white border border-slate-200 rounded cursor-pointer"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 py-8">
                                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                                <p className="text-sm">Duzenlemek icin bir element secin</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

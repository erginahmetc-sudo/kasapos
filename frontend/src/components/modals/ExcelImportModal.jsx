import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { productsAPI } from '../../services/api';

export default function ExcelImportModal({ isOpen, onClose, type = 'new', onSuccess }) {
    const [mappingKey, setMappingKey] = useState('stock_code');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const [columns, setColumns] = useState({
        name: true,
        price: true,
        barcode: true,
        group: true,
        brand: true
    });

    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const title = type === 'new' ? 'Excel İle Yeni Ürün Yükle' : 'Excel İle Ürün Güncelle';
    const subtitle = type === 'new'
        ? 'Excel dosyanızdan yeni ürünler ekleyin'
        : 'Mevcut ürünlerinizi Excel ile güncelleyin';

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
        if (!file) return;
        setLoading(true);

        try {
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            const rows = jsonData.slice(1);

            let successCount = 0;
            let errors = [];
            let skippedDuplicates = [];

            const { data: { products: currentProducts } } = await productsAPI.getAll();

            const totalRows = rows.length;

            for (let i = 0; i < totalRows; i++) {
                const row = rows[i];

                // Update progress
                const currentProgress = Math.round(((i + 1) / totalRows) * 100);
                setProgress(currentProgress);
                setProgressStatus(`${i + 1} / ${totalRows} Ürün İşleniyor...`);

                // Small delay to allow UI update
                if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                const keyVal = row[0]?.toString().trim();
                if (!keyVal) continue;

                const rowData = {
                    name: row[1],
                    price: row[2],
                    barcode: row[3]?.toString().trim(),
                    group: row[4],
                    brand: row[5],
                };

                if (type === 'new') {
                    // Check for duplicate stock_code
                    const existingByStockCode = currentProducts.find(p => p.stock_code === keyVal);
                    if (existingByStockCode) {
                        skippedDuplicates.push(`Stok Kodu: ${keyVal}`);
                        continue;
                    }

                    // Check for duplicate barcode (if barcode is provided)
                    if (rowData.barcode) {
                        const existingByBarcode = currentProducts.find(p => p.barcode === rowData.barcode);
                        if (existingByBarcode) {
                            skippedDuplicates.push(`Barkod: ${rowData.barcode} (${keyVal})`);
                            continue;
                        }
                    }

                    const newProduct = {
                        stock_code: keyVal,
                        name: rowData.name || 'Adsız',
                        price: parseFloat(rowData.price) || 0,
                        barcode: rowData.barcode,
                        group: rowData.group,
                        brand: rowData.brand,
                        stock: 0
                    };
                    try {
                        await productsAPI.add(newProduct);
                        successCount++;
                        // Add to currentProducts to check against next rows in the same batch
                        currentProducts.push(newProduct);
                    } catch (err) { errors.push(err.message); }

                } else {
                    const existing = currentProducts.find(p =>
                        mappingKey === 'stock_code' ? p.stock_code === keyVal : p.barcode === keyVal
                    );

                    if (!existing) continue;

                    const updates = {};
                    if (columns.name && rowData.name) updates.name = rowData.name;
                    if (columns.price && rowData.price) updates.price = parseFloat(rowData.price);
                    if (columns.group && rowData.group) updates.group = rowData.group;
                    if (columns.brand && rowData.brand) updates.brand = rowData.brand;
                    if (columns.barcode && rowData.barcode) updates.barcode = rowData.barcode;

                    try {
                        await productsAPI.update(existing.stock_code, updates);
                        successCount++;
                    } catch (err) { errors.push(err.message); }
                }
            }

            // Build result message
            let resultMessage = `İşlem Tamamlandı.\nBaşarılı: ${successCount}`;

            if (skippedDuplicates.length > 0) {
                resultMessage += `\n\n⚠️ ${skippedDuplicates.length} ürün kaydedilemedi (zaten kayıtlı):\n`;
                // Show first 5 duplicates
                const displayDuplicates = skippedDuplicates.slice(0, 5);
                resultMessage += displayDuplicates.map(d => `• ${d}`).join('\n');
                if (skippedDuplicates.length > 5) {
                    resultMessage += `\n... ve ${skippedDuplicates.length - 5} ürün daha`;
                }
            }

            alert(resultMessage);
            onSuccess();
            onClose();

        } catch (error) {
            alert('Dosya okuma hatası: ' + error.message);
        } finally {
            setLoading(false);
            if (e.target?.value) e.target.value = null;
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFileChange(e);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-8 py-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                {title}
                            </h2>
                            <p className="text-white/80 mt-2 text-sm">{subtitle}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {/* Mapping Key Section */}
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50/50 rounded-2xl p-6 border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            Eşleştirme Anahtarı (A Sütunu)
                        </h3>
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${mappingKey === 'stock_code' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-2 border-gray-200 hover:border-blue-300 text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="key"
                                    className="sr-only"
                                    checked={mappingKey === 'stock_code'}
                                    onChange={() => setMappingKey('stock_code')}
                                />
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mappingKey === 'stock_code' ? 'border-white' : 'border-gray-400'}`}>
                                    {mappingKey === 'stock_code' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                </div>
                                <span className="font-semibold">Stok Kodu</span>
                            </label>
                            <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${mappingKey === 'barcode' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-2 border-gray-200 hover:border-blue-300 text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="key"
                                    className="sr-only"
                                    checked={mappingKey === 'barcode'}
                                    onChange={() => setMappingKey('barcode')}
                                />
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mappingKey === 'barcode' ? 'border-white' : 'border-gray-400'}`}>
                                    {mappingKey === 'barcode' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                </div>
                                <span className="font-semibold">Barkod</span>
                            </label>
                        </div>
                    </div>

                    {/* Columns Section */}
                    <div className="bg-gradient-to-br from-gray-50 to-purple-50/50 rounded-2xl p-6 border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Excel Sütunları
                        </h3>

                        <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
                            <div className="flex items-center gap-3 text-gray-600">
                                <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-bold text-sm">A</span>
                                <span className="font-medium">{mappingKey === 'stock_code' ? 'Stok Kodu' : 'Barkod'}</span>
                                <span className="ml-auto px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">ZORUNLU</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'name', letter: 'B', label: 'Ürün Adı' },
                                { key: 'price', letter: 'C', label: 'Fiyat' },
                                { key: 'barcode', letter: 'D', label: 'Barkod' },
                                { key: 'group', letter: 'E', label: 'Grup' },
                                { key: 'brand', letter: 'F', label: 'Marka' },
                            ].map(({ key, letter, label }) => (
                                <label
                                    key={key}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${columns[key] ? 'bg-purple-50 border-2 border-purple-200' : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={columns[key]}
                                        onChange={(e) => setColumns({ ...columns, [key]: e.target.checked })}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${columns[key] ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                        {columns[key] && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="w-7 h-7 bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-bold text-xs">{letter}</span>
                                    <span className="font-medium text-gray-700">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Drop Zone */}
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragActive
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                            }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".xlsx, .xls"
                        />

                        {loading ? (
                            <div className="flex flex-col items-center gap-4 w-full max-w-md mx-6 animate-in fade-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-2">
                                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                </div>

                                <div className="w-full space-y-2">
                                    <div className="flex justify-between text-sm font-bold text-gray-700">
                                        <span>İşleniyor...</span>
                                        <span>%{progress}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
                                        <div
                                            className="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="text-center text-xs font-medium text-gray-400">
                                        {progressStatus}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-semibold text-lg mb-1">
                                    Excel dosyasını sürükleyin veya tıklayın
                                </p>
                                <p className="text-gray-500 text-sm">
                                    .xlsx veya .xls formatında dosya seçin
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-5 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl font-semibold transition-all"
                    >
                        İptal
                    </button>
                </div>
            </div>
        </div>
    );
}

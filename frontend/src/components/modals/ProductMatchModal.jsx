/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";

export default function ProductMatchModal({ isOpen, onClose, invoiceLine, products, onSelect, onCreateNew }) {
    if (!isOpen) return null;

    const [filters, setFilters] = useState({
        name: "",
        stockCode: "",
        barcode: ""
    });

    const [filteredProducts, setFilteredProducts] = useState(products);

    useEffect(() => {
        let result = products;

        // Helper for Turkish-aware case-insensitive check
        const contains = (text, search) =>
            (text || "").toLocaleLowerCase('tr-TR').includes((search || "").toLocaleLowerCase('tr-TR'));

        if (filters.name) {
            result = result.filter(p => contains(p.name, filters.name));
        }
        if (filters.stockCode) {
            result = result.filter(p => contains(p.stock_code, filters.stockCode));
        }
        if (filters.barcode) {
            result = result.filter(p => contains(p.barcode, filters.barcode));
        }
        setFilteredProducts(result);
    }, [filters, products]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>

            {/* Modal Container */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 ring-1 ring-black/5">

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white/50 relative z-10">
                    <div>
                        <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight flex items-center gap-3">
                            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </span>
                            Ürün Eşleştirme
                        </h3>
                        <div className="flex items-center gap-2 mt-2 ml-14">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">FATURA KALEMİ:</span>
                            <span className="text-sm font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                {invoiceLine?.name}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="group p-2 rounded-full hover:bg-red-50 transition-colors duration-200"
                    >
                        <svg className="w-8 h-8 text-gray-300 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Filters Area */}
                <div className="p-6 bg-slate-50/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Input Group */}
                        {[{ label: 'Ürün Adı', key: 'name', icon: 'M4 6h16M4 12h16m-7 6h7' },
                        { label: 'Stok Kodu', key: 'stockCode', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14' },
                        { label: 'Barkod', key: 'barcode', icon: 'M12 4v16m8-8H4' }].map((field) => (
                            <div key={field.key} className="relative group">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest absolute -top-2 left-3 bg-white px-1 z-10">
                                    {field.label}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={field.icon} /></svg>
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-xl pl-9 pr-4 py-3 outline-none ring-0 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm group-hover:border-gray-300"
                                        placeholder={`${field.label} ile ara...`}
                                        value={filters[field.key]}
                                        onChange={(e) => setFilters({ ...filters, [field.key]: e.target.value })}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase text-[10px] tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="px-6 py-4 w-16 text-center">#</th>
                                    <th className="px-6 py-4 w-48">Stok Kodu</th>
                                    <th className="px-6 py-4">Ürün Adı</th>
                                    <th className="px-6 py-4 w-48">Barkod</th>
                                    <th className="px-6 py-4 text-right w-36">Satış Fiyatı</th>
                                    <th className="px-6 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredProducts.map((product, index) => (
                                    <tr
                                        key={product.id}
                                        onClick={() => onSelect(product)}
                                        className="hover:bg-indigo-50/40 cursor-pointer transition-all duration-200 group"
                                    >
                                        <td className="px-6 py-4 text-center font-bold text-gray-300 group-hover:text-indigo-400">{index + 1}</td>
                                        <td className="px-6 py-4 font-mono text-gray-600 font-medium group-hover:text-indigo-600 transition-colors">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs group-hover:bg-indigo-100 group-hover:text-indigo-700">{product.stock_code}</span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-700 group-hover:text-gray-900">{product.name}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs font-mono">{product.barcode || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                {product.sale_price?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-300 group-hover:text-indigo-500">
                                            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                        </td>
                                    </tr>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </div>
                                                <h4 className="text-gray-900 font-medium">Sonuç Bulunamadı</h4>
                                                <p className="text-gray-500 text-sm">Aradığınız kriterlere uygun ürün mevcut değil.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-gray-100 bg-white relative z-20">
                    <button
                        onClick={onCreateNew}
                        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 p-[1px] shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        <div className="relative flex items-center justify-center gap-3 bg-white/0 px-8 py-4 transition-all duration-300 group-hover:bg-white/0">
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            <span className="text-lg font-bold text-white tracking-wide">Bu Ürünü Yeni Olarak Ekle</span>
                            <span className="absolute right-6 text-xs font-medium text-emerald-100 opacity-60 group-hover:opacity-100">Otomatik Oluştur & Eşleştir</span>
                        </div>
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-3 font-medium uppercase tracking-wider">
                        * Seçili fatura satırındaki veriler kullanılarak yeni bir stok kartı oluşturulacaktır.
                    </p>
                </div>
            </div>
        </div>
    );
}

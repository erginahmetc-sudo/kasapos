import { useState, useEffect } from 'react';
import { shortcutsAPI } from '../../services/api';
import GroupContentModal from './GroupContentModal';

export default function ShortcutGroupsModal({ isOpen, onClose }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadGroups();
        }
    }, [isOpen]);

    const loadGroups = async () => {
        setLoading(true);
        try {
            const res = await shortcutsAPI.getAll();
            if (res.data?.shortcuts) {
                setGroups(res.data.shortcuts);
            }
        } catch (error) {
            console.error(error);
            alert("Gruplar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        setAdding(true);
        try {
            // Check duplicate
            if (groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
                alert("Bu isimde bir grup zaten var.");
                setAdding(false);
                return;
            }

            await shortcutsAPI.addCategory(newGroupName.trim());
            setNewGroupName('');
            await loadGroups();
        } catch (error) {
            console.error(error);
            alert("Grup eklenirken hata oluştu.");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (name) => {
        if (!window.confirm(`${name} grubunu silmek istediğinize emin misiniz?`)) return;

        try {
            await shortcutsAPI.deleteCategory(name);
            await loadGroups();
        } catch (error) {
            console.error(error);
            alert("Silme işlemi başarısız.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden transform transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Kısayol Grupları</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Satış ekranı için özel kategoriler</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Add Form */}
                    <form onSubmit={handleAdd} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            placeholder="Yeni Grup Adı (Örn: Çerezler)"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={adding || !newGroupName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1"
                        >
                            {adding ? '...' : (
                                <>
                                    <span>➕</span> Ekle
                                </>
                            )}
                        </button>
                    </form>

                    {/* List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {loading ? (
                            <div className="text-center py-4 text-gray-500 text-sm">Yükleniyor...</div>
                        ) : groups.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <span className="text-2xl block mb-2">📂</span>
                                <p className="text-gray-500 text-sm">Henüz grup oluşturulmadı.</p>
                            </div>
                        ) : (
                            groups.map((group) => (
                                <div
                                    key={group.id || group.name}
                                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white hover:shadow-sm hover:border-blue-100 transition-all group"
                                >
                                    <span className="font-medium text-gray-700 ml-1">{group.name}</span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setEditingGroup(group.name)}
                                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                            title="Grubu Düzenle"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(group.name)}
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                            title="Grubu Sil"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                        Kapat
                    </button>
                </div>

                <GroupContentModal
                    isOpen={!!editingGroup}
                    onClose={() => setEditingGroup(null)}
                    groupName={editingGroup}
                />
            </div>
        </div>
    );
}

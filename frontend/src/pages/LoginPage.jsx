import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function LoginPage() {
    const [formData, setFormData] = useState({
        company_code: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Pass company_code to login
            const response = await authAPI.login(formData.email, formData.password, formData.company_code);

            if (response.status === 200) {
                login(response.data.user);
                navigate('/');
            }
        } catch (err) {
            const message = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Giriş başarısız. Bilgilerinizi kontrol edin.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white">KasaPos</h1>
                    <p className="text-white/70 mt-2">Kurumsal Giriş</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
                    <h2 className="text-xl font-semibold text-white mb-6 text-center">Giriş Yap</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Company Code Field */}
                        <div>
                            <label className="block text-white/80 text-sm font-medium mb-2">
                                Şirket Kodu
                            </label>
                            <input
                                type="text"
                                value={formData.company_code}
                                onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all tracking-widest text-center font-mono"
                                placeholder="XXXXXXX"
                                maxLength={7}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-white/80 text-sm font-medium mb-2">
                                E-posta
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                                placeholder="isim@sirket.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-white/80 text-sm font-medium mb-2">
                                Şifre
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                'Giriş Yap'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-white/60 text-sm">
                            Hesabınız yok mu?{' '}
                            <Link to="/register" className="text-white hover:text-blue-200 underline">
                                Şirket Kaydı Oluştur
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/50 text-sm mt-6">
                    © 2026 KasaPos - Tüm hakları saklıdır.
                </p>
            </div>
        </div>
    );
}
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, usersAPI } from '../services/api';

export default function LoginPage() {
    const [isSetup, setIsSetup] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSetup) {
                // Register new Admin
                const res = await usersAPI.add({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    role: 'kurucu',
                    permissions: {}, // Admin role bypasses checks
                    access_schedule: { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }
                });

                if (res.data?.success || res.success) { // Handle varied response structures
                    alert("Yönetici hesabı oluşturuldu! Şimdi giriş yapabilirsiniz.");
                    setIsSetup(false);
                    setFormData({ ...formData, password: '' });
                } else {
                    throw new Error(res.error?.message || "Kayıt başarısız.");
                }
            } else {
                // Login
                // Support both username (legacy feeling) and email by checking content
                // But API expects email. If user enters 'admin', it will fail if not email.
                // We'll trust user enters email as label says. 
                const response = await authAPI.login(formData.email || formData.username, formData.password);

                if (response.status === 200) {
                    login(response.data.user);
                    navigate('/');
                }
            }
        } catch (err) {
            const message = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'İşlem başarısız. Lütfen bilgilerinizi kontrol edin.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white">KasaPos</h1>
                    <p className="text-white/70 mt-2">Satış ve Stok Yönetim Sistemi</p>
                </div>

                {/* Login/Setup Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
                    <h2 className="text-xl font-semibold text-white mb-6 text-center">
                        {isSetup ? '🚀 İlk Yönetici Kurulumu' : 'Giriş Yap'}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {(isSetup || !isSetup) && ( // Always show "email/username" field for login, "username" & "email" for setup
                            <>
                                {isSetup && (
                                    <div>
                                        <label className="block text-white/80 text-sm font-medium mb-2">
                                            Kullanıcı Adı
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                                            placeholder="Örn: Admin"
                                            required={isSetup}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-white/80 text-sm font-medium mb-2">
                                        E-posta
                                    </label>
                                    <input
                                        type="text" // Type text to allow flexible input if needed, but email best
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                                        placeholder={isSetup ? "admin@firma.com" : "E-posta adresiniz"}
                                        required
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-white/80 text-sm font-medium mb-2">
                                Şifre
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isSetup
                                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white focus:ring-emerald-500'
                                : 'bg-white text-indigo-700 hover:bg-white/90 focus:ring-white/50 focus:ring-offset-indigo-700'
                                }`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                isSetup ? 'Kaydı Tamamla' : 'Giriş Yap'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSetup(!isSetup);
                                setError('');
                                setFormData({ username: '', email: '', password: '' });
                            }}
                            className="text-white/60 text-sm hover:text-white transition-colors border-b border-transparent hover:border-white/40 pb-0.5"
                        >
                            {isSetup ? '← Giriş Ekranına Dön' : 'Yeni Sistem Kurulumu / Admin Oluştur'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/50 text-sm mt-6">
                    © 2026 KasaPos - Tüm hakları saklıdır.
                </p>
            </div>
        </div>
    );
}

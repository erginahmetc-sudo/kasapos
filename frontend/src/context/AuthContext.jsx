import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, usersAPI } from '../services/api';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial Load & Session Validation
    // Initial Load & Session Validation
    useEffect(() => {
        const initAuth = async () => {
            const storedUserStr = localStorage.getItem('user');
            let currentUser = null;

            // 1. Load from LocalStorage (Fast/Optimistic)
            if (storedUserStr) {
                try {
                    currentUser = JSON.parse(storedUserStr);
                    // Legacy/Mock cleanup
                    if (currentUser.id === 'mock-admin-id') {
                        currentUser = null;
                        localStorage.removeItem('user');
                    } else {
                        setUser(currentUser);
                    }
                } catch (e) {
                    console.error("Parse error", e);
                    localStorage.removeItem('user');
                }
            }

            // 2. Revalidate with Database (Fresh Permissions)
            if (currentUser && currentUser.id) {
                try {
                    // Check if session is valid via Supabase
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                    if (sessionError || !session) {
                        // Session expired
                        // setUser(null); 
                        // localStorage.removeItem('user');
                        // We could logout, but let's let specific API calls fail 401 if needed, 
                        // or strict logout here. Strict is better for security.
                        /* Optional: verify if token matches? For now, we trust if Supabase has a session. */
                    } else {
                        // Fetch fresh profile
                        const { data: profile, error: profileError } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', currentUser.id)
                            .single();

                        if (profile) {
                            // Merge fresh profile data (permissions, role, etc) into current user
                            const updatedUser = { ...currentUser, ...profile };

                            // Check deep equality to avoid re-render loop if identical? 
                            // JSON stringify comparison is cheap enough for this size
                            if (JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
                                console.log("Profile refreshed from DB", updatedUser);
                                setUser(updatedUser);
                                localStorage.setItem('user', JSON.stringify(updatedUser));
                            }
                        }
                    }
                } catch (err) {
                    console.error("Profile revalidation failed", err);
                }
            }

            setLoading(false);
        };

        initAuth();
    }, []);

    // Periodic Check (DISABLED)
    useEffect(() => {
        // No-op
    }, [user]);

    const checkAccess = (currentUser) => {
        return; // ALWAYS ALLOW
    };

    const login = async (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (e) { /* ignore */ }
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    };

    const hasPermission = (permission) => {
        if (!user) return false;
        if (user.role === 'kurucu') return true;

        // Check permissions object
        return user.permissions && user.permissions[permission] === true;
    };

    const value = {
        user,
        loading,

        login,
        logout,
        hasPermission,
        isAuthenticated: !!user,
        isKurucu: user?.role === 'kurucu' || user?.username === 'admin',
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;

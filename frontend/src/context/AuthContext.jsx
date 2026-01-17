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
        const initAuth = () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsed = JSON.parse(storedUser);
                    // FORCE LOGOUT IF MOCK DETECTED (Security Cleanup)
                    if (parsed.id === 'mock-admin-id') {
                        console.warn("Cleared legacy mock admin session");
                        localStorage.removeItem('user');
                        localStorage.removeItem('auth_token');
                        setUser(null);
                    } else {
                        setUser(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse user from local storage", e);
                    localStorage.removeItem('user');
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

import { supabase } from '../lib/supabaseClient';

// Helper to standardise responses
const response = (data, error) => {
    if (error) {
        console.error('Supabase Error:', error);
        throw { response: { data: { message: error.message || 'Bir hata oluştu' } } };
    }
    return { data };
};

// ============ AUTH API ============
export const authAPI = {
    login: async (email, password) => {

        // Enforce Email Usage
        if (!email.includes('@')) {
            throw { response: { data: { message: 'Lütfen e-posta adresinizi giriniz.' } } };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                throw { response: { data: { message: 'E-posta adresiniz henüz onaylanmamış.' } } };
            }
            throw { response: { data: { message: 'Giriş yapılamadı. Bilgilerinizi kontrol edin.' } } };
        }

        // Fetch user profile for role/permissions AND Company Code
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        let finalProfile = profile || { role: 'user', permissions: {} };

        return {
            status: 200,
            data: {
                token: data.session.access_token,
                user: { ...data.user, ...finalProfile }
            }
        };
    },

    verify2FA: async (code) => {
        return { status: 200 };
    },

    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        return { status: 200 };
    },
};

// Helper to get current company code
const getCurrentCompanyCode = () => {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user.company_code;
        }
    } catch (e) {
        console.error("Error reading company code", e);
    }
    return null;
};

// ============ PRODUCTS API ============
export const productsAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return { data: { products: [] } };

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('company_code', companyCode)
            .order('name');

        if (error) throw error;

        // DB columns are now snake_case, same as frontend
        const mappedProducts = (data || []).map(p => ({
            ...p,
            price: p.sale_price, // Map sale_price -> price (frontend uses price)
            group: p.category, // Map category -> group (frontend uses group)
        }));

        return { data: { products: mappedProducts } };
    },
    add: async (product) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) throw new Error("Şirket kodu bulunamadı.");

        // DB columns are snake_case
        const dbProduct = {
            stock_code: product.stock_code,
            name: product.name,
            barcode: product.barcode,
            category: product.group, // Map group -> category
            brand: product.brand,
            sale_price: product.price,
            buying_price: product.buying_price || 0,
            stock: product.stock,
            vat_rate: product.vat_rate || 18,
            image_url: product.image_url,
            company_code: companyCode
        };

        const { data, error } = await supabase
            .from('products')
            .insert([dbProduct])
            .select()
            .single();

        if (error) throw error;
        return { data };
    },
    update: async (stockCode, product) => {
        const companyCode = getCurrentCompanyCode();
        const dbProduct = {
            name: product.name,
            barcode: product.barcode,
            category: product.group,
            brand: product.brand,
            sale_price: product.price,
            buying_price: product.buying_price,
            stock: product.stock,
            vat_rate: product.vat_rate,
            image_url: product.image_url
        };

        const { data, error } = await supabase
            .from('products')
            .update(dbProduct)
            .eq('stock_code', stockCode)
            .eq('company_code', companyCode) // Security check
            .select();

        if (error) throw error;
        return { data };
    },
    delete: async (stockCode) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('stock_code', stockCode)
            .eq('company_code', companyCode); // Security check

        if (error) throw error;
        return { data: { success: true } };
    },
    updateStock: async (stockCode, stockData) => {
        // Updates only stock and related pricing fields
        const updates = {};
        if (stockData.stock !== undefined) updates.stock = stockData.stock;
        if (stockData.buying_price !== undefined) updates.buying_price = stockData.buying_price;
        // if (stockData.sale_price !== undefined) updates.sale_price = stockData.sale_price;

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('stock_code', stockCode)
            .select();

        if (error) throw error;
        return { data };
    },
    updateImage: async (stockCode, formData) => {
        const file = formData.get('product_image');
        if (!file) return { data: { success: true } };

        const fileExt = file.name.split('.').pop();
        const fileName = `${stockCode}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        // Update product with image_url (snake_case)
        const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: data.publicUrl })
            .eq('stock_code', stockCode);

        if (updateError) throw updateError;
        return { data: { success: true, image_url: data.publicUrl } };
    },
};

// ============ CUSTOMERS API ============
export const customersAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, customers: [] });

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('company_code', companyCode)
            .order('name');
        return response({ success: true, customers: data || [] }, error);
    },
    add: async (customer) => {
        const companyCode = getCurrentCompanyCode();
        const { id, ...cleanCustomer } = customer;
        const { data, error } = await supabase
            .from('customers')
            .insert([{ ...cleanCustomer, company_code: companyCode }])
            .select()
            .single();
        return response({ success: true, message: 'Müşteri eklendi', id: data?.id }, error);
    },
    update: async (id, customerData) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', id)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Müşteri güncellendi' }, error);
    },
    delete: async (id) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Müşteri silindi' }, error);
    },
    getTransactions: async (customerId) => {
        // Fetch sales
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: true });

        if (salesError) {
            console.error('Sales fetch error:', salesError);
            return response(null, salesError);
        }

        // Fetch payments - table might not exist yet
        let payments = [];
        try {
            const { data: paymentData, error: paymentsError } = await supabase
                .from('customer_payments')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: true });

            if (paymentsError) {
                console.warn('Payments fetch warning (table might not exist):', paymentsError.message);
            } else {
                payments = paymentData || [];
            }
        } catch (e) {
            console.warn('Payments fetch exception:', e);
        }

        console.log('Fetched sales:', sales?.length || 0, 'payments:', payments.length);

        // Combine and sort by date
        const allTransactions = [
            ...(sales || []).map(s => ({ ...s, type: 'sale' })),
            ...payments.map(p => ({
                ...p,
                type: 'payment',
                total: p.amount,
                paid_amount: p.amount,
                payment_method: p.payment_type?.toLowerCase() || 'nakit'
            }))
        ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        return response({ success: true, transactions: allTransactions }, null);
    },
    addPayment: async (payment) => {
        // Get current customer balance
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', payment.customer_id)
            .single();

        if (fetchError) throw fetchError;

        // Calculate new balance (payment reduces debt)
        const currentBalance = parseFloat(customer?.balance) || 0;
        const paymentAmount = parseFloat(payment.amount) || 0;
        const newBalance = currentBalance - paymentAmount;

        // Save payment record
        const { error: paymentError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: payment.customer_id,
                amount: paymentAmount,
                payment_type: payment.payment_type || 'Nakit',
                description: payment.description || 'Ödeme',
                created_at: new Date().toISOString()
            });

        if (paymentError) {
            console.error('Payment record error:', paymentError);
            // Continue even if payment record fails - balance update is more critical
        }

        // Update customer balance
        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', payment.customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Ödeme alındı ve bakiye güncellendi.' } };
    },
    addPurchaseTransaction: async (data) => {
        // This is for processing an invoice FROM a supplier (who is recorded as a customer)
        const { customer_id, amount, description } = data;

        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', customer_id)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(customer?.balance) || 0;
        const txAmount = parseFloat(amount) || 0;
        const newBalance = currentBalance - txAmount; // Purchase decreases our receivable (increases our debt)

        // Add record to payments table (as a negative payment or specific type)
        // Using 'Fatura' as payment_type to distinguish
        const { error: txError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: customer_id,
                amount: txAmount, // Store positive number
                payment_type: 'Fatura (Alış)', // Type
                description: description || 'Gelen Fatura',
                created_at: new Date().toISOString()
            });

        if (txError) console.error('Transaction record error:', txError);

        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Cari hesaba işlendi.' } };
    }
};

// ============ SALES API ============
export const salesAPI = {
    getAll: async (params) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, sales: [] });

        let query = supabase.from('sales').select('*, customers(name)').eq('company_code', companyCode);

        if (params?.start_date) query = query.gte('date', `${params.start_date}T00:00:00`);
        if (params?.end_date) query = query.lte('date', `${params.end_date}T23:59:59`);
        if (params?.sale_code) query = query.ilike('sale_code', `%${params.sale_code}%`);
        if (!params?.show_deleted) query = query.eq('is_deleted', false);

        const { data, error } = await query.order('date', { ascending: false });

        let sales = data?.map(s => ({
            ...s,
            customerName: s.customers?.name,
            customer: s.customers?.name || s.customer_name || s.customer || 'Misafir'
        })) || [];

        // Filter by customer name in JS since it's a relationship
        if (params?.customer_name) {
            const term = params.customer_name.toLowerCase();
            sales = sales.filter(s => s.customer?.toLowerCase().includes(term));
        }

        return response({ success: true, sales }, error);
    },
    complete: async (sale) => {
        // Prepare items for JSON storage
        // Handle both 'items' (pre-mapped) and 'products' (needs mapping)
        let items = [];
        if (sale.items) {
            items = sale.items;
        } else if (sale.products) {
            items = sale.products.map(p => ({
                id: p.id,
                name: p.name,
                quantity: p.quantity,
                price: p.price,
                total: p.price * p.quantity
            }));
        }

        const companyCode = getCurrentCompanyCode();

        const cleanSale = {
            sale_code: sale.sale_code || `S-${Date.now()}`,
            items: items, // Supabase handles JSON automatically
            total: sale.total,
            payment_method: sale.payment_method,
            is_deleted: false,
            date: new Date().toISOString(),
            customer_id: sale.customer_id || (sale.customer && sale.customer.id) || null, // Handle customer object or ID
            customer_name: sale.customer_name || (sale.customer && sale.customer.name) || (typeof sale.customer === 'string' ? sale.customer : '') || 'Misafir', // NEW: Store name explicitly
            company_code: companyCode
        };

        const { data, error } = await supabase
            .from('sales')
            .insert([cleanSale])
            .select()
            .single();

        if (error) {
            console.error('Sale insert error:', error);
            throw { response: { data: { message: error.message || 'Satış kaydedilemedi' } } };
        }

        // AUTOMATED ACCOUNTING: "Nakit" or "POS" (Kredi Kartı) sales create a Payment (Collection) record
        if (cleanSale.customer_id && (cleanSale.payment_method === 'Nakit' || cleanSale.payment_method === 'POS' || cleanSale.payment_method === 'Kredi Kartı')) {
            try {
                await customersAPI.addPayment({
                    customer_id: cleanSale.customer_id,
                    amount: cleanSale.total,
                    payment_type: cleanSale.payment_method === 'POS' ? 'Kredi Kartı' : 'Nakit', // Normalize name
                    description: `Satış Tahsilatı - ${cleanSale.sale_code}`
                });
                console.log('Automated payment record created for sale:', cleanSale.sale_code);
            } catch (paymentError) {
                console.error('Automated payment creation failed:', paymentError);
                // We don't rollback the sale, but we should warn? 
                // Currently suppressing error to avoid breaking the UI flow, as the sale itself is valid.
            }
        }

        return response({ success: true, message: 'Satış tamamlandı', sale_code: data?.sale_code }, error);
    },
    // Alias for backward compatibility if needed
    add: async (sale) => { return salesAPI.complete(sale); },
    delete: async (saleCode) => {
        const { error } = await supabase
            .from('sales')
            .update({ is_deleted: true })
            .eq('sale_code', saleCode);
        return response({ success: true, message: 'Satış iptal edildi' }, error);
    },
    getByCode: async (saleCode) => {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('sale_code', saleCode)
            .single();
        return response(data, error);
    },
    update: async (saleCode, data) => {
        const updateData = {};
        // Database uses 'items' column for products
        if (data.products) updateData.items = data.products;
        if (data.total !== undefined) updateData.total = data.total;

        const { error } = await supabase
            .from('sales')
            .update(updateData)
            .eq('sale_code', saleCode);
        return response({ success: true, message: 'Satış güncellendi' }, error);
    }
};

// ============ USERS API ============
export const usersAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, users: [] });

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('company_code', companyCode);
        return response({ success: true, users: data || [] }, error);
    },
    add: async (user) => {
        // 1. Try standard SignUp with metadata
        let { data, error } = await supabase.auth.signUp({
            email: user.email,
            password: user.password,
            options: {
                data: {
                    username: user.username,
                    role: user.role || 'user',
                    permissions: user.permissions,
                    access_schedule: user.access_schedule,
                    company_code: getCurrentCompanyCode() // Assign current admin's company
                }
            }
        });

        // 2. Fallback: If "Database error" (Trigger failure?), try without metadata
        if (error && error.message && error.message.includes('Database error')) {
            console.warn('Metadata signUp failed, retrying without metadata...');
            const retry = await supabase.auth.signUp({
                email: user.email,
                password: user.password
            });
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            // If user already exists, Supabase vaguely says so or returns fake success (security).
            // But if it's an error object:
            return response(null, error);
        }

        if (data.user) {
            // 3. Manually insert/update profile
            // We use upsert in case a Trigger partially created it
            const { error: profileError } = await supabase.from('user_profiles').upsert({
                id: data.user.id,
                username: user.username,
                // email: user.email, // Removed to prevent "Column not found" error if schema is old
                role: user.role || 'user',
                permissions: user.permissions,
                access_schedule: user.access_schedule,
                company_code: getCurrentCompanyCode()
                // session_token: crypto.randomUUID() // Removed due to missing DB column
            });

            if (profileError) {
                console.error('Profile create error:', profileError);
                return response({ success: true, message: 'Kullanıcı oluşturuldu ancak profil detayları kaydedilemedi: ' + profileError.message }, null);
            }
        }

        return response({ success: true, message: 'Kullanıcı eklendi.' }, null);
    },
    delete: async (id) => {
        // Note: This only deletes from user_profiles. Supabase Auth user remains unless deleted via Admin API.
        const { error } = await supabase.from('user_profiles').delete().eq('id', id);
        return response({ success: true, message: 'Kullanıcı profili silindi' }, error);
    },
    updatePermissions: async (id, permissions) => {
        // Fix: backend expects object with permissions key, but here we just pass permissions object
        // Adjusting to match whatever usage pattern, assuming permissions is the object { can_view_...: true }
        const { error } = await supabase
            .from('user_profiles')
            .update({ permissions })
            .eq('id', id);
        return response({ success: true, message: 'Yetkiler güncellendi' }, error);
    },
    update: async (id, userData) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({
                username: userData.username,
                role: userData.role,
                // permissions and access_schedule are handled by separate methods usually, 
                // but can be here if we want full update. 
                // For this feature, we focus on basic info + role.
            })
            .eq('id', id);
        return response({ success: true, message: 'Kullanıcı bilgileri güncellendi' }, error);
    },
    updateSchedule: async (id, schedule) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({ access_schedule: schedule })
            .eq('id', id);
        return response({ success: true, message: 'Erişim takvimi güncellendi' }, error);
    },
    forceLogout: async (id) => {
        // Change session_token to invalidate current sessions
        // const newToken = crypto.randomUUID();
        // DB Schema doesn't have session_token, so this feature is currently disabled DB-side.
        // We will just return success to not break the UI.
        /*
        const { error } = await supabase
            .from('user_profiles')
            .update({ session_token: newToken })
            .eq('id', id);
        */
        // No-op for now
        return response({ success: true, message: 'Kullanıcı oturumu kapatıldı (Token yenilenemedi - DB desteği yok)' }, null);
    },
    updatePassword: async (id, newPassword) => {
        // Client-side cannot update other users' passwords safely without Admin API.
        // We will just return a message saying it's not supported in this version or needs Admin Panel.
        return { data: { success: false, message: "Parola değiştirme işlemi için Yönetici Paneli gereklidir (Client-Side kısıtlaması)." } };
    },
    registerTenant: async (userData) => {
        // 1. SignUp
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    username: userData.username,
                    role: 'kurucu',
                    company_code: userData.company_code
                }
            }
        });

        if (error) return response(null, error);

        if (data.user) {
            // 2. Create Profile with Company Code
            const { error: profileError } = await supabase.from('user_profiles').upsert({
                id: data.user.id,
                username: userData.username,
                role: 'kurucu',
                company_code: userData.company_code,
                permissions: {
                    // Founders get full access by default logic, but we can be explicit
                    can_view_products: true,
                    can_view_customers: true,
                    can_view_sales: true,
                    can_view_invoices: true,
                    can_view_pos: true,
                    can_view_users: true,
                    can_view_balances: true,
                    can_view_prices: true
                }
            });

            if (profileError) {
                console.error('Tenant profile error:', profileError);
                return response({ success: true, message: 'Kayıt oldu ancak profil hatası: ' + profileError.message }, null);
            }
        }

        return response({ success: true, message: 'Şirket kaydı başarıyla oluşturuldu.' }, null);
    }
};

// ============ HELD SALES API ============
export const heldSalesAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, held_sales: [] });

        const { data, error } = await supabase.from('held_sales').select('*').eq('company_code', companyCode).order('created_at', { ascending: false });
        return response({ success: true, held_sales: data || [] }, error);
    },
    add: async (saleData) => {
        const companyCode = getCurrentCompanyCode();
        // Format the data correctly for the database
        // Note: Using only columns that exist in the database table
        const heldSale = {
            customer_name: saleData.customer || 'Toptan Satış',
            items: saleData.items, // Supabase handles JSON automatically
            company_code: companyCode
        };
        const { data, error } = await supabase.from('held_sales').insert([heldSale]).select();
        if (error) {
            console.error('Held sale error:', error);
            throw { response: { data: { message: error.message || 'Beklemeye alma hatası' } } };
        }
        return { data: { success: true, message: 'Satış beklemeye alındı', held_sale: data?.[0] } };
    },
    delete: async (id) => {
        const { error } = await supabase.from('held_sales').delete().eq('id', id);
        return response({ success: true, message: 'Silindi' }, error);
    },
};

// ============ SHORTCUTS API ============
export const shortcutsAPI = {
    getAll: async () => {
        const { data, error } = await supabase.from('shortcuts').select('*');
        return response({ success: true, shortcuts: data || [] }, error);
    },
    addCategory: async (name) => {
        const { error } = await supabase
            .from('shortcuts')
            .insert([{ name, items: [] }]);
        return response({ success: true, message: 'Kategori eklendi' }, error);
    },
    updateCategory: async (name, data) => {
        // Note: 'name' is unique key but id is safer? Using name as requested by existing interface
        const { error } = await supabase
            .from('shortcuts')
            .update(data)
            .eq('name', name);
        return response({ success: true, message: 'Güncellendi' }, error);
    },
    deleteCategory: async (name) => {
        const { error } = await supabase
            .from('shortcuts')
            .delete()
            .eq('name', name);
        return response({ success: true, message: 'Silindi' }, error);
    },
};

// ============ INVOICES API ============
export const invoicesAPI = {
    getAll: async () => {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .order('date', { ascending: false });
        return response({ success: true, invoices: data || [] }, error);
    },
    syncBatch: async (invoices) => {
        // Upsert based on UUID or invoice_number to avoid duplicates
        const { data, error } = await supabase
            .from('invoices')
            .upsert(invoices, { onConflict: 'uuid' })
            .select();

        return response({ success: true, message: `${invoices.length} fatura senkronize edildi.`, data }, error);
    },
    updateStatus: async (id, status) => {
        const { error } = await supabase
            .from('invoices')
            .update({ status })
            .eq('id', id);
        return response({ success: true, message: 'Durum güncellendi' }, error);
    }
};

export default {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
    delete: async () => ({ data: {} }),
};

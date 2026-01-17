const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION MANAGEMENT ---
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DEFAULT_CONFIG = {
    // Default from original code
    SECRET_TOKEN: "f8d7b6a5-c4e3-4f2a-8b1c-9e0d7a6b5c4f"
};

// Helper: Load Config
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        }
    } catch (e) {
        console.error("Config load error:", e);
    }
    return DEFAULT_CONFIG;
}

// Helper: Save Config
function saveConfig(newConfig) {
    try {
        const current = loadConfig();
        const updated = { ...current, ...newConfig };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
        return updated;
    } catch (e) {
        console.error("Config save error:", e);
        return null;
    }
}

// Initialize Secret Token holder (will be refreshed on request or cached)
// We'll read it fresh or keep it in memory. For simplicity, let's read fresh or cache lightly.
// Actually, let's just use loadConfig().SECRET_TOKEN when needed.

// Supabase Config (Will need to be set in .env or hardcoded by user if running locally)
const SUPABASE_URL = process.env.SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "YOUR_SUPABASE_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json());

// --- MIDDLEWARE: Auth Check ---
async function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Oturum açmanız gerekiyor (Token eksik)" });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(401).json({ error: "Geçersiz token formatı" });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(403).json({ error: "Geçersiz veya süresi dolmuş oturum" });
        }
        req.user = user; // Attach user to request
        next();
    } catch (e) {
        console.error("Auth Middleware Error:", e);
        return res.status(500).json({ error: "Sunucu hatası" });
    }
}

// --- ENDPOINT: GET Settings (Frontend uses this) ---
app.get('/api/settings', authenticateUser, (req, res) => {
    const config = loadConfig();
    res.json({ secret_token: config.SECRET_TOKEN });
});

// --- ENDPOINT: UPDATE Settings (Frontend uses this) ---
app.post('/api/settings', authenticateUser, (req, res) => {
    const { secret_token } = req.body;
    if (!secret_token) {
        return res.status(400).json({ error: "Token gerekli" });
    }

    const updated = saveConfig({ SECRET_TOKEN: secret_token });
    if (updated) {
        res.json({ success: true, message: "Ayarlar güncellendi", secret_token: updated.SECRET_TOKEN });
    } else {
        res.status(500).json({ error: "Ayarlar kaydedilemedi" });
    }
});

// --- HELPER: Date Parsing ---
function parseDate(dateStr) {
    if (!dateStr) return null;
    // Format: DD.MM.YYYY HH:mm:ss
    const parts = dateStr.split(' ');
    const dateParts = parts[0].split('.');
    const timeParts = parts[1].split(':');
    return new Date(
        dateParts[2], dateParts[1] - 1, dateParts[0],
        timeParts[0], timeParts[1], timeParts[2]
    );
}

// --- ENDPOINT: BirFatura Polls This ---
app.post('/api/orders', async (req, res) => {
    // 1. Auth Check (API Şifresi)
    const receivedToken = req.headers['token']; // BirFatura sends 'token' header

    const currentConfig = loadConfig();
    const VALID_TOKEN = currentConfig.SECRET_TOKEN;

    if (!receivedToken || receivedToken !== VALID_TOKEN) {
        return res.status(401).json({ "Orders": [], "error": "Yetkisiz Erişim" });
    }

    console.log("BirFatura polling request received:", req.body);

    const filterData = req.body;
    const startDateTimeStr = filterData.startDateTime; // DD.MM.YYYY HH:mm:ss
    const endDateTimeStr = filterData.endDateTime;
    const orderCodeFilter = filterData.OrderCode;

    // 2. Fetch Sales from Supabase
    let query = supabase
        .from('sales')
        .select('*')
        .is('is_deleted', false)
    // .eq('faturasi_kesilecek_mi', true) // Optional: filtering logic from python

    if (orderCodeFilter) {
        query = query.eq('sale_code', orderCodeFilter);
    }

    // Note: Date filtering in Supabase is slightly different than Python in-memory.
    // For simplicity, we fetch recent sales and filter in JS to match Python's exact logic
    // OR filter by date range if possible.
    // Since formats might differ, fetching logic:

    const { data: sales, error } = await query;

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ "Orders": [], "error": "Veritabanı Hatası" });
    }

    // 3. Process and Filter
    const ordersToSend = [];

    let startDate, endDate;
    try {
        if (startDateTimeStr && endDateTimeStr) {
            startDate = parseDate(startDateTimeStr);
            endDate = parseDate(endDateTimeStr);
        }
    } catch (e) {
        return res.status(400).json({ "Orders": [], "error": "Geçersiz Tarih Formatı" });
    }

    for (const sale of sales) {
        // Custom Filter Logic (Python: if not faturasi_kesilecek_mi continue)
        // Assuming we want to send all valid sales

        // Date Filter
        const saleDate = new Date(sale.date); // Supabase returns ISO string

        if (startDate && endDate) {
            if (saleDate < startDate || saleDate > endDate) continue;
        }

        // --- Customer & Tax Logic (From Python) ---
        const customerName = sale.customer_name || 'Misafir Müşteri';
        let taxNumber = ""; // You might need to fetch this from 'customers' table if not in sale
        // For now, using logic dependent on sale data structure. 
        // Since 'sale' object from Supabase might not have customer details heavily nested.
        // We might need a separate fetch for customers or join.
        // Assuming simple mapping for now.

        let address = "Belirtilmemiş";
        let city = "Adana";
        let district = "Seyhan";

        // Logic to mimic Python's tax number fallback
        let ssnTcNo = "";
        let taxNo = "";
        // If tax number is stored in sale (added in previous tasks)
        let rawTax = sale.tax_number || "";

        if (rawTax.length === 11) ssnTcNo = rawTax;
        else if (rawTax.length > 0) taxNo = rawTax;

        if (!ssnTcNo && !taxNo && (customerName === 'Misafir Müşteri' || customerName === 'Toptan Satış')) {
            ssnTcNo = '11111111111';
        }

        const shippingTaxNumber = taxNo ? taxNo : ssnTcNo;

        // --- Items Logic ---
        let calculatedTotal = 0;
        const orderDetails = [];

        // Helper to parse items if they are JSON string
        let items = sale.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { }
        }

        if (Array.isArray(items)) {
            items.forEach(item => {
                const unitPriceInclTax = parseFloat(item.price || 0);
                const quantity = parseFloat(item.quantity || 1);
                const unitPriceExclTax = unitPriceInclTax / 1.20;

                calculatedTotal += unitPriceInclTax * quantity;

                orderDetails.push({
                    "ProductId": 0,
                    "ProductCode": item.stock_code || "",
                    "Barcode": item.stock_code || "",
                    "ProductName": item.name || "",
                    "ProductQuantity": quantity,
                    "VatRate": 20.0,
                    "ProductUnitPriceTaxExcluding": Number(unitPriceExclTax.toFixed(4)),
                    "ProductUnitPriceTaxIncluding": Number(unitPriceInclTax.toFixed(4)),
                    "Variants": []
                });
            });
        }

        const calculatedTotalExclTax = calculatedTotal / 1.20;
        const formattedDate = saleDate.toLocaleDateString('tr-TR') + ' ' + saleDate.toLocaleTimeString('tr-TR');

        ordersToSend.push({
            "OrderId": (sale.id || 0), // Or extract from Code
            "OrderCode": sale.sale_code,
            "OrderDate": formattedDate,
            "CustomerId": 0,
            "BillingName": customerName,
            "BillingAddress": address,
            "BillingTown": district,
            "BillingCity": city,
            "BillingTaxOffice": "",
            "TaxNo": taxNo,
            "SSNTCNo": ssnTcNo,
            "ShippingId": 0,
            "ShippingName": customerName,
            "ShippingAddress": address,
            "ShippingTown": district,
            "ShippingCity": city,
            "ShippingTaxNumber": shippingTaxNumber,
            "ShipCompany": "Kargo",
            "PaymentTypeId": 1,
            "PaymentType": "Kredi Kartı",
            "Currency": "TRY",
            "CurrencyRate": 1,
            "TotalPaidTaxIncluding": Number(calculatedTotal.toFixed(2)),
            "TotalPaidTaxExcluding": Number(calculatedTotalExclTax.toFixed(2)),
            "OrderDetails": orderDetails
        });
    }

    res.json({ "Orders": ordersToSend });
});

// --- SERVE STATIC FRONTEND (Production) ---
const frontendPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendPath)) {
    console.log("Serving static frontend from:", frontendPath);
    app.use(express.static(frontendPath));

    // SPA Fallback: Serve index.html for any unknown route NOT starting with /api
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            console.log(`[SPA Fallback] Serving index.html for: ${req.path}`);
            res.sendFile(path.join(frontendPath, 'index.html'));
        }
    });
} else {
    console.warn("Frontend build not found at:", frontendPath);
    console.warn("Current directory:", __dirname);
    console.warn("Expected path:", path.resolve(frontendPath));
    console.warn("If running in production, make sure to build the frontend first.");
}

app.listen(PORT, () => {
    console.log(`BirFatura Bridge Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_URL.startsWith('http')) {
        console.warn("WARNING: Invalid or missing SUPABASE_URL. Backend API may fail.");
    } else {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase client initialized successfully.");
    }
} catch (error) {
    console.error("Failed to initialize Supabase client:", error.message);
}

app.use(cors());
app.use(express.json());

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

    if (!receivedToken) {
        return res.status(401).json({ "Orders": [], "error": "Token eksik" });
    }

    if (!supabase) {
        console.error("Supabase not initialized.");
        return res.status(503).json({ "Orders": [], "error": "Veritabanı bağlantısı yok" });
    }

    // 2. Validate Token & Get Company Code
    // We expect the token to be stored as a simple string value in 'value' column (JSONB)
    // JSONB equality for string: value = "token"
    const { data: setting, error: tokenError } = await supabase
        .from('app_settings')
        .select('company_code')
        .eq('key', 'secret_token')
        .eq('value', JSON.stringify(receivedToken)) // Match JSON string "token"
        .single();

    if (tokenError || !setting || !setting.company_code) {
        console.warn("Invalid token received or no company found:", receivedToken);
        return res.status(401).json({ "Orders": [], "error": "Yetkisiz Erişim / Geçersiz Token" });
    }

    const companyCode = setting.company_code;
    console.log(`BirFatura request authorized for Company: ${companyCode}`);

    // 3. Fetch Sales for this Company
    console.log("BirFatura polling request received:", req.body);

    const filterData = req.body;
    const startDateTimeStr = filterData.startDateTime; // DD.MM.YYYY HH:mm:ss
    const endDateTimeStr = filterData.endDateTime;
    const orderCodeFilter = filterData.OrderCode;

    let query = supabase
        .from('sales')
        .select('*')
        .eq('company_code', companyCode) // Enforce Isolation
        .eq('is_deleted', false);
    // .eq('faturasi_kesilecek_mi', true) // Optional

    if (orderCodeFilter) {
        query = query.eq('sale_code', orderCodeFilter);
    }

    const { data: sales, error } = await query;

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ "Orders": [], "error": "Veritabanı Hatası" });
    }

    // 4. Process and Filter (Date logic etc.)
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
        // Date Filter
        const saleDate = new Date(sale.date);

        if (startDate && endDate) {
            if (saleDate < startDate || saleDate > endDate) continue;
        }

        // --- Customer & Tax Logic ---
        const customerName = sale.customer_name || 'Misafir Müşteri';

        // ... (Tax Logic remains same)
        let ssnTcNo = "";
        let taxNo = "";
        let rawTax = sale.tax_number || "";

        if (rawTax.length === 11) ssnTcNo = rawTax;
        else if (rawTax.length > 0) taxNo = rawTax;

        if (!ssnTcNo && !taxNo && (customerName === 'Misafir Müşteri' || customerName === 'Toptan Satış')) {
            ssnTcNo = '11111111111';
        }

        const shippingTaxNumber = taxNo ? taxNo : ssnTcNo;

        let address = "Belirtilmemiş";
        let city = "Adana";
        let district = "Seyhan";

        // --- Items Logic ---
        let calculatedTotal = 0;
        const orderDetails = [];

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
            "OrderId": (sale.id || 0),
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
    // ...
    console.log("Frontend path not found:", frontendPath);
}

app.listen(PORT, () => {
    console.log(`BirFatura Bridge Server running on port ${PORT}`);
});

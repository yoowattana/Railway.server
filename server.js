const express = require('express');
const axios = require('axios');
const app = express();

// Middleware เพื่ออนุญาต CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // อนุญาตทุกโดเมน
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // อนุญาต methods
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // อนุญาต headers
    next();
});

// Middleware เพื่อ parse JSON body
app.use(express.json());

// Route สำหรับ GET request ที่ path '/'
app.get('/', (req, res) => {
    res.send('Welcome to the Proxy Server!');
});

// Route สำหรับส่งข้อมูลไปยัง Google Apps Script
app.post('/submit', async (req, res) => {
    try {
        // ส่งข้อมูลไปยัง Google Apps Script
        const response = await axios.post(
            'https://script.google.com/macros/s/AKfycbzsoBOGGqO2BcNnbZndevdx4DHYFzVGdXQo1X_bTLdgX2Ma2avGyXd3KOIhR5N7ZdqL/exec', // URL ใหม่ของคุณ
            req.body
        );
        // ส่งผลลัพธ์กลับไปยัง client
        res.json(response.data);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// รองรับ Preflight Request
app.options('/submit', (req, res) => {
    res.send();
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy server is running on http://0.0.0.0:${PORT}`);
});

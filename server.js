const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// อนุญาตให้ทุก origin เรียกใช้ proxy server
app.use(cors());

// อนุญาตให้รับ JSON body
app.use(express.json());

// สร้าง endpoint สำหรับเรียกใช้ Google Apps Script API
app.post('/call-google-apps-script', async (req, res) => {
  try {
    const response = await axios.post(
      'https://script.google.com/macros/s/AKfycbzTcs_Du5rWzc-dnTdRrUUyQ2I7UUYl6MRrt9x1k420K1BVW1oegQHUALgaBU6LEcJz/exec',
      req.body
    );
    res.send(response.data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy server is running on http://0.0.0.0:${PORT}`);
});

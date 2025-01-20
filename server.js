const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// อนุญาตให้ทุก origin เรียกใช้ API
app.use(cors());

// อนุญาตให้รับ JSON body
app.use(express.json());

// ตั้งค่า Service Account จาก Environment Variables
const credentials = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // แทนที่ \n ด้วย newline
  project_id: process.env.GOOGLE_PROJECT_ID,
};

// ตั้งค่า Service Account
const authClient = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

// ฟังก์ชันสำหรับอัปโหลดรูปภาพลงใน Google Drive
async function uploadImageToDrive(base64, fileName, mimeType) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  const fileMetadata = {
    name: fileName,
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // ID ของโฟลเดอร์ใน Google Drive
  };

  const media = {
    mimeType: mimeType,
    body: Buffer.from(base64, 'base64'),
  };

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    return `https://drive.google.com/uc?export=view&id=${response.data.id}`;
  } catch (error) {
    console.error('Error uploading image to Drive:', error);
    throw error;
  }
}

// ฟังก์ชันสำหรับบันทึกข้อมูลลงใน Google Sheets
async function appendData(data) {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // ใช้ Environment Variable สำหรับ Spreadsheet ID
  const RANGE = 'MEMBER!A1'; // ชื่อชีตและเซลล์เริ่มต้น

  // ยืนยันตัวตน
  await authClient.authorize();

  // บันทึกข้อมูลลงใน Google Sheets
  try {
    const response = await google.sheets('v4').spreadsheets.values.append({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: 'RAW',
      resource: {
        values: [data], // ข้อมูลที่ต้องการบันทึก
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error appending data to Sheets:', error);
    throw error;
  }
}

// สร้าง endpoint สำหรับรับข้อมูลจากเว็บแอปพลิเคชัน
app.post('/submit', async (req, res) => {
  try {
    const { userchatId, nameId, numberId, roleId, base64, fileName, fileType } = req.body;

    let imageUrl = '';
    if (base64 && fileName && fileType) {
      // อัปโหลดรูปภาพลงใน Google Drive
      imageUrl = await uploadImageToDrive(base64, fileName, fileType);
    }

    // บันทึกข้อมูลลงใน Google Sheets
    const timestamp = new Date().toLocaleString();
    await appendData([timestamp, userchatId, nameId, numberId, roleId, imageUrl]);

    res.json({ success: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// เริ่มต้นเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

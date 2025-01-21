const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const multer = require('multer'); // สำหรับจัดการไฟล์ที่อัปโหลด
const fs = require('fs'); // สำหรับอ่านไฟล์

const app = express();
const PORT = process.env.PORT || 3000;

// ตรวจสอบ Environment Variables
if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_PROJECT_ID) {
  console.error('Error: Missing Google Service Account credentials in environment variables.');
  process.exit(1); // หยุดการทำงานของเซิร์ฟเวอร์
}

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
    'https://www.googleapis.com/auth/drive', // เพิ่ม scope สำหรับ Google Drive
  ],
});

// ฟังก์ชันสำหรับดึงข้อมูลจาก Google Sheets
async function getSheetData() {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // ใช้ Environment Variable สำหรับ Spreadsheet ID
  const RANGE = 'MEMBER!A2:F'; // ดึงข้อมูลทั้งหมดในชีต MEMBER (ยกเว้นหัวคอลัมน์)

  // ยืนยันตัวตน
  await authClient.authorize();

  // ดึงข้อมูลจาก Google Sheets
  const response = await google.sheets('v4').spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
  });

  return response.data.values || [];
}

// ฟังก์ชันสำหรับบันทึกข้อมูลลงใน Google Sheets
async function appendData(data) {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // ใช้ Environment Variable สำหรับ Spreadsheet ID
  const RANGE = 'MEMBER!A1'; // ชื่อชีตและเซลล์เริ่มต้น

  // ยืนยันตัวตน
  await authClient.authorize();

  // บันทึกข้อมูลลงใน Google Sheets
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
}

// ฟังก์ชันสำหรับอัปโหลดรูปภาพลงใน Google Drive
async function uploadImageToDrive(file, numberId, nameId) {
  const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // ใช้ Environment Variable สำหรับ Drive Folder ID

  // ยืนยันตัวตน
  await authClient.authorize();

  const drive = google.drive({ version: 'v3', auth: authClient });

  // ตั้งชื่อไฟล์เป็น รหัสพนักงาน+ชื่อ-สกุล.jpg
  const fileName = `${numberId}_${nameId}.jpg`;

  const fileMetadata = {
    name: fileName, // ตั้งชื่อไฟล์
    parents: [DRIVE_FOLDER_ID], // โฟลเดอร์ปลายทาง
  };

  const media = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path), // อ่านไฟล์จาก path
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id,webViewLink', // รับ URL ของไฟล์
  });

  // ตั้งค่า permission ให้ไฟล์เป็นสาธารณะ
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // ลบไฟล์ชั่วคราวหลังจากอัปโหลด
  fs.unlinkSync(file.path);

  return response.data;
}

// ตั้งค่า multer สำหรับจัดการไฟล์ที่อัปโหลด
const upload = multer({ dest: 'uploads/' });

// สร้าง endpoint สำหรับรับข้อมูลจากเว็บแอปพลิเคชัน
app.post('/submit', upload.single('image'), async (req, res) => {
  try {
    const { userchatId, nameId, numberId, roleId } = req.body;
    const imageFile = req.file;

    // ดึงข้อมูลจาก Google Sheets
    const sheetData = await getSheetData();

    // ตรวจสอบว่า Chat ID หรือ ชื่อ-สกุล ซ้ำกับข้อมูลที่มีอยู่หรือไม่
    const isDuplicateChatId = sheetData.some(row => row[1] === userchatId); // Chat ID อยู่ในคอลัมน์ B (index 1)
    const isDuplicateName = sheetData.some(row => row[2] === nameId); // ชื่อ-สกุล อยู่ในคอลัมน์ C (index 2)

    if (isDuplicateChatId) {
      return res.status(400).json({ success: false, message: 'Chat ID นี้มีอยู่แล้วในระบบ' });
    }

    if (isDuplicateName) {
      return res.status(400).json({ success: false, message: 'ชื่อ-สกุล นี้มีอยู่แล้วในระบบ' });
    }

    let imageUrl = '';
    if (imageFile) {
      const driveResponse = await uploadImageToDrive(imageFile, numberId, nameId);
      imageUrl = driveResponse.webViewLink; // รับ URL ของไฟล์รูปภาพ
    }

    // บันทึกข้อมูลลงใน Google Sheets
    const timestamp = new Date().toLocaleString();
    await appendData([timestamp, userchatId, nameId, numberId, roleId, imageUrl]);

    res.json({ success: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว', imageUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// เริ่มต้นเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

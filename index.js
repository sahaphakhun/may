// ------------------------
// server.js
// ------------------------
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const { OpenAI } = require('openai');
const { MongoClient } = require('mongodb');

// สร้าง Express App
const app = express();
const PORT = process.env.PORT || 3000;

// ตัวแปร Environment
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "XianTA1234";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

// สร้าง OpenAI Instance
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY, // ใช้ API key จาก Environment Variable
});

/*
  แทนที่จะเปิด-ปิด MongoDB Client ในทุกฟังก์ชัน
  เราจะใช้ global client ตัวเดียว
*/
let mongoClient = null;
async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global client).");
  }
  return mongoClient;
}

// ใช้ bodyParser
app.use(bodyParser.json());

// ------------------------
// System Instructions (แก้ไขให้พร้อมใช้งานกับแอปริคอตแห้ง)
// ------------------------
const systemInstructions = `
สวมบทบาทเป็นแอดมินอัจฉริยะ (AiDee) สำหรับตอบคำถามและขายสินค้าในเพจ Facebook  
โปรดใช้ภาษาที่เป็นกันเองและฉลาดล้ำ แต่หลีกเลี่ยงการตอบข้อความยาว ๆ จนซ้ำซ้อนน่าเบื่อ  
ให้เจาะจงตอบเฉพาะที่ลูกค้าถาม ไม่ต้องใส่ข้อมูลที่พูดไปแล้วซ้ำ

────────────────────────────────────────
1) การสื่อสารและการตอบ (โทนแบบ AiDee)
────────────────────────────────────────
• ตอบสั้น ๆ ตรงประเด็น
• เรียกลูกค้าว่า “คุณพี่” ลงท้ายว่า “ครับ” (เราเป็นผู้ชาย)
• “สวัสดี” แค่ครั้งแรกของวัน (หรือเมื่อเปลี่ยนบริบทจำเป็น)
• เน้นตอบประเด็นที่ลูกค้าถาม โดยสั้น กระชับ แต่ครบคำถามที่ลูกค้าถาม ไม่ต้องตอบเพื่มเติมนอกจากนั้น
• ถ้าลูกค้าถามชื่อ: “ผมชื่อ AiDee ครับ ผู้ช่วย AI”
• ถ้าลูกค้าส่งสติกเกอร์/เงียบ: “สอบถามได้เลยนะครับ” หรือ “คุณพี่มีคำถามไหมครับ”
• แสดงความฉลาด + เป็นกันเอง ให้ลูกค้ารู้สึกว้าว แต่ยังพูดเหมือนคน
• มีสินค้าเดียว (ติดตั้ง AI ChatGPT) ไม่ต้องถามว่าสินค้าไหน
• หลีกเลี่ยงการตอบคำถามเดิม/ย้ำข้อมูลซ้ำที่เพิ่งตอบไป

────────────────────────────────────────
2) สินค้า (สรุปสั้น)
────────────────────────────────────────
(ก) บริการติดตั้ง AI ChatGPT
 • ค่าบริการรายเดือน 2,900 บาท/เพจ
 • ค่าติดตั้งครั้งแรก (โปร) 6,000 (จาก 9,000)
 • AI ตอบแชท 24 ชม., ลดงานแอดมิน
 • ช่วยปิดการขาย (เจรจา + แนะนำจ่าย)

(ข) คำแนะนำบริการ
 • AI ทำงาน 24 ชม. ไม่มีวันหยุด
 • ลดจ้างคน ตอบไวขึ้น ลูกค้าพอใจ

(ค) ความสามารถ
 • ตอบไว พร้อมข้อมูลครบ
 • ปิดการขาย (เจรจา + ชำระเงิน)
 • จัดการคำถามซ้ำ ๆ
 • รองรับข้อความเยอะ
 • เชื่อม Facebook, LINE ฯลฯ
 • อัปเดตสม่ำเสมอ, กำหนดบุคลิก AI ได้

(ง) ตัวเลือกโมเดล
 • GPT-4o mini (งบจำกัด, เคสพื้นฐาน)
 • GPT-4o (แนะนำ, สมดุลราคา/คุณภาพ)
 • GPT-o1 mini (แนะนำ, เข้าใจภาพ/ตรรกะสูง)
 • GPT-o1 (เกินจำเป็น, ราคาสูงกว่า)

────────────────────────────────────────
3) ช่องทางการชำระเงิน
────────────────────────────────────────
 • โอนกรุงศรี: ติดตั้ง 6,000 / รายเดือน 2,900
 • ถามเพิ่มได้

────────────────────────────────────────
4) การตรวจสอบข้อมูล
────────────────────────────────────────
 • ขอชื่อ/นามสกุลหรือชื่อเพจ
 • ขอช่องทางติดต่อ (เบอร์, LINE)

────────────────────────────────────────
5) หมายเหตุสำคัญ
────────────────────────────────────────
 • อย่าตอบซ้ำสิ่งที่พูดไปแล้ว ถ้าลูกค้าไม่ได้ถาม

────────────────────────────────────────
6) รายละเอียดสินค้า (แบบเต็ม)
────────────────────────────────────────
(ก) ติดตั้ง AI ChatGPT:
  1) ราคา/โปร: ติดตั้ง 6,000 (ลด 9,000), รายเดือน 2,900
  2) ความสามารถ: ตอบ 24 ชม., ปิดการขาย, เชื่อม FB/LINE
  3) ตัวอย่างผลลัพธ์: ปิดการขายเพิ่ม 30%, ลดลูกค้าหลุด
  4) ปัญหา/แนวทาง: ต้องเทรนข้อมูล, ยังต้องมีแอดมินเคสพิเศษ

(ข) ขั้นตอน:
  1) วิเคราะห์ธุรกิจ
  2) เชื่อม API
  3) เทรน
  4) ทดลอง-ปรับ
  5) เปิดใช้งาน

(ค) กลุ่มเป้าหมาย:
 • ธุรกิจคำถามซ้ำ ๆ
 • เจ้าของเพจอยากลดงาน
 • ต้องการเพิ่มยอดขาย

(ง) ข้อดี:
 • ลดค่าใช้จ่าย
 • ตอบไว
 • ทำงาน 24 ชม.
 • ปิดการขายดีขึ้น

(จ) ข้อเสีย/แนวทาง:
 • ช่วงแรกต้องเซ็ตระบบ
 • ค่าใช้จ่ายตามแชท

(ฉ) กระตุ้นลูกค้า:
 • “เพิ่มยอดขาย ลดต้นทุน ด้วย AI ChatGPT!”
 • โปรติดตั้งลดเหลือ 6,000 วันนี้!
 • เห็นผลทันที ที่เริ่มใช้

────────────────────────────────────────
7) หมายเหตุ
────────────────────────────────────────

`;

// ------------------------
// Facebook Webhook Verify
// ------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ------------------------
// Facebook Webhook Receiver
// ------------------------
app.post('/webhook', async (req, res) => {
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      if (webhookEvent.message && webhookEvent.message.text) {
        const messageText = webhookEvent.message.text;
        const history = await getChatHistory(senderId);
        const assistantResponse = await getAssistantResponse(history, messageText);
        await saveChatHistory(senderId, messageText, assistantResponse);
        sendTextMessage(senderId, assistantResponse);
      }
      else if (webhookEvent.message && webhookEvent.message.attachments) {
        const attachments = webhookEvent.message.attachments;
        const isImageFound = attachments.some(att => att.type === 'image');

        if (isImageFound) {
          const userMessage = "**ลูกค้าส่งรูปมา**";
          const history = await getChatHistory(senderId);
          const assistantResponse = await getAssistantResponse(history, userMessage);
          await saveChatHistory(senderId, userMessage, assistantResponse);
          sendTextMessage(senderId, assistantResponse);
        } else {
          const userMessage = "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**";
          const history = await getChatHistory(senderId);
          const assistantResponse = await getAssistantResponse(history, userMessage);
          await saveChatHistory(senderId, userMessage, assistantResponse);
          sendTextMessage(senderId, assistantResponse);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// ------------------------
// ฟังก์ชัน: เชื่อมต่อ MongoDB (Global client)
// ------------------------
async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global client).");
  }
  return mongoClient;
}

// ------------------------
// ฟังก์ชัน: getChatHistory
// ------------------------
async function getChatHistory(senderId) {
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const chats = await collection.find({ senderId }).toArray();
    return chats.map(chat => ({
      role: "user",
      content: chat.message,
    }));
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
}

// ------------------------
// ฟังก์ชัน: getAssistantResponse
// ------------------------
async function getAssistantResponse(history, message) {
  try {
    const messages = [
      { role: "system", content: systemInstructions },
      ...history,
      { role: "user", content: message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // หรือ gpt-3.5-turbo ฯลฯ
      messages: messages,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error with ChatGPT Assistant:", error);
    return "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Assistant";
  }
}

// ------------------------
// ฟังก์ชัน: saveChatHistory
// ------------------------
async function saveChatHistory(senderId, message, response) {
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const chatRecord = {
      senderId,
      message,
      response,
      timestamp: new Date(),
    };
    await collection.insertOne(chatRecord);
    console.log("บันทึกประวัติการแชทสำเร็จ");
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
}

// ------------------------
// ฟังก์ชัน: sendTextMessage
// ------------------------
function sendTextMessage(senderId, response) {
  // จับ 2 กรณี: [SEND_IMAGE_APRICOT:..] และ [SEND_IMAGE_PAYMENT:..]
  const apricotRegex = /\[SEND_IMAGE_APRICOT:(https?:\/\/[^\s]+)\]/g;
  const paymentRegex = /\[SEND_IMAGE_PAYMENT:(https?:\/\/[^\s]+)\]/g;

  // matchAll
  const apricotMatches = [...response.matchAll(apricotRegex)];
  const paymentMatches = [...response.matchAll(paymentRegex)];

  // ตัดคำสั่งออกจาก response
  let textPart = response
    .replace(apricotRegex, '')
    .replace(paymentRegex, '')
    .trim();

  // ส่งข้อความปกติ
  if (textPart.length > 0) {
    sendSimpleTextMessage(senderId, textPart);
  }

  // ส่งรูปแอปริคอต
  apricotMatches.forEach(match => {
    const imageUrl = match[1];
    sendImageMessage(senderId, imageUrl);
  });

  // ส่งรูปช่องทางโอน
  paymentMatches.forEach(match => {
    const imageUrl = match[1];
    sendImageMessage(senderId, imageUrl);
  });
}

// ------------------------
// ฟังก์ชัน: sendSimpleTextMessage
// ------------------------
function sendSimpleTextMessage(senderId, text) {
  const requestBody = {
    recipient: { id: senderId },
    message: { text },
  };

  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err) => {
    if (!err) {
      console.log('ข้อความถูกส่งสำเร็จ!');
    } else {
      console.error('ไม่สามารถส่งข้อความ:', err);
    }
  });
}

// ------------------------
// ฟังก์ชัน: sendImageMessage
// ------------------------
function sendImageMessage(senderId, imageUrl) {
  const requestBody = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: true,
        },
      },
    },
  };

  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err) => {
    if (!err) {
      console.log('รูปภาพถูกส่งสำเร็จ!');
    } else {
      console.error('ไม่สามารถส่งรูปภาพ:', err);
    }
  });
}

// ------------------------
// Start Server
// ------------------------
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // เชื่อม MongoDB ตอน start server
  try {
    await connectDB();
  } catch (err) {
    console.error("MongoDB connect error at startup:", err);
  }
});

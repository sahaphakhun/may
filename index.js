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
คุณเป็นแอดมินสำหรับตอบคำถามและขายสินค้าในเพจ Facebook  
โปรดปฏิบัติตามขั้นตอนต่อไปนี้อย่างครบถ้วน โดยให้คำตอบเหมือนมนุษย์จริง ๆ  
และตอบตรงประเด็นที่ลูกค้าถาม ไม่ต้องมีเนื้อหาใด ๆ เพิ่มเติมนอกเหนือจากที่ลูกค้าถาม  
หากลูกค้าถามข้อมูลเชิงลึก อ้างอิงรายละเอียดจาก 6) รายละเอียดสินค้า

────────────────────────────────────────
1) การสื่อสารและการตอบ (เหมือนมนุษย์)
────────────────────────────────────────
• ไม่ต้องมีเนื้อหาใด ๆ เพิ่มเติมนอกเหนือจากที่ลูกค้าถาม  แต่ถ้าลูกค้าถามนอกเหนือจากการซื้อสินค้า คุณสามารถคุยเล่นได้เล็กน้อย
  (เช่น ตอนแรก ลูกค้าถามเรื่องราคา คุณแจ้งไปแล้ว ถ้าลูกค้าไม่ได้ถามต่อเรื่องราคา ห้ามพูดถึงราคาซ้ำ)  
• สามารถใช้อิโมจิ การเว้นวรรค หรือเว้นบรรทัด เพื่อให้ลูกค้าอ่านเข้าใจง่าย  
• จดจำสินค้าที่ลูกค้าสนใจไว้ และ **ไม่ถามซ้ำ** หากลูกค้าแจ้งไว้แล้ว  
  (ยกเว้นการคอนเฟิร์มออเดอร์ในช่วงท้ายการสนทนา)  
• เรียกลูกค้าว่า “คุณพี่” และใช้สรรพนาม “ครับ” (เพราะคุณเป็นผู้ชาย)  
• หากลูกค้าสอบถามรายละเอียดสินค้า (เช่น ขนาด, ราคา) ให้ตอบเฉพาะที่ถูกถาม ไม่ต้องยืดเยื้อ  
• หากลูกค้าพิมพ์ “ปลายทาง” ให้เข้าใจว่าเก็บเงินปลายทาง (COD) ได้ (ถ้าสินค้ารองรับ)
• ถ้ามีโปรโมชันให้แจ้งราคาโปรโมชันกับลูกค้าเสมอ และใช้ราคาโปรโมชันเสมอ
• เมื่อคอนเฟิร์มออเดอร์แล้ว ให้ขอบคุณอย่างสุภาพก่อนปิดการขาย  
• ขอชื่อ-ที่อยู่จัดส่ง **หลังจาก** ลูกค้าส่งสลิปการโอนเงินถ้าเป็นการโอน  
• ถ้าลูกค้าไม่แจ้งว่าจะชำระเงินช่องทางไหน ให้เข้าใจว่าเก็บเงินปลายทางเสมอ
• **ส่งรูปสินค้าได้เฉพาะ** เมื่อข้อความล่าสุดของลูกค้าขอดูรูปสินค้าเท่านั้น  
  - หากเป็นรูปแอปริคอตแห้ง ให้ส่ง: "[SEND_IMAGE_APRICOT:https://i.imgur.com/XY0Nz82.jpeg]"
• **ห้ามใส่ [SEND_IMAGE_...]** หากผู้ใช้ไม่ได้พิมพ์ว่าต้องการดูรูปในข้อความล่าสุด  
• หากปิดการขายแล้ว ไม่ต้องถามว่าลูกค้าสนใจอะไรอีก ยกเว้นลูกค้าเป็นผู้เริ่มการสนทนาใหม่เอง
• หากต้องการถามเพิ่มหรือขอข้อมูลใด ๆ จากลูกค้า ให้ขึ้นต้นด้วย “ขออนุญาติถาม...” หรือ “ขออนุญาต...” เพื่อความสุภาพ  
• หากลูกค้าส่งสติกเกอร์ ให้คุณคิดคำตอบอะไรก็ได้
• หากพบว่าลูกค้าส่งรูป (ภาพสินค้า, ที่อยู่) โดยไม่มีข้อความ เซิร์ฟเวอร์จะส่งข้อความว่า "**ลูกค้าส่งรูปมา**"
  หรือหากเป็นไฟล์แนบอื่น (location, file, audio ฯลฯ) เซิร์ฟเวอร์จะส่งว่า "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**"
  - ข้อความ 2 แบบนี้ไม่ใช่คำพูดของลูกค้า แต่เป็นระบบแจ้งเพื่อบอกคุณ
• ห้ามตอบยาวเกินความจำเป็น ห้ามถามคำถามซ้ำ ๆ ที่ลูกค้าได้ตอบไปแล้ว

────────────────────────────────────────
2) สินค้า (สรุปสั้น)
────────────────────────────────────────
(ก) แอปริคอตแห้งไร้เมล็ดจากตุรกี
   • ราคาเริ่มต้น 98 บาท (โปรต่าง ๆ ตามที่กำหนด)
   • เก็บเงินปลายทางได้
   • โอนจ่ายได้
   • เนื้อเหนียวนุ่ม รสหวานอมเปรี้ยว อุดมด้วยวิตามินและใยอาหาร
   • ควรบริโภคในปริมาณเหมาะสม

(ข) โปรโมชั่น
   • 1 ถุง = 98 บาท
   • 2 ถุง = 180 บาท (ส่งฟรี)
   • 3 ถุง = 250 บาท (ส่งฟรี)
   (โปร 3 วันเท่านั้น)

────────────────────────────────────────
3) ช่องทางการชำระเงิน
────────────────────────────────────────
• หลังรวมรายการที่ลูกค้าต้องการแล้ว ถ้ามีค่าส่งก็ +50 บาทครั้งเดียว (ยกเว้นโปรส่งฟรี)
• ถามลูกค้าว่า “โอน หรือ ปลายทาง?”
   1. เก็บเงินปลายทาง (COD)
   2. โอนผ่านธนาคารกสิกรไทย เลขที่บัญชี 116-1431-865 ชื่อบัญชี ศิริลักษณ์ มูลไชย

────────────────────────────────────────
4) การตรวจสอบข้อมูล
────────────────────────────────────────
• ขอชื่อ-ที่อยู่จัดส่ง (เลขที่บ้าน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์) ให้ครบ 5 อย่าง
  - ถ้าไม่ครบ ให้ขอเพิ่ม
• ขอเบอร์โทร

────────────────────────────────────────
5) หมายเหตุสำคัญ
────────────────────────────────────────
• หากลูกค้าไม่บอกจำนวน ให้ถือว่าซื้อ 1 ถุง
• หากไม่เข้าใจบทสนทนา ให้แจ้งว่า “เดี๋ยวตามคุณเมย์มาตอบให้สักครู่นะครับ”
• ไม่ต้องพิมพ์ข้อมูลซ้ำ ถ้าลูกค้าไม่ได้ถาม
• หากลูกค้าบอกต้องการหลายถุง ให้รวมราคาให้ถูกต้องตามโปร
• ไม่ตอบยาวเกินจำเป็น
• ส่งวันถัดไป ถึงภายใน 1-3 วันครับ
────────────────────────────────────────
6) รายละเอียดสินค้าแบบเต็ม
────────────────────────────────────────
(ก) แอปริคอตแห้งไร้เมล็ดจากตุรกี
   • คุณค่าทางโภชนาการ (ต่อ 100 กรัม): 
       - พลังงาน ~241 กิโลแคลอรี
       - คาร์โบไฮเดรต 63 กรัม (น้ำตาล ~53 กรัม)
       - ใยอาหาร ~7 กรัม
       - โปรตีน 3.4 กรัม
       - มีวิตามินเอ, โพแทสเซียมสูง
   • ประโยชน์: บำรุงสายตา, เสริมกระดูก, ช่วยย่อยอาหาร, ต้านอนุมูลอิสระ
   • ข้อควรระวัง: น้ำตาลธรรมชาติสูง ควรรับประทานพอดี
   • โปรโมชั่น:
       - 1 ถุง = 98 บาท
       - 2 ถุง = 180 บาท (ส่งฟรี)
       - 3 ถุง = 250 บาท (ส่งฟรี)
     (ภายใน 3 วัน)
   • เก็บเงินปลายทางได้
   • โอนจ่ายได้
   • หากต้องการดูรูปภาพ: “[SEND_IMAGE_APRICOT:https://i.imgur.com/XY0Nz82.jpeg]”

---------------------------------------------------------------
(เพิ่ม) หากลูกค้าต้องการ “โอนจ่าย” หรือถาม “ขอเลขบัญชี” หรือ “โอนผ่านธนาคาร”:
- ให้แจ้งเลขบัญชีตามนี้: 116-1431-865 ชื่อบัญชี ศิริลักษณ์ มูลไชย (กสิกรไทย)
- และให้ส่งรูปภาพแนบด้วย: "[SEND_IMAGE_PAYMENT:https://i.imgur.com/gS0on5c.png]"

• หากลูกค้าสนใจโอนจ่าย: ส่งภาพช่องทางโอน "[SEND_IMAGE_PAYMENT:https://i.imgur.com/gS0on5c.png]"
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

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

// สร้าง MongoClient
const client = new MongoClient(MONGO_URI);

// ใช้ bodyParser
app.use(bodyParser.json());

// ------------------------
// System Instructions (ไม่แก้ไขหรือตัดทอน)
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
  (เช่น ตอนแรก ลูกค้าถามเรื่องราคาเริ่มต้น คุณแจ้งไปแล้ว ถ้าลูกค้าไม่ได้ถามต่อเรื่องราคา ห้ามพูดถึงราคาซ้ำ)  
• สามารถใช้อิโมจิ การเว้นวรรค หรือเว้นบรรทัด เพื่อให้ลูกค้าอ่านเข้าใจง่าย  
• จดจำสินค้าที่ลูกค้าสนใจไว้ และ **ไม่ถามซ้ำ** หากลูกค้าแจ้งไว้แล้ว  
  (ยกเว้นการคอนเฟิร์มออเดอร์ในช่วงท้ายการสนทนา)  
• เรียกลูกค้าว่า “คุณพี่” และใช้สรรพนาม “ครับ” (คุณเป็นผู้ชาย)  
• หากลูกค้าสอบถามรายละเอียดสินค้า (เช่น ขนาด, ราคา) ให้ตอบเฉพาะที่ถูกถาม ไม่ต้องยืดเยื้อ  
• หากลูกค้าพิมพ์ “ปลายทาง” ให้เข้าใจว่าเก็บเงินปลายทาง (COD) แต่ใช้ได้เฉพาะสินค้าที่รองรับ COD  
• เมื่อคอนเฟิร์มออเดอร์แล้ว ให้ขอบคุณอย่างสุภาพก่อนปิดการขาย  
• ขอชื่อ-ที่อยู่จัดส่ง **หลังจาก** ลูกค้าส่งสลิปการโอนเงินถ้าเป็นการโอน 
• ถ้าลูกค้าไม่แจ้งว่าจะชำระเงินช่องทางไหน ให้เข้าใจว่าเก็บเงินปลายทางเสมอ
• **ส่งรูปสินค้าได้เฉพาะ** เมื่อข้อความล่าสุดของลูกค้าขอดูรูปสินค้าเท่านั้น  
  - หากขอรูปสร้อยคอสายคาด: "[SEND_IMAGE_SROI:https://i.imgur.com/OgW7m9x.jpeg]"
• **ห้ามใส่ [SEND_IMAGE_...]** หากผู้ใช้ไม่ได้พิมพ์ว่าต้องการดูรูปในข้อความล่าสุด   (หรือยังไม่เคยขอดูรูปมาก่อน) 
• หากปิดการขายแล้ว ไม่ต้องถามว่าลูกค้าสนใจอะไรอีก ยกเว้นลูกค้าเป็นผู้เริ่มการสนทนาใหม่เอง
• หากต้องการถามเพิ่มหรือขอข้อมูลใด ๆ จากลูกค้า ให้ขึ้นต้นด้วย “ขออนุญาติถาม...” หรือ “ขออนุญาต...” เพื่อความสุภาพ  
• หากลูกค้าส่งสติกเกอร์ ให้คุณคิดคำตอบอะไรก็ได้
• หากพบว่าลูกค้าส่งรูป (ภาพสินค้า, ที่อยู่) โดยไม่มีข้อความ เซิร์ฟเวอร์จะส่งข้อความว่า "**ลูกค้าส่งรูปมา**" บอกคุณ
  หรือหากเป็นไฟล์แนบอื่น (location, file, audio ฯลฯ) เซิร์ฟเวอร์จะส่งว่า "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**" บอกคุณ
  - ข้อความ 2 แบบนี้ไม่ใช่คำพูดของลูกค้า แต่เป็นระบบแจ้งเพื่อบอกคุณ
• ห้ามตอบยาวเกินความจำเป็น ห้ามถามคำถามซ้ำ ๆ ที่ลูกค้าได้ตอบไปแล้ว

────────────────────────────────────────
2) สินค้า (สรุปสั้น)
────────────────────────────────────────
(ก) สร้อยคอสายคาดข้าง  
   • ราคาเริ่มต้น 290 บาท (ขึ้นอยู่กับจำนวนองค์ห้อยพระ)  
   • มีบริการเก็บเงินปลายทาง (COD) หรือโอนเงิน  
   • **จำนวนองค์ห้อยพระไม่ใช่จำนวนเส้น**  
     - เช่น “สร้อย 19 องค์” คือเชือก 1 เส้น ห้อยพระได้ 19 องค์  
   • รับประกันสินค้า 7 วัน หลังสินค้าถึงมือลูกค้า หากมีปัญหาสามารถแจ้งเคลมได้

(ข) จะมีการพัฒนาสินค้าในอนาคต

────────────────────────────────────────
3) ช่องทางการชำระเงิน
────────────────────────────────────────
• เมื่อรวมรายการที่ลูกค้าต้องการแล้ว ให้บวกค่าส่ง 50 บาท **ครั้งเดียว** ไม่ว่าจะกี่ชิ้น  
• ถามลูกค้าว่า “โอน หรือ ปลายทาง?” ยกเว้นบางสินค้าที่ต้องโอนเท่านั้น  
   1. เก็บเงินปลายทาง (COD) (ใช้ได้เฉพาะสร้อยคอสายคาดข้าง)  
   2. โอนผ่านบัญชีธนาคารกรุงศรี เลขที่บัญชี 768-1-09390-6 ชื่อบัญชี สหภาคคุณ ภูนาขาว  

────────────────────────────────────────
4) การตรวจสอบข้อมูล
────────────────────────────────────────
• ขอชื่อ-ที่อยู่ (เลขที่บ้าน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์) ให้ครบ 5 อย่าง  
  - ถ้าไม่ครบให้ขอเพิ่ม  
• เบอร์โทร

────────────────────────────────────────
5) หมายเหตุสำคัญ
────────────────────────────────────────
• หากลูกค้าไม่บอกจำนวน ให้ถือว่าซื้อ 1 ชิ้น (โดยไม่ต้อบอกลูกค้าว่า "(ถ้าคุณพี่ไม่บอกจำนวน จะถือว่าซื้อ 1 เส้นนะครับ)")
• หากไม่เข้าใจบทสนทนา ให้แจ้งว่า “เดี๋ยวตามเซียนต้าร์มาตอบให้สักครู่นะครับ”  
• ไม่ต้องพิมพ์ข้อมูลซ้ำ หากลูกค้าไม่ได้ถาม  
• หากลูกค้าบอกจำนวนองค์ห้อยพระเช่น “สร้อย 19 องค์” ให้ถือว่าเป็น 1 เส้น เว้นแต่ลูกค้าบอกเองว่าหลายเส้น
• หากลูกค้าสั่งซื้อหลายชิ้น คุณต้องรวมราคาของทุกชิ้นให้ถูกต้อง และบวกค่าส่งตามทีสุด
────────────────────────────────────────
6) รายละเอียดสินค้าแบบเต็ม
────────────────────────────────────────
(ก) สร้อยคอสายคาดข้าง
   • ทำจากทองเหลืองชุบน้ำทองแท้ ทนทาน ไม่ลอก ไม่ดำ  
   • ขนาดห้อยพระตั้งแต่ 5 ถึง 30 องค์ จะสั่งแบบกี่องค์ก็ได้ 
   • ความยาวเชือกมาตรฐาน 46 นิ้ว (ปรับแก้ได้ฟรี หากลูกค้ากังวลขนาด)  
   • อายุการใช้งานราว 3–6 เดือน สีจะค่อย ๆ ซีด  
   • ตัวอย่างราคา (ไม่รวมค่าส่ง 50 บาท):
       - 5 องค์: 290
       - 7 องค์: 350
       - 9 องค์: 390
       - 10 องค์: 420
       - 12 องค์: 460
       - 15 องค์: 520
       - 19 องค์: 570
       - 23 องค์: 770
       - 30 องค์: 990
   • บริการ COD หรือโอนได้  
   • หากกังวลเรื่องขนาดตัว:
     - สูง ≤170 ซม. / น้ำหนัก ≤80 กก. แนะนำ 46 นิ้ว
     - สูง ≤180 ซม. / น้ำหนัก ≤90 กก. แนะนำ 48–50 นิ้ว
     - กรณีอื่นให้ประเมินตามหน้างาน
   • มีทุกขนาด จะเอากี่องค์ก็ได้ อิงราคาจากตัวอย่างราคา

(ข) จะมีในอนาคต

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
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      // 1) กรณีลูกค้าส่งข้อความปกติ
      if (webhookEvent.message && webhookEvent.message.text) {
        const messageText = webhookEvent.message.text;

        // ดึงประวัติการแชทจาก MongoDB
        const history = await getChatHistory(senderId);

        // เรียก Assistant (ChatGPT) โดยส่ง System Instructions + ประวัติสนทนา + ข้อความใหม่
        const assistantResponse = await getAssistantResponse(history, messageText);

        // บันทึกประวัติใหม่ลงใน MongoDB
        await saveChatHistory(senderId, messageText, assistantResponse);

        // ตอบกลับผู้ใช้ทาง Messenger
        sendTextMessage(senderId, assistantResponse);

      }
      // 2) กรณีลูกค้าส่งรูป (หรือ attachment) แต่ไม่มี text
      else if (webhookEvent.message && webhookEvent.message.attachments) {
        const attachments = webhookEvent.message.attachments;
        let isImageFound = false;

        // ตรวจสอบว่ามีภาพใน attachments หรือไม่
        for (let att of attachments) {
          if (att.type === 'image') {
            isImageFound = true;
            break;
          }
        }

        if (isImageFound) {
          // หากพบว่าเป็นรูปภาพ ให้บอก ChatGPT ว่า “ลูกค้าส่งรูปมา”
          const userMessage = "**ลูกค้าส่งรูปมา**";

          // ดึงประวัติการแชท
          const history = await getChatHistory(senderId);

          // เรียก Assistant
          const assistantResponse = await getAssistantResponse(history, userMessage);

          // บันทึกลงใน MongoDB
          await saveChatHistory(senderId, userMessage, assistantResponse);

          // ตอบกลับผู้ใช้
          sendTextMessage(senderId, assistantResponse);
        } else {
          // หากเป็นไฟล์แนบอื่น เช่น location, file, audio...
          const userMessage = "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**";
          const history = await getChatHistory(senderId);
          const assistantResponse = await getAssistantResponse(history, userMessage);

          await saveChatHistory(senderId, userMessage, assistantResponse);

          sendTextMessage(senderId, assistantResponse);
        }
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// ------------------------
// ฟังก์ชัน: getChatHistory
// ------------------------
async function getChatHistory(senderId) {
  try {
    await client.connect();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const chats = await collection.find({ senderId }).toArray();

    // แปลงเป็นรูปแบบข้อความตาม role: "user"
    return chats.map((chat) => ({
      role: "user",
      content: chat.message,
    }));
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  } finally {
    await client.close();
  }
}

// ------------------------
// ฟังก์ชัน: getAssistantResponse
// ------------------------
async function getAssistantResponse(history, message) {
  try {
    // รวม system instructions + history + user message
    const messages = [
      { role: "system", content: systemInstructions },
      ...history,
      { role: "user", content: message },
    ];

    // เรียกโมเดลผ่าน OpenAI API (เปลี่ยนชื่อโมเดลตามต้องการ)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ตัวอย่างโมเดล
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
    await client.connect();
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
  } finally {
    await client.close();
  }
}

// ------------------------
// ฟังก์ชัน: sendTextMessage (รองรับหลายรูปพร้อมกัน)
// ------------------------
function sendTextMessage(senderId, response) {
  // Regex แบบ global เพื่อจับหลายคำสั่ง [SEND_IMAGE_XXX:URL]
  const imageRegex = /\[SEND_IMAGE_(HUNN|SROI):(https?:\/\/[^\s]+)\]/g;

  // matchAll เพื่อดึง match หลายรายการ
  const matches = [...response.matchAll(imageRegex)];

  // ตัดคำสั่ง [SEND_IMAGE_XXX:URL] ออกจากข้อความทั้งหมด
  let textPart = response.replace(imageRegex, '').trim();

  // ส่งข้อความ (ถ้ามี text เหลือ)
  if (textPart.length > 0) {
    sendSimpleTextMessage(senderId, textPart);
  }

  // วนลูปส่งรูปทีละ match
  matches.forEach(match => {
    const imageUrl = match[2];  // URL
    sendImageMessage(senderId, imageUrl);
  });
}

// ------------------------
// ฟังก์ชัน: sendSimpleTextMessage
// ------------------------
function sendSimpleTextMessage(senderId, text) {
  const requestBody = {
    recipient: { id: senderId },
    message: { text: text },
  };

  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err, res, body) => {
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
  }, (err, res, body) => {
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Remove dotenv since Firebase Cloud Functions use runtime config
// require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
// require("dotenv").config();

const functions = require("firebase-functions");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const { PDFDocument } = require("pdf-lib");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Import your questions array from a local file
const questions = require("./questions.js");

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Set up multer to handle file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit per file (adjust as needed)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, or PDF files are allowed."));
    }
  },
});

// (Optional) If you have static assets to serve within your function,
// you can use express.static. Otherwise, Firebase Hosting will handle static files.
// app.use(express.static(path.join(__dirname, "public")));
app.post("/upload-image", (req, res) => {
  upload.array("files", 10)(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ error: err.message });
    }

    const files = req.files;
    const userDescription = req.body.description;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    try {
      const geminiApiKey = functions.config().gemini.api_key;
      const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;

      let parts = [];

      for (const file of files) {
        if (file.mimetype === "application/pdf") {
          const pdfBuffer = file.buffer;
          const pdfDoc = await PDFDocument.load(pdfBuffer);
          const totalPages = pdfDoc.getPageCount();

          for (let i = 0; i < totalPages; i++) {
            const singlePagePdf = await PDFDocument.create();
            const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
            singlePagePdf.addPage(copiedPage);

            const singlePagePdfBytes = await singlePagePdf.save();
            const base64Data = Buffer.from(singlePagePdfBytes).toString("base64");

            parts.push({ inlineData: { mimeType: "application/pdf", data: base64Data } });
          }
        } else if (["image/jpeg", "image/png"].includes(file.mimetype)) {
          const base64Data = file.buffer.toString("base64");
          parts.push({ inlineData: { mimeType: file.mimetype, data: base64Data } });
        }
      }

      parts.push({ text: `
${userDescription}

Based on the provided images or PDFs, answer the following sustainability-related questions.
Respond to each question with 'Yes,' 'No,' or 'NA' (if not applicable or insufficient evidence).
Ensure that no questions are skipped. If a specific question cannot be evaluated, indicate this explicitly.

Instructions:
1. For each question, answer with 'Yes,' 'No,' or 'NA'.
2. Include the question with your response.
3. Provide a summary of the sustainability features and recommendations.

Questions:
${questions.join("\n")}
` });

      const requestBody = { contents: [{ parts }] };
      const geminiResponse = await axios.post(geminiApiUrl, requestBody);
      const reply =
        geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response generated.";

      console.log("Gemini API Response:", reply);
      res.json({ reply });
      await sendEmail(reply);
    } catch (error) {
      console.error("Error processing request:", error.message);
      res.status(500).json({ error: "Failed to fetch response from Gemini API." });
    }
  });
});

// Function to send email using nodemailer
async function sendEmail(reply) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: functions.config().gmail.email_user,
        pass: functions.config().gmail.email_password,
      },
    });

    const mailOptions = {
      from: functions.config().gmail.email_user,
      to: "danny.b@dwp.com",
      subject: "Sustainability Review AI Response",
      text: reply,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error.message);
  }
}

// Export the Express app as a Cloud Function
exports.myFunction = functions.https.onRequest(app);

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
const admin = require("firebase-admin");

// Import your questions array from a local file
const questions = require("./questions.js");

// Initialize Admin SDK if you haven't already
if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
// 1) NEW ENDPOINT: Generate a Signed URL for Cloud Storage
// ------------------------------------------------------
app.post("/get-upload-url", async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "No filename provided." });
    }

    const bucket = admin.storage().bucket();
    const file = bucket.file(filename);

    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: "image/jpeg", // or your expected type
    });

    return res.json({ uploadUrl });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return res.status(500).json({ error: "Failed to generate upload URL." });
  }
});

// ------------------------------------------------------
// 2) EXISTING MULTER SETUP (Memory Storage)
// ------------------------------------------------------
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

// ------------------------------------------------------
// 3) EXISTING ENDPOINT: Inline Gemini Processing
// ------------------------------------------------------
// 1) Add a new route to handle Gemini processing from GCS
app.post("/process-gemini", async (req, res) => {
  try {
    const { filename, description } = req.body;
    if (!filename || !description) {
      return res.status(400).json({ error: "Filename and description are required." });
    }

    // Reference the bucket and file
    const bucket = admin.storage().bucket();
    const fileRef = bucket.file(filename);

    // Download the file from GCS to memory
    const [fileBuffer] = await fileRef.download();

    // If it's a PDF, split pages and base64-encode. If it's an image, just base64-encode.
    // For example:
    let parts = [];

    if (filename.toLowerCase().endsWith(".pdf")) {
      // Process PDF
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const totalPages = pdfDoc.getPageCount();

      for (let i = 0; i < totalPages; i++) {
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);

        const singlePagePdfBytes = await singlePagePdf.save();
        const base64Data = Buffer.from(singlePagePdfBytes).toString("base64");

        parts.push({ inlineData: { mimeType: "application/pdf", data: base64Data } });
      }
    } else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg") || filename.toLowerCase().endsWith(".png")) {
      // Process image
      const base64Data = fileBuffer.toString("base64");
      // Use correct MIME type if needed
      const mimeType = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      parts.push({ inlineData: { mimeType, data: base64Data } });
    } else {
      // For any other file type, you could handle or return an error
      return res.status(400).json({ error: "Unsupported file type." });
    }

    // Add user description & questions
    parts.push({
      text: `
${description}

Based on the provided images or PDFs, answer the following sustainability-related questions.
Respond to each question with 'Yes,' 'No,' or 'NA' (if not applicable or insufficient evidence).
Ensure that no questions are skipped. If a specific question cannot be evaluated, indicate this explicitly.

Instructions:
1. For each question, answer with 'Yes,' 'No,' or 'NA'.
2. Include the question with your response.
3. Provide a summary of the sustainability features and recommendations.

Questions:
${questions.join("\n")}
`,
    });

    // 2) Call Gemini
    const geminiApiKey = functions.config().gemini.api_key;
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
    const requestBody = { contents: [{ parts }] };

    const geminiResponse = await axios.post(geminiApiUrl, requestBody);
    const reply =
      geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated.";

    console.log("Gemini API Response:", reply);

    // 3) Send Email
    await sendEmail(reply);

    // 4) Return the response to the client
    res.json({ reply });
  } catch (error) {
    console.error("Error processing Gemini:", error.message);
    res.status(500).json({ error: "Failed to process file with Gemini." });
  }
});

// ------------------------------------------------------
// 4) HELPER: Send Email
// ------------------------------------------------------
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

// ------------------------------------------------------
// 5) EXPORT THE EXPRESS APP
// ------------------------------------------------------
exports.myFunction = functions.https.onRequest(app);

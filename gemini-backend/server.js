require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const { PDFDocument } = require("pdf-lib");
const nodemailer = require("nodemailer"); // Ensure this line is present
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPEG, PNG, or PDF files are allowed."));
        }
    },
});

app.use(express.static(path.join(__dirname, "public")));

const questions = require("./questions.js");

app.post("/upload-image", upload.array("files", 10), async (req, res) => {
    const files = req.files;
    const userDescription = req.body.description;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
    }

    try {
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;

        let parts = []; // Accumulate all parts here

        for (const file of files) {
            const filePath = file.path;

            if (file.mimetype === "application/pdf") {
                const pdfBuffer = fs.readFileSync(filePath);
                const pdfDoc = await PDFDocument.load(pdfBuffer);
                const totalPages = pdfDoc.getPageCount();

                // Process each page of the PDF
                for (let i = 0; i < totalPages; i++) {
                    const singlePagePdf = await PDFDocument.create();
                    const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
                    singlePagePdf.addPage(copiedPage);

                    const singlePagePdfBytes = await singlePagePdf.save();
                    const base64Data = Buffer.from(singlePagePdfBytes).toString("base64");

                    // Add the processed page to parts array
                    parts.push({ inlineData: { mimeType: "application/pdf", data: base64Data } });
                }
            } else if (["image/jpeg", "image/png"].includes(file.mimetype)) {
                // Process image files
                const base64Data = fs.readFileSync(filePath, { encoding: "base64" });
                parts.push({ inlineData: { mimeType: file.mimetype, data: base64Data } });
            }

            // Clean up file after processing
            fs.unlinkSync(filePath);
        }

        // Add the user description and questions as the last part
        parts.push({ text: `
${userDescription}

Based on the provided images or PDFs, answer the following sustainability-related questions. Respond to each question with 'Yes,' 'No,' or 'NA' (if the question is not applicable or evidence is insufficient). Ensure that no questions are skipped. If a specific question cannot be evaluated due to missing information, indicate this explicitly.

Instructions:
1. For each question, answer with 'Yes,' 'No,' or 'NA'.
2. Include the question with your response.
3. At the end of the responses, provide a summary of the sustainability features and any recommendations.

Questions: ${questions.join("\n")}
` });

        // Make the request to the Gemini API with the correctly structured content
        const requestBody = { contents: [{ parts }] };
        const response = await axios.post(geminiApiUrl, requestBody);
        const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

        console.log("Gemini API Response:", reply);

        // Send the reply to the client
        res.json({ reply });

        // Optionally send the reply as an email
        await sendEmail(reply);
    } catch (error) {
        console.error("Error processing request:", error.message);
        res.status(500).json({ error: "Failed to fetch response from Gemini API." });
    }
});

async function sendEmail(reply) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER, // Your email address
                pass: process.env.EMAIL_PASSWORD, // Your app password
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

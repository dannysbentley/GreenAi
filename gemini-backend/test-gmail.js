require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { google } = require('googleapis');
require('dotenv').config();

// Load credentials from .env
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// Initialize OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Set the refresh token
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Function to test Gmail API
async function testGmailAPI() {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Make a simple request to list Gmail labels
    const res = await gmail.users.labels.list({ userId: 'me' });
    console.log('Success! Gmail Labels:');
    console.log(res.data.labels);
  } catch (error) {
    console.error('Error accessing Gmail API:', error.message);
  }
}

testGmailAPI();
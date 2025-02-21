require('dotenv').config();
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const http = require('http');
const url = require('url');
const open = require('open');

// Load environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const EMAIL_USER = process.env.EMAIL_USER;

// Define the scope(s)
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'profile','email'];

async function getAuthClient() {
    const oAuth2Client = new OAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI
    });
    return oAuth2Client;
}
async function getAuthorizationUrl() {
    const oAuth2Client = await getAuthClient();
    const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        include_granted_scopes: true
    });
    return authorizeUrl;
}

async function handleOAuthCallback(req, res) {
    const query = url.parse(req.url, true).query;
    const code = query.code;
    const oAuth2Client = await getAuthClient();
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        console.log("Access Token: ", tokens.access_token);
        console.log("Refresh Token: ", tokens.refresh_token);
        console.log("Token expiry: ", tokens.expiry_date);

        const gmail = google.gmail({version: 'v1', auth: oAuth2Client});
        const user_info = await gmail.users.getProfile({userId: EMAIL_USER});
        console.log(`User Email: ${user_info.data.emailAddress}`);
        res.end(`
          <p>Authorization successful! You can close this window.</p>
          <script>window.close()</script>
         `);

    } catch (error) {
       res.end('Error: ' + error.message);
        console.error('Error exchanging code for tokens:', error);
    }
}

async function main() {
    const authUrl = await getAuthorizationUrl();
    console.log('Authorize this app by visiting this url:', authUrl);
    open(authUrl);

    const server = http.createServer(async (req, res) => {
        if (req.url.startsWith('/oauth2callback')) {
            await handleOAuthCallback(req, res);
        }
    });

    server.listen(3000, () => console.log('Server started on port 3000'));
}


main().catch(console.error);
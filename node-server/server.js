require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

app.post('/api/trigger-sos', async (req, res) => {
  const { name, lat, lon, contacts, notes } = req.body; // `contacts` is now an array

  const message = `${name} started a SafeWalk trip.\nLocation: https://maps.google.com/?q=${lat},${lon}\nNotes: ${notes}`;

  try {
    const sendPromises = contacts.map((contact) =>
      client.messages.create({
        body: message,
        from: twilioNumber,
        to: contact,
      })
    );
    await Promise.all(sendPromises);
    res.status(200).json({ success: true, message: 'SMS sent to all contacts' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(3000, () => {
  console.log('🚀 Twilio server running on http://localhost:3000');
});

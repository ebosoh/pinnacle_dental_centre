export default async function handler(req, res) {
  // CORS configuration (optional, but good practice for webhooks)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests from ElevenLabs
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    // 1. Hardcode your Google Apps Script Web App URL here
    const GAS_URL = "https://script.google.com/macros/s/AKfycbw4cft8uDGPy8hjZwfmC-B5eD6gR7LWyaD81cYXCZ93g-dKNsqCpfoh7tFSTKNCf2Mr/exec";

    console.log("Incoming request from ElevenLabs to proxy:", req.body);
    console.log("Query parameters from URL:", req.query);

    // Merge query parameters into the body (so action=appointmentEnquiry is passed to Apps Script)
    const payload = { ...req.body, ...req.query };

    // 2. Forward the request to Google Apps Script. 
    // The native fetch API in Node.js automatically follows the 302 redirect.
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8", 
        // GAS handles text/plain better during POST boundaries
      },
      body: JSON.stringify(payload),
    });

    // 3. Wait for Google Apps Script to finish processing and parse the final JSON
    const data = await response.json();
    console.log("Response from GAS:", data);

    // 4. Send the result immediately back to ElevenLabs
    return res.status(200).json(data);

  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Proxy failed: " + error.message 
    });
  }
}

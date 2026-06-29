# ElevenLabs AI Agent — WhatsApp Setup Guide
## Pinnacle Dental Centre (Configurable for any clinic)

---

## What This Does

Your ElevenLabs AI Agent handles WhatsApp conversations natively (text + voice), and calls back to your Google Apps Script when it needs to create, check, cancel, or reschedule appointments. No external server required.

```
Patient (WhatsApp)  →  ElevenLabs AI Agent  →  Google Apps Script  →  Google Calendar
```

---

## Step 1: Deploy the Updated Code.gs

1. Open [script.google.com](https://script.google.com) and open your project
2. Copy-paste the entire contents of `Code.gs` into the editor
3. Click **Deploy → New deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** and copy the Web App URL
   - It looks like: `https://script.google.com/macros/s/AKfycb.../exec`
   - Keep this URL — you'll use it for all 4 tool webhooks below

> **Re-deployments:** Every time you edit `Code.gs`, go to Deploy → Manage deployments → click the pencil icon → set version to "New version" → Deploy.

---

## Step 2: Connect WhatsApp to ElevenLabs

1. Log in to [elevenlabs.io](https://elevenlabs.io) → **Conversational AI → Agents**
2. Open your agent: `agent_5601kdan454zfrnvj7abmajsmj93`
3. Click **Channels** → **WhatsApp**
4. Click **Connect WhatsApp Account**
   - Log in with your **Meta Business Manager** account
   - Select the clinic's WhatsApp Business phone number: **+254 706 076 636**
5. Click **Save** — ElevenLabs now receives all WhatsApp messages sent to that number

> **Prerequisite:** The WhatsApp number must be registered as a WhatsApp Business number in Meta Business Manager. If not already done, go to [business.facebook.com](https://business.facebook.com) → WhatsApp Accounts → Add Number.

---

## Step 3: Add the 4 Server Tools

In ElevenLabs → Your Agent → **Tools** → Click **Add Tool** → Select **Server Tool (Webhook)**

For each tool below, create one entry:

---

### Tool 1: check_availability

| Field | Value |
|---|---|
| **Name** | `check_availability` |
| **Description** | Check if there are open appointment slots on a given date. Use this before booking. |
| **Method** | POST |
| **URL** | *(your GAS Web App URL from Step 1)* |

**Request body schema:**
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "const": "checkAvailability"
    },
    "date": {
      "type": "string",
      "description": "The date to check, in YYYY-MM-DD format. Example: 2026-03-25"
    }
  },
  "required": ["action", "date"]
}
```

---

### Tool 2: create_booking

| Field | Value |
|---|---|
| **Name** | `create_booking` |
| **Description** | Book a dental appointment for a patient. Always confirm name, phone, service, and date/time first. |
| **Method** | POST |
| **URL** | *(your GAS Web App URL from Step 1)* |

**Request body schema:**
```json
{
  "type": "object",
  "properties": {
    "action":   { "type": "string", "const": "createBooking" },
    "name":     { "type": "string", "description": "Patient's full name" },
    "phone":    { "type": "string", "description": "Patient's WhatsApp/phone number with country code, e.g. +254712345678" },
    "service":  { "type": "string", "description": "Dental service requested, e.g. Dental Check-ups, Clear Aligners, Teeth Whitening" },
    "date":     { "type": "string", "description": "Appointment date and time in ISO 8601 format, e.g. 2026-03-25T10:00:00" },
    "email":    { "type": "string", "description": "Patient email address (optional)" },
    "message":  { "type": "string", "description": "Any additional notes from the patient (optional)" },
    "source":   { "type": "string", "const": "WhatsApp AI Agent" }
  },
  "required": ["action", "name", "phone", "service", "date"]
}
```

---

### Tool 3: cancel_booking

| Field | Value |
|---|---|
| **Name** | `cancel_booking` |
| **Description** | Cancel an existing appointment. Ask the patient for their phone number or name and appointment date. |
| **Method** | POST |
| **URL** | *(your GAS Web App URL from Step 1)* |

**Request body schema:**
```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "const": "cancelBooking" },
    "name":   { "type": "string", "description": "Patient's full name" },
    "phone":  { "type": "string", "description": "Patient's phone number with country code" },
    "date":   { "type": "string", "description": "Approximate appointment date (YYYY-MM-DD) to narrow the search (optional)" }
  },
  "required": ["action"]
}
```

---

### Tool 4: reschedule_booking

| Field | Value |
|---|---|
| **Name** | `reschedule_booking` |
| **Description** | Reschedule an existing appointment to a new date/time. Always check availability for the new slot first. |
| **Method** | POST |
| **URL** | *(your GAS Web App URL from Step 1)* |

**Request body schema:**
```json
{
  "type": "object",
  "properties": {
    "action":   { "type": "string", "const": "rescheduleBooking" },
    "name":     { "type": "string", "description": "Patient's full name" },
    "phone":    { "type": "string", "description": "Patient's phone number with country code" },
    "date":     { "type": "string", "description": "Original appointment date (YYYY-MM-DD) to find the booking" },
    "newDate":  { "type": "string", "description": "New appointment date and time in ISO 8601 format, e.g. 2026-03-28T14:00:00" },
    "service":  { "type": "string", "description": "Service name (optional, keeps original if not supplied)" }
  },
  "required": ["action", "newDate"]
}
```

---

### Tool 5: appointmentEnquiry

| Field | Value |
|---|---|
| **Name** | `appointmentEnquiry` |
| **Description** | Retrieve the list of upcoming appointments booked under a patient's name and/or phone number. |
| **Method** | POST |
| **URL** | *(your GAS Web App URL from Step 1)* |

**Request body schema:**
```json
{
  "type": "object",
  "properties": {
    "action":   { "type": "string", "const": "appointmentEnquiry" },
    "name":     { "type": "string", "description": "Patient's full name (optional if phone is provided)" },
    "phone":    { "type": "string", "description": "Patient's phone number with country code (optional if name is provided)" }
  },
  "required": ["action"]
}
```

---

## Step 4: Paste the System Prompt

1. In ElevenLabs → Your Agent → **General** → **System Prompt**
2. Delete the existing prompt
3. Paste the entire contents of `AGENT_SYSTEM_PROMPT.md`
4. Click **Save**

---

## Step 5: Test

Send these messages to the clinic's WhatsApp number:

| Message | Expected Result |
|---|---|
| "Hi, what are your opening hours?" | Agent replies with clinic hours |
| "What services do you offer?" | Agent lists services |
| "I want to book a dental check-up" | Agent collects name, phone, date → creates calendar event |
| "Is there availability on 25 March?" | Agent calls check_availability → lists free slots |
| "Cancel my appointment" | Agent asks for name/phone → deletes calendar event |
| "Reschedule to 28 March at 2pm" | Agent checks availability → moves event |
| "What are my upcoming appointments?" | Agent collects name or phone → calls appointmentEnquiry → lists matched upcoming appointments |
| *(Any inappropriate message)* | Agent politely declines, no action taken |

---

## Configuring for Another Clinic

Only **3 things** need to change in `Code.gs`:

```javascript
const CONFIG = {
  CLINIC_NAME:         'YOUR CLINIC NAME',
  CLINIC_PHONE:        '+COUNTRYCODE PHONE',
  CLINIC_ADDRESS:      'Address here',
  DOCTOR_CALENDAR_ID:  'your-calendar-id@group.calendar.google.com',
  // ... rest stays the same
};
```

Redeploy `Code.gs`, create a new ElevenLabs agent with the same tool schemas, and connect its WhatsApp channel to the new business number.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Tool returns "Calendar not found" | Ensure the GAS script is run as an account that has edit access to the calendar |
| WhatsApp messages not reaching agent | Verify the number is connected in ElevenLabs → Channels → WhatsApp |
| Booking not appearing in sheet | The sheet must be linked in Google Apps Script (File → Project Settings → Script linked to spreadsheet) |
| "Deployment failed" in GAS | Check for JavaScript syntax errors before deploying |
| Content is flagged incorrectly | Edit the `BLOCKED_KEYWORDS` array in `Code.gs` to adjust the blocklist |

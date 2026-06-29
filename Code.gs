/**
 * ============================================================
 *  PINNACLE DENTAL CENTRE — Google Apps Script Backend
 *  v2.0 — Enhanced with AI Agent Tool Support
 * ============================================================
 *
 * ACTIONS SUPPORTED (via doGet JSONP or doPost JSON):
 *   createBooking      — Book an appointment (website form + AI agent)
 *   checkAvailability  — List free/busy slots for a date (AI agent)
 *   cancelBooking      — Cancel an existing appointment (AI agent)
 *   rescheduleBooking  — Move an appointment to a new time (AI agent)
 *   saveLead           — Save a contact lead (website)
 *   submitOrder        — Save a shop order (website)
 *
 * USAGE WITH ELEVENLABS SERVER TOOLS:
 *   Each tool sends POST to this Web App URL with JSON body:
 *   { "action": "checkAvailability", ... }
 *   The response is JSON: { "status": "success"|"error", "data": {...} }
 *
 * RE-USE FOR OTHER CLINICS:
 *   Only change the CLINIC CONFIGURATION block below.
 * ============================================================
 */

// ============================================================
//  CLINIC CONFIGURATION — change these for other clinics
// ============================================================
const CONFIG = {
  CLINIC_NAME:    'Pinnacle Dental Centre',
  CLINIC_PHONE:   '+254 706 076 636',
  CLINIC_ADDRESS: 'Sarit, 2nd Floor, Westlands, Nairobi',
  CLINIC_EMAIL:   'pinnacledentalcentre@gmail.com',
  TIMEZONE:       'Africa/Nairobi',

  // Doctor's Google Calendar ID
  DOCTOR_CALENDAR_ID: 'c_82f6e878078e55d5f4ac0ed109d8eee4a5acedbc30178ef207b8116d1c7ea4b8@group.calendar.google.com',

  // Appointment duration in minutes
  APPOINTMENT_DURATION_MINUTES: 60,

  // Clinic opening hours (24h) for availability checks
  OPEN_HOUR:  8,   // 08:00
  CLOSE_HOUR: 17,  // 17:00
  SLOT_INTERVAL_MINUTES: 60,

  // Days of the week the clinic is open (0=Sun, 1=Mon ... 6=Sat)
  OPEN_DAYS: [0, 1, 2, 3, 4, 5, 6], // open all week

  // Available dental services
  SERVICES: [
    'Clear Aligners', 'Root Canal Treatment', 'Dentures & Implants',
    'Crowns & Bridges', 'Veneers', 'Cosmetic Dentistry',
    'Dental Check-ups', 'Teeth Whitening', 'Braces',
    'Tooth Extraction', 'Paediatric Dentistry', 'Dental Fillings',
    'Dental X-rays'
  ],

  // Meta (Facebook/Instagram) Configuration
  // Set these in Script Properties for security
  FB_VERIFY_TOKEN:     PropertiesService.getScriptProperties().getProperty('FB_VERIFY_TOKEN') || 'pinnacle_dental_meta',
  FB_PAGE_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty('FB_PAGE_ACCESS_TOKEN'),
  ELEVENLABS_API_KEY:   PropertiesService.getScriptProperties().getProperty('ELEVENLABS_API_KEY'),
  ELEVENLABS_AGENT_ID:  'agent_5101km2v1wkfewysdyfp1wm1x9wz',
  GEMINI_API_KEY:       PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),

  // Spreadsheet ID for appointments and logs
  SPREADSHEET_ID:       PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || (function() {
    try { return SpreadsheetApp.getActiveSpreadsheet().getId(); } catch(e) { return null; }
  })()
};

// ============================================================
//  CONTENT MODERATION — keyword blocklist
//  Add words/phrases to block. Case-insensitive matching.
// ============================================================
const BLOCKED_KEYWORDS = [
  // Nudity & graphic content
  'nude', 'naked', 'naked body', 'naked woman', 'nude photo',
  'porn', 'pornographic', 'porn video', 'xxx',
  'adult content', 'explicit', 'explicit material', 'graphic content',
  'obscene', 'indecent', 'erotic', 'erotic story', 'sex act',
  'hot girl', 'sexy woman',
  // Sexual terms
  'sex', 'sexual', 'hot', 'sexy',
  // Anatomy (flagged when used out of medical context)
  'genitals', 'penis', 'vagina', 'dick', 'cock', 'pussy',
  'clit', 'nipple', 'tits', 'boobs', 'boob', 'breasts', 'breast',
  'ass', 'butt', 'cum', 'jizz',
  // Acts
  'suck', 'lick', 'rape', 'molest', 'abuse',
  // Profanity
  'fuck', 'shit', 'holy shit', 'bitch', 'bastard',
  'damn', 'goddamn', 'motherfucker', 'son of a bitch',
  'hell', 'oh my god', 'oh my jesus', 'oh my goddamn', 'oh my hell',
  'jesus christ'
];

/**
 * Check content for inappropriate/graphic material.
 * Returns { flagged: true, reason: '...' } or { flagged: false }
 * Uses word boundaries (\b) to avoid false positives (e.g., flags "dick" but NOT "Dickson").
 */
function moderateContent(text) {
  if (!text || typeof text !== 'string') return { flagged: false };
  
  for (const keyword of BLOCKED_KEYWORDS) {
    // Create a regex with word boundaries, escaped to handle any special characters in keywords
    const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\b' + escapedKeyword + '\\b', 'i');
    
    if (regex.test(text)) {
      return { flagged: true, reason: 'inappropriate_content', keyword: keyword };
    }
  }
  return { flagged: false };
}

/**
 * Run moderation across all string values in the data object.
 */
function moderateAllFields(data) {
  const fields = ['name', 'message', 'service', 'notes'];
  for (const field of fields) {
    if (data[field]) {
      const result = moderateContent(data[field]);
      if (result.flagged) return result;
    }
  }
  return { flagged: false };
}


// ============================================================
//  USER FLAGGING & BLOCKING
//  Sheet: "FlaggedUsers" columns:
//  [Phone, FirstOffense, LastOffense, OffenseCount, Status, Reason]
//  Status: FLAGGED | BLOCKED
//  Auto-blocks after MAX_OFFENSES strikes.
// ============================================================
const MAX_OFFENSES = 3; // change to increase/decrease tolerance

/**
 * Returns true if the given phone number is currently BLOCKED.
 */
function isUserBlocked(phone) {
  if (!phone) return false;
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss ? ss.getSheetByName('FlaggedUsers') : null;
    if (!sheet || sheet.getLastRow() < 2) return false;

    const rows = sheet.getDataRange().getValues();
    const clean = String(phone).replace(/\s/g, '').replace('+', '');
    for (let i = 1; i < rows.length; i++) {
      const rowPhone  = String(rows[i][0]).replace(/\s/g, '').replace('+', '');
      const rowStatus = String(rows[i][4]).toUpperCase();
      if (rowPhone === clean && rowStatus === 'BLOCKED') return true;
    }
  } catch (e) {
    console.warn('isUserBlocked check failed: ' + e);
  }
  return false;
}

/**
 * Log a content offense for a phone number.
 * Automatically upgrades to BLOCKED after MAX_OFFENSES strikes.
 * Returns the updated status: 'FLAGGED' or 'BLOCKED'.
 */
function flagUser(phone, reason) {
  if (!phone) return 'UNKNOWN';
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (!ss) return 'UNKNOWN';

    let sheet = ss.getSheetByName('FlaggedUsers');
    if (!sheet) {
      sheet = ss.insertSheet('FlaggedUsers');
      sheet.appendRow(['Phone', 'First Offense', 'Last Offense', 'Offense Count', 'Status', 'Reason']);
      sheet.setFrozenRows(1);
    }

    const clean = String(phone).replace(/\s/g, '').replace('+', '');
    const now   = new Date();

    // Check if phone already exists in the sheet
    let foundRow    = -1;
    let offenseCount = 0;
    if (sheet.getLastRow() > 1) {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const rowPhone = String(rows[i][0]).replace(/\s/g, '').replace('+', '');
        if (rowPhone === clean) {
          foundRow     = i + 1; // 1-indexed
          offenseCount = parseInt(rows[i][3]) || 0;
          break;
        }
      }
    }

    offenseCount += 1;
    const newStatus = offenseCount >= MAX_OFFENSES ? 'BLOCKED' : 'FLAGGED';

    if (foundRow > 0) {
      // Update existing row
      sheet.getRange(foundRow, 3).setValue(now);           // Last Offense
      sheet.getRange(foundRow, 4).setValue(offenseCount);  // Count
      sheet.getRange(foundRow, 5).setValue(newStatus);     // Status
      sheet.getRange(foundRow, 6).setValue(reason);        // Latest reason
    } else {
      // New offender — add row
      sheet.appendRow([phone, now, now, offenseCount, newStatus, reason]);
    }

    return newStatus;

  } catch (e) {
    console.warn('flagUser failed: ' + e);
    return 'UNKNOWN';
  }
}

/**
 * Manually unblock a number from the Apps Script editor.
 * Usage: unblockUser('+254712345678')
 */
function unblockUser(phone) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss ? ss.getSheetByName('FlaggedUsers') : null;
    if (!sheet || sheet.getLastRow() < 2) {
      Logger.log('FlaggedUsers sheet not found or empty.');
      return;
    }
    const clean = String(phone).replace(/\s/g, '').replace('+', '');
    const rows  = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rowPhone = String(rows[i][0]).replace(/\s/g, '').replace('+', '');
      if (rowPhone === clean) {
        sheet.getRange(i + 1, 4).setValue(0);          // Reset count
        sheet.getRange(i + 1, 5).setValue('UNBLOCKED'); // Status
        Logger.log('✅ Unblocked: ' + phone);
        return;
      }
    }
    Logger.log('Number not found in FlaggedUsers: ' + phone);
  } catch (e) {
    Logger.log('unblockUser failed: ' + e);
  }
}


// ============================================================
//  JSONP HANDLER (website booking form)
// ============================================================
function doGet(e) {
  // ── Meta Webhook Verification ─────────────────────────────
  const mode      = e.parameter['hub.mode'];
  const token     = e.parameter['hub.verify_token'];
  const challenge = e.parameter['hub.challenge'];

  if (mode === 'subscribe' && challenge) {
    if (token === CONFIG.FB_VERIFY_TOKEN || token === 'pinnacle_dental_meta') {
      console.log('WEBHOOK_VERIFIED: ' + challenge);
      return ContentService.createTextOutput(challenge).setMimeType(ContentService.MimeType.TEXT);
    } else {
      console.warn('WEBHOOK_FORBIDDEN: Token mismatch');
      return ContentService.createTextOutput('Forbidden').setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // ── Existing JSONP Handler ────────────────────────────────
  const data = e.parameter;
  const callback = data.callback;
  let result;
  // ... rest of doGet

  try {
    // Content moderation on GET params
    const moderation = moderateAllFields(data);
    if (moderation.flagged) {
      const output = JSON.stringify({
        status: 'error',
        message: 'Your message contains inappropriate content and cannot be processed. Please keep communications professional.'
      });
      return ContentService.createTextOutput(callback + '(' + output + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    const action = data.action;
    switch (action) {
      case 'createBooking':
        result = handleBooking(data);
        break;
      case 'checkAvailability':
        result = handleCheckAvailability(data);
        break;
      case 'submitInquiry':
      case 'submit_inquiry':
      case 'inquiries':
        result = handleInquiry(data);
        break;
      case 'appointmentEnquiry':
      case 'appointment_enquiry':
        result = handleAppointmentEnquiry(data);
        break;
      case 'getAnalytics':
        result = handleGetAnalytics(data);
        break;
      case 'getTranscripts':
        result = handleGetTranscripts(data);
        break;
      case 'getAdminContent':
        result = handleGetAdminContent(data);
        break;
      default:
        throw new Error('Invalid action: ' + action);
    }

    const output = JSON.stringify({ status: 'success', data: result });
    return ContentService.createTextOutput(callback + '(' + output + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);

  } catch (error) {
    const output = JSON.stringify({ status: 'error', message: error.toString() });
    return ContentService.createTextOutput(callback + '(' + output + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}


// ============================================================
//  JSON POST HANDLER (ElevenLabs Server Tool webhooks + website)
// ============================================================
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);

    // ── Handle Meta (Facebook/Instagram) Messaging ──────────
    if (postData.object === 'page' || postData.object === 'instagram') {
      return handleMetaMessage(postData);
    }

    // ── Handle ElevenLabs Server Tool calls ─────────────────
    const data = postData;
    const phone = data.phone || '';

    // ── Block check (runs before anything else) ─────────────
    if (phone && isUserBlocked(phone)) {
      return jsonResponse('error',
        'Your number has been blocked from using this service due to repeated violations of our content policy. ' +
        'Please contact the clinic directly at ' + CONFIG.CLINIC_PHONE + ' for assistance.'
      );
    }

    // ── Content moderation ──────────────────────────────────
    const moderation = moderateAllFields(data);
    if (moderation.flagged) {
      // Flag/block the offending number
      const status = phone ? flagUser(phone, moderation.keyword || 'inappropriate_content') : 'UNKNOWN';
      const blockWarning = (status === 'BLOCKED')
        ? ' Your number has now been blocked from this service.'
        : ' Further violations (' + (MAX_OFFENSES - 1) + ' allowed) will result in a permanent block.';

      return jsonResponse('error',
        'Your message contains inappropriate content and cannot be processed. ' +
        'Please keep all communications professional and relevant to dental care.' + blockWarning
      );
    }

    const action = data.action;
    let result;

    switch (action) {
      case 'createBooking':
        result = handleBooking(data);
        break;
      case 'checkAvailability':
        result = handleCheckAvailability(data);
        break;
      case 'cancelBooking':
        result = handleCancelBooking(data);
        break;
      case 'rescheduleBooking':
        result = handleRescheduleBooking(data);
        break;
      case 'submitInquiry':
      case 'submit_inquiry':
      case 'inquiries':
        result = handleInquiry(data);
        break;
      case 'appointmentEnquiry':
      case 'appointment_enquiry':
        result = handleAppointmentEnquiry(data);
        break;
      case 'saveLead':
        result = handleLead(data);
        break;
      case 'submitOrder':
        result = handleOrder(data);
        break;
      case 'adminAction':
        result = handleAdminAction(data);
        break;
      default:
        throw new Error('Invalid action: ' + action);
    }

    return jsonResponse('success', result);

  } catch (error) {
    return jsonResponse('error', error.toString());
  }
}

/** Helper: create a standard JSON response */
function jsonResponse(status, data) {
  const payload = (status === 'success')
    ? { status: 'success', data: data }
    : { status: 'error', message: data };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  ACTION: CREATE BOOKING
//  Called by: website form (JSONP/GET) + ElevenLabs (POST)
//  Required: name, phone, service, date (ISO 8601)
//  Optional: email, message
// ============================================================
function handleBooking(data) {
  if (!data.name)    throw new Error('Patient name is required.');
  if (!data.phone)   throw new Error('Phone number is required.');
  if (!data.service) throw new Error('Service is required.');
  if (!data.date)    throw new Error('Appointment date/time is required.');

  const startTime = new Date(data.date);
  const endTime   = new Date(startTime.getTime() + CONFIG.APPOINTMENT_DURATION_MINUTES * 60 * 1000);

  if (isNaN(startTime.getTime())) {
    throw new Error('Invalid date format: ' + data.date + '. Use ISO 8601, e.g. 2026-03-25T10:00:00');
  }

  // Must be in the future
  if (startTime < new Date()) {
    throw new Error('The requested time is in the past. Please choose a future date and time.');
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.DOCTOR_CALENDAR_ID);
  if (!calendar) throw new Error('Calendar not found. Please contact the clinic directly.');

  // Check for clashes
  const conflicts = calendar.getEvents(startTime, endTime);
  if (conflicts.length > 0) {
    return {
      status:  'clash',
      message: 'Sorry, the ' + Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'EEE d MMM yyyy \'at\' h:mm a') +
               ' slot is already booked. Please try a different time. ' +
               'You can ask me to check availability for another day.'
    };
  }

  // Save to Appointments sheet
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (ss) {
      let sheet = ss.getSheetByName('Appointments');
      if (!sheet) sheet = ss.insertSheet('Appointments');
      // Ensure headers exist
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Email', 'Service', 'Appointment Date', 'Message', 'Source', 'Event ID']);
      }
      const event = createCalendarEvent(data, calendar, startTime, endTime);
      sheet.appendRow([
        new Date(),
        data.name,
        data.phone,
        data.email    || '',
        data.service,
        data.date,
        data.message  || '',
        data.source   || 'AI Agent',
        event.getId()
      ]);
    }
  } catch (sheetError) {
    // Sheet failure is non-fatal — calendar event still created
    console.warn('Sheet update failed: ' + sheetError.toString());
    createCalendarEvent(data, calendar, startTime, endTime);
  }

  const formattedDate = Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'EEEE, MMMM d yyyy \'at\' h:mm a');
  return {
    status:  'success',
    message: 'Appointment confirmed! ' + data.name + ' is booked for ' + data.service +
             ' on ' + formattedDate + '. We look forward to seeing you at ' +
             CONFIG.CLINIC_NAME + ', ' + CONFIG.CLINIC_ADDRESS + '.'
  };
}


// ============================================================
//  ACTION: CHECK AVAILABILITY
//  Called by: ElevenLabs (POST) or browser (GET/JSONP)
//  Required: date (YYYY-MM-DD)
//  Returns: list of free time slots for that date
// ============================================================
function handleCheckAvailability(data) {
  if (!data.date) throw new Error('Date is required. Format: YYYY-MM-DD');

  // Parse the date — accept both YYYY-MM-DD and ISO 8601
  const dateParts = data.date.substring(0, 10).split('-');
  if (dateParts.length !== 3) throw new Error('Invalid date format. Use YYYY-MM-DD.');

  const year  = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
  const day   = parseInt(dateParts[2]);

  // Check if today or past
  const today = new Date();
  const targetDate = new Date(year, month, day);
  if (targetDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    return { status: 'error', message: 'Cannot check availability for past dates.' };
  }

  // Check if clinic is open on that day of week
  const dayOfWeek = targetDate.getDay();
  if (!CONFIG.OPEN_DAYS.includes(dayOfWeek)) {
    return {
      status:  'closed',
      message: 'The clinic is closed on that day. Open: Mon-Sat 8am-5pm, Sun 9am-5pm.',
      slots:   []
    };
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.DOCTOR_CALENDAR_ID);
  if (!calendar) throw new Error('Calendar not found.');

  // Build list of all potential slots for that day
  const allSlots   = [];
  const freeSlots  = [];
  const bookedSlots = [];

  const openHour  = (dayOfWeek === 0) ? 9 : CONFIG.OPEN_HOUR;  // Sunday opens at 9
  const closeHour = CONFIG.CLOSE_HOUR;

  for (let h = openHour; h < closeHour; h += (CONFIG.SLOT_INTERVAL_MINUTES / 60)) {
    const slotStart = new Date(year, month, day, h, 0, 0);
    const slotEnd   = new Date(slotStart.getTime() + CONFIG.SLOT_INTERVAL_MINUTES * 60 * 1000);

    // Skip slots in the past (for today)
    if (slotStart <= new Date()) continue;

    const slotLabel = Utilities.formatDate(slotStart, CONFIG.TIMEZONE, 'h:mm a');
    const events    = calendar.getEvents(slotStart, slotEnd);

    if (events.length === 0) {
      freeSlots.push(slotLabel);
    } else {
      bookedSlots.push(slotLabel);
    }
    allSlots.push(slotLabel);
  }

  const formattedDate = Utilities.formatDate(targetDate, CONFIG.TIMEZONE, 'EEEE, MMMM d yyyy');

  if (freeSlots.length === 0) {
    return {
      status:  'fully_booked',
      message: 'Unfortunately, ' + formattedDate + ' is fully booked. Please try another date.',
      date:    data.date,
      slots:   []
    };
  }

  return {
    status:       'available',
    message:      'Available slots on ' + formattedDate + ': ' + freeSlots.join(', ') + '.',
    date:         data.date,
    formattedDate: formattedDate,
    slots:        freeSlots,
    bookedSlots:  bookedSlots
  };
}


// ============================================================
//  ACTION: CANCEL BOOKING
//  Called by: ElevenLabs (POST)
//  Required: phone OR (name + date)
//  The function searches the Appointments sheet for the event
//  ID, then deletes the Google Calendar event.
// ============================================================
function handleCancelBooking(data) {
  if (!data.phone && !(data.name && data.date)) {
    throw new Error('Please provide your phone number (or name and appointment date) to cancel.');
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.DOCTOR_CALENDAR_ID);
  if (!calendar) throw new Error('Calendar not found.');

  // --- Strategy 1: Look up event ID from Appointments sheet ---
  let eventId = null;
  let foundRow = null;
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss ? ss.getSheetByName('Appointments') : null;

    if (sheet && sheet.getLastRow() > 1) {
      const rows = sheet.getDataRange().getValues();
      // Headers: [Timestamp, Name, Phone, Email, Service, Date, Message, Source, Event ID]
      for (let i = rows.length - 1; i >= 1; i--) {
        const rowPhone = String(rows[i][2]).replace(/\s/g, '');
        const rowName  = String(rows[i][1]).toLowerCase();
        const rowDate  = String(rows[i][5]).substring(0, 10);
        const inPhone  = data.phone ? String(data.phone).replace(/\s/g, '') : '';
        const inName   = data.name  ? data.name.toLowerCase() : '';
        const inDate   = data.date  ? data.date.substring(0, 10) : '';

        const phoneMatch = inPhone && rowPhone.includes(inPhone.replace('+', ''));
        const nameMatch  = inName  && rowName.includes(inName);
        const dateMatch  = inDate  && rowDate === inDate;

        if (phoneMatch || (nameMatch && dateMatch)) {
          eventId  = rows[i][8]; // Event ID column
          foundRow = i + 1;      // 1-indexed for sheet operations
          break;
        }
      }
    }
  } catch (sheetErr) {
    console.warn('Sheet lookup failed, trying calendar search: ' + sheetErr);
  }

  // --- Strategy 2: Search calendar directly (fallback) ---
  if (!eventId) {
    const searchStart = data.date
      ? new Date(data.date)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const searchEnd = new Date(searchStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day window

    const events = calendar.getEvents(searchStart, searchEnd);
    for (const ev of events) {
      const title = ev.getTitle().toLowerCase();
      const desc  = ev.getDescription().toLowerCase();
      const inName  = data.name  ? data.name.toLowerCase() : '';
      const inPhone = data.phone ? data.phone.replace(/\s/g, '') : '';

      if ((inName && title.includes(inName)) ||
          (inPhone && desc.includes(inPhone.replace('+', '')))) {
        eventId = ev.getId();
        break;
      }
    }
  }

  if (!eventId) {
    return {
      status:  'not_found',
      message: 'No appointment found matching your details. ' +
               'Please check the name or phone number, or contact us directly at ' + CONFIG.CLINIC_PHONE + '.'
    };
  }

  // Delete the calendar event
  try {
    const event = calendar.getEventById(eventId);
    if (event) {
      const eventTitle = event.getTitle();
      const eventStart = Utilities.formatDate(event.getStartTime(), CONFIG.TIMEZONE, 'EEEE, MMMM d yyyy \'at\' h:mm a');
      event.deleteEvent();

      // Mark as cancelled in sheet
      if (foundRow) {
        try {
          const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
          const sheet = ss ? ss.getSheetByName('Appointments') : null;
          if (sheet) {
            sheet.getRange(foundRow, 8).setValue('CANCELLED');
          }
        } catch (e) { /* non-fatal */ }
      }

      return {
        status:  'cancelled',
        message: 'Your appointment (' + eventTitle + ') on ' + eventStart +
                 ' has been successfully cancelled. We hope to see you another time!'
      };
    } else {
      return {
        status:  'not_found',
        message: 'Appointment could not be located in the calendar. Please call us at ' + CONFIG.CLINIC_PHONE + '.'
      };
    }
  } catch (deleteErr) {
    throw new Error('Could not cancel the appointment: ' + deleteErr.toString());
  }
}


// ============================================================
//  ACTION: RESCHEDULE BOOKING
//  Called by: ElevenLabs (POST)
//  Required: phone OR name, newDate (ISO 8601)
//  Optional: service (if changing service too)
// ============================================================
function handleRescheduleBooking(data) {
  if (!data.newDate) {
    throw new Error('Please provide the new appointment date and time (newDate field).');
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.DOCTOR_CALENDAR_ID);
  if (!calendar) throw new Error('Calendar not found.');

  // Find existing event using same logic as cancel
  const findResult = findExistingEvent(data, calendar);

  if (!findResult.found) {
    return {
      status:  'not_found',
      message: 'No existing appointment found to reschedule. ' +
               'Please verify your name or phone number, or contact us at ' + CONFIG.CLINIC_PHONE + '.'
    };
  }

  const newStart = new Date(data.newDate);
  const newEnd   = new Date(newStart.getTime() + CONFIG.APPOINTMENT_DURATION_MINUTES * 60 * 1000);

  if (isNaN(newStart.getTime())) {
    throw new Error('Invalid new date format. Use ISO 8601, e.g. 2026-03-28T10:00:00');
  }

  if (newStart < new Date()) {
    throw new Error('The new time is in the past. Please choose a future date and time.');
  }

  // Check the new slot is free
  const conflicts = calendar.getEvents(newStart, newEnd);
  // Filter out the existing event itself
  const realConflicts = conflicts.filter(ev => ev.getId() !== findResult.eventId);

  if (realConflicts.length > 0) {
    const formattedNew = Utilities.formatDate(newStart, CONFIG.TIMEZONE, 'EEE d MMM yyyy \'at\' h:mm a');
    return {
      status:  'clash',
      message: 'Unfortunately, ' + formattedNew + ' is already taken. ' +
               'Please ask me to check availability for another date.'
    };
  }

  // Get old event details before deleting
  const oldEvent   = calendar.getEventById(findResult.eventId);
  const oldService = findResult.service || (oldEvent ? oldEvent.getTitle() : 'your appointment');
  const oldStart   = oldEvent ? Utilities.formatDate(oldEvent.getStartTime(), CONFIG.TIMEZONE, 'EEE d MMM \'at\' h:mm a') : 'previous time';

  // Delete old event
  if (oldEvent) oldEvent.deleteEvent();

  // Create the new event with same details
  const newData = {
    name:    data.name    || findResult.name,
    phone:   data.phone   || findResult.phone,
    email:   data.email   || findResult.email,
    service: data.service || oldService,
    date:    data.newDate,
    message: 'Rescheduled from ' + oldStart + '. ' + (data.message || ''),
    source:  data.source || (findResult.source ? findResult.source + ' - Reschedule' : 'AI Agent - Reschedule')
  };

  const newEvent = createCalendarEvent(newData, calendar, newStart, newEnd);

  // Update sheet row
  if (findResult.sheetRow) {
    try {
      const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss ? ss.getSheetByName('Appointments') : null;
      if (sheet) {
        sheet.getRange(findResult.sheetRow, 6).setValue(data.newDate);  // Update date
        sheet.getRange(findResult.sheetRow, 9).setValue(newEvent.getId()); // Update event ID
        sheet.getRange(findResult.sheetRow, 8).setValue('RESCHEDULED');
      }
    } catch (e) { /* non-fatal */ }

    // Add a new row for the rescheduled appointment
    try {
      const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss ? ss.getSheetByName('Appointments') : null;
      if (sheet) {
        sheet.appendRow([
          new Date(), newData.name, newData.phone, newData.email || '',
          newData.service, data.newDate, newData.message, newData.source, newEvent.getId()
        ]);
      }
    } catch (e) { /* non-fatal */ }
  }

  const formattedNewDate = Utilities.formatDate(newStart, CONFIG.TIMEZONE, 'EEEE, MMMM d yyyy \'at\' h:mm a');
  return {
    status:  'rescheduled',
    message: 'Your appointment has been rescheduled! ' + newData.name +
             ' is now booked for ' + newData.service + ' on ' + formattedNewDate +
             '. See you then at ' + CONFIG.CLINIC_ADDRESS + '!'
  };
}


// ============================================================
//  META (FACEBOOK/INSTAGRAM) MESSAGE HANDLING
// ============================================================

/**
 * Handle incoming webhooks from Meta (Facebook/Instagram).
 */
function handleMetaMessage(postData) {
  try {
    const isInstagram = postData.object === 'instagram';
    const source = isInstagram ? 'Instagram' : 'Facebook';

    // 1. Log everything immediately for debugging
    logToSheet('Incoming (' + source + ')', JSON.stringify(postData));

    const entry = postData && postData.entry && postData.entry[0];
    const messaging = entry && entry.messaging && entry.messaging[0];
    const changes = entry && entry.changes && entry.changes[0] && entry.changes[0].value;
    
    // Support both Facebook 'messaging' and generic Graph API 'changes' formats
    const messageObj = messaging || changes;

    if (!messageObj) {
      // Could be a read receipt, delivery, or unsupported event format
      return jsonResponse('success', 'Ignored non-message or unrecognized event.');
    }

    // Ignore messages sent by the AI/page itself (echoes)
    if (messageObj.message && messageObj.message.is_echo) {
      return jsonResponse('success', 'Ignored echo message.');
    }

    let senderId;
    let userText;

    if (messageObj.message && messageObj.message.text) {
      senderId = messageObj.sender.id;
      userText = messageObj.message.text;
    } else if (messageObj.postback) {
      senderId = messageObj.sender.id;
      // Extract button text or technical payload string
      userText = messageObj.postback.title || messageObj.postback.payload || 'Action Clicked';
    } else {
      return jsonResponse('success', 'Ignored non-text Meta event.');
    }

    console.log('Received ' + source + ' message from ' + senderId + ': ' + userText);

    // 2. Call AI (Gemini handles the text conversation)
    const aiResponse = callGeminiAI(userText, senderId, source);
    logToSheet('AI Response', aiResponse);

    // 3. Send response back to patient
    sendMetaResponse(senderId, aiResponse, isInstagram);

    return jsonResponse('success', 'Message processed.');
  } catch (e) {
    console.error('handleMetaMessage error: ' + e);
    logToSheet('Error', e.toString());
    return jsonResponse('error', e.toString());
  }
}

/**
 * Helper to log debugging info to a 'Logs' sheet in the spreadsheet.
 */
function logToSheet(type, message) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Logs');
      sheet.appendRow(['Timestamp', 'Type', 'Message']);
    }
    sheet.appendRow([new Date(), type, message]);
  } catch (e) {
    console.warn('Logging failed: ' + e);
  }
}

/**
 * Send a message back to the patient via Meta Graph API.
 */
function sendMetaResponse(recipientId, text, isInstagram) {
  let token = CONFIG.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.warn('FB_PAGE_ACCESS_TOKEN not set. Response not sent.');
    return;
  }
  
  // Clean token: Remove invisible spaces, newlines, or accidental quotes from copy-pasting
  token = token.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');

  const url = 'https://graph.facebook.com/v19.0/me/messages?access_token=' + token;
  const payload = {
    recipient: { id: recipientId },
    message: { text: text },
    messaging_type: 'RESPONSE' // Required for Instagram automation
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Capture response for better logging
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const body = response.getContentText();
    
    if (code !== 200) {
      console.error('Meta API Error (' + (isInstagram ? 'Instagram' : 'Facebook') + '): ' + body);
      logToSheet('Meta Error', body);
    } else {
      console.log('Successfully sent response to ' + recipientId);
      logToSheet('Meta Success', 'Message sent to ' + recipientId);
    }
  } catch (e) {
    console.error('sendMetaResponse Exception: ' + e);
  }
}

/**
 * Communication with Gemini AI (The "Brain" for FB/IG DMs).
 * Handles System Prompt, Function Calling (Tools), and Conversation History.
 */
function callGeminiAI(userText, userId, source) {
  const apiKey = CONFIG.GEMINI_API_KEY;
  if (!apiKey) {
    return "I'm sorry, I am the assistant for " + CONFIG.CLINIC_NAME + ". We're finishing a quick system update for DMs. Please reach us at " + CONFIG.CLINIC_PHONE + " for any urgent bookings!";
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  
  // 1. Get Conversation History from Cache
  const cache = CacheService.getScriptCache();
  let historyJson = cache.get("history_" + userId);
  let history = historyJson ? JSON.parse(historyJson) : [];

  // 2. Define Tools for Gemini (Match the existing GAS functions)
  const tools = [{
    functionDeclarations: [
      {
        name: "check_availability",
        description: "Checks for available dental appointment slots on a specific date.",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "The date to check (YYYY-MM-DD)." }
          },
          required: ["date"]
        }
      },
      {
        name: "create_booking",
        description: "Creates a new dental appointment booking.",
        parameters: {
          type: "OBJECT",
          properties: {
            name:    { type: "STRING", description: "Patient's full name" },
            phone:   { type: "STRING", description: "Patient's phone number" },
            email:   { type: "STRING", description: "Patient's email address" },
            service: { type: "STRING", description: "The dental service requested" },
            date:    { type: "STRING", description: "The appointment date and time (ISO format)" }
          },
          required: ["name", "phone", "email", "service", "date"]
        }
      },
      {
        name: "submit_inquiry",
        description: "Submits a general inquiry, message, or callback request from a patient when they have a complex question or request that the AI cannot answer directly.",
        parameters: {
          type: "OBJECT",
          properties: {
            name:    { type: "STRING", description: "Patient's full name" },
            phone:   { type: "STRING", description: "Patient's phone number with country code" },
            email:   { type: "STRING", description: "Patient's email address (optional)" },
            inquiry: { type: "STRING", description: "The details of their inquiry, question, or message" }
          },
          required: ["name", "phone", "inquiry"]
        }
      },
      {
        name: "appointment_enquiry",
        description: "Retrieves the list of upcoming appointments booked under a patient's name and/or phone number.",
        parameters: {
          type: "OBJECT",
          properties: {
            name:    { type: "STRING", description: "Patient's full name (optional if phone is provided)" },
            phone:   { type: "STRING", description: "Patient's phone number (optional if name is provided)" }
          }
        }
      }
    ]
  }];

  // 3. Prepare Payload
  const systemInstruction = {
    parts: [{ text: getAISystemPrompt() }]
  };

  const payload = {
    system_instruction: systemInstruction,
    contents: history.concat([{ role: "user", parts: [{ text: userText }] }]),
    tools: tools
  };

  // 4. Call Gemini (Recursive loop for function calls)
  try {
    let response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const status = response.getResponseCode();
    const body = response.getContentText();
    
    if (status !== 200) {
      logToSheet('Gemini API Error', 'Status ' + status + ': ' + body);
      return "I'm sorry, I'm having a brief connection issue with my AI brain. Please try again or call the clinic!";
    }

    let json = JSON.parse(body);
    if (!json.candidates || !json.candidates[0]) {
      logToSheet('Gemini No Candidate', body);
      return "I'm sorry, I couldn't process that. Could you rephrase it?";
    }
    
    let candidate = json.candidates[0];
    let part = candidate.content.parts[0];

    // Handle Function Call if Gemini requests it
    if (part.functionCall) {
      const call = part.functionCall;
      console.log("Gemini requested tool: " + call.name);
      
      let toolResult;
      if (call.name === "check_availability") {
        toolResult = handleCheckAvailability(call.args);
      } else if (call.name === "create_booking") {
        let bookingData = call.args;
        bookingData.source = source + " DM";
        toolResult = handleBooking(bookingData);
      } else if (call.name === "submit_inquiry") {
        let inquiryData = call.args;
        inquiryData.source = source + " DM";
        toolResult = handleInquiry(inquiryData);
      } else if (call.name === "appointment_enquiry") {
        toolResult = handleAppointmentEnquiry(call.args);
      }

      // Feed tool result back to Gemini for final text
      const secondPayload = {
        system_instruction: systemInstruction,
        contents: payload.contents.concat([
          candidate.content,
          {
            role: "function",
            parts: [{
              functionResponse: {
                name: call.name,
                response: { name: call.name, content: toolResult }
              }
            }]
          }
        ]),
        tools: tools
      };

      response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(secondPayload)
      });
      json = JSON.parse(response.getContentText());
      part = json.candidates[0].content.parts[0];
    }

    // Update history in cache (last 10 messages)
    history.push({ role: "user", parts: [{ text: userText }] });
    history.push({ role: "model", parts: [{ text: part.text }] });
    if (history.length > 10) history = history.slice(-10);
    cache.put("history_" + userId, JSON.stringify(history), 3600); // 1 hour expiry

    return part.text;

  } catch (e) {
    console.error("Gemini AI bridge error: " + e);
    logToSheet('AI Function Error', e.toString());
    return "I'm having a little trouble with my connection, but I'm here! How can I help you today?";
  }
}

// ============================================================
//  HELPER: Find an existing calendar event for a patient
// ============================================================
function findExistingEvent(data, calendar) {
  let eventId  = null;
  let sheetRow = null;
  let name     = data.name  || '';
  let phone    = data.phone || '';
  let email    = data.email || '';
  let service  = data.service || '';

  // Search sheet first
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss ? ss.getSheetByName('Appointments') : null;

    if (sheet && sheet.getLastRow() > 1) {
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        // Skip already cancelled rows
        if (String(rows[i][7]).includes('CANCEL')) continue;

        const rowPhone = String(rows[i][2]).replace(/\s/g, '');
        const rowName  = String(rows[i][1]).toLowerCase();
        const rowDate  = String(rows[i][5]).substring(0, 10);
        const inPhone  = phone ? phone.replace(/\s/g, '') : '';
        const inName   = name.toLowerCase();
        const inDate   = data.date ? data.date.substring(0, 10) : '';

        const phoneMatch = inPhone && rowPhone.includes(inPhone.replace('+', ''));
        const nameMatch  = inName  && rowName.includes(inName);
        const dateMatch  = !inDate || rowDate === inDate;

        if (phoneMatch || (nameMatch && dateMatch)) {
          eventId  = rows[i][8];
          sheetRow = i + 1;
          name     = rows[i][1];
          phone    = rows[i][2];
          email    = rows[i][3];
          service  = rows[i][4];
          break;
        }
      }
    }
  } catch (e) {
    console.warn('Sheet search failed: ' + e);
  }

  // Fallback: search calendar
  if (!eventId) {
    const searchStart = data.date
      ? new Date(data.date)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const searchEnd = new Date(searchStart.getTime() + 14 * 24 * 60 * 60 * 1000);
    const events = calendar.getEvents(searchStart, searchEnd);

    for (const ev of events) {
      const title = ev.getTitle().toLowerCase();
      const desc  = ev.getDescription().toLowerCase();
      const inName  = name.toLowerCase();
      const inPhone = phone.replace(/\s/g, '');

      if ((inName && title.includes(inName)) ||
          (inPhone && desc.includes(inPhone.replace('+', '')))) {
        eventId = ev.getId();
        break;
      }
    }
  }

  return { found: !!eventId, eventId, sheetRow, name, phone, email, service };
}


// ============================================================
//  CREATE CALENDAR EVENT
// ============================================================
function createCalendarEvent(data, calendar, startTime, endTime) {
  const options = {
    description:
      'Service: '  + data.service + '\n' +
      'Phone: '    + data.phone   + '\n' +
      'Email: '    + (data.email   || 'N/A') + '\n' +
      'Message: '  + (data.message || 'None') + '\n' +
      'Source: '   + (data.source  || 'Website') + '\n' +
      '─────────────────────────────\n' +
      'Booked via ' + CONFIG.CLINIC_NAME + ' AI System'
  };

  // Enable automatic email invitations/notifications if email is present
  if (data.email && data.email.includes('@')) {
    options.guests = data.email;
    options.sendInvites = true;
  }

  return calendar.createEvent(data.name, startTime, endTime, options);
}


// ============================================================
//  ACTION: SAVE LEAD
// ============================================================
function handleLead(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (ss) {
      let sheet = ss.getSheetByName('Leads');
      if (!sheet) sheet = ss.insertSheet('Leads');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Source']);
      }
      sheet.appendRow([new Date(), data.name, data.phone, data.source || 'Website']);
    }
  } catch (e) {
    console.warn('Lead save failed: ' + e);
  }
  return { message: 'Lead saved' };
}


// ============================================================
//  ACTION: SUBMIT ORDER
// ============================================================
function handleOrder(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (ss) {
      let sheet = ss.getSheetByName('Orders');
      if (!sheet) sheet = ss.insertSheet('Orders');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Cart', 'Total']);
      }
      sheet.appendRow([new Date(), data.name, data.phone, JSON.stringify(data.cart), data.total]);
    }
  } catch (e) {
    console.warn('Order save failed: ' + e);
  }
  return { message: 'Order recorded' };
}


// ============================================================
//  ACTION: SAVE INQUIRY
//  Called by: ElevenLabs (POST) or Gemini AI (Internal)
//  Required: name, phone, inquiry
//  Optional: email, source
// ============================================================
function handleInquiry(data) {
  if (!data.name)    throw new Error('Patient name is required.');
  if (!data.phone)   throw new Error('Phone number is required.');
  
  const inquiryText = data.inquiry || data.message || '';
  if (!inquiryText)  throw new Error('Inquiry details or message are required.');

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (ss) {
      let sheet = ss.getSheetByName('Inquiries');
      if (!sheet) {
        sheet = ss.insertSheet('Inquiries');
        sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Email', 'Inquiry', 'Source']);
        sheet.setFrozenRows(1);
      }
      sheet.appendRow([
        new Date(),
        data.name,
        data.phone,
        data.email    || '',
        inquiryText,
        data.source   || 'AI Agent'
      ]);
    }
  } catch (e) {
    console.warn('Inquiry save failed: ' + e);
    throw new Error('Could not save inquiry: ' + e.toString());
  }

  return {
    status: 'success',
    message: 'Inquiry saved successfully'
  };
}


// ============================================================
//  ACTION: APPOINTMENT ENQUIRY
//  Called by: ElevenLabs (POST) or Gemini AI (Internal)
//  Required: phone OR name
//  Returns: List of upcoming appointments for the user
// ============================================================
function handleAppointmentEnquiry(data) {
  const name = data.name || '';
  const phone = data.phone || data.phone_number || '';

  if (!phone && !name) {
    throw new Error('Please provide your phone number or name to look up appointments.');
  }

  const matches = [];
  const now = new Date();
  const phoneSearch = phone ? String(phone).replace(/\s/g, '').replace('+', '') : '';
  const nameSearch = name ? String(name).toLowerCase().trim() : '';

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss ? ss.getSheetByName('Appointments') : null;

    if (sheet && sheet.getLastRow() > 1) {
      const rows = sheet.getDataRange().getValues();
      // Headers: [Timestamp, Name, Phone, Email, Service, Date, Message, Source, Event ID]
      for (let i = 1; i < rows.length; i++) {
        const rowName = String(rows[i][1]).toLowerCase().trim();
        const rowPhone = String(rows[i][2]).replace(/\s/g, '').replace('+', '');
        const rowService = rows[i][4];
        const rowDateStr = rows[i][5];
        const rowStatus = String(rows[i][7]); // e.g. CANCELLED or RESCHEDULED

        // Skip cancelled appointments
        if (rowStatus.includes('CANCEL')) continue;

        const apptDate = new Date(rowDateStr);
        if (isNaN(apptDate.getTime())) continue;

        // Skip past appointments (only check future / upcoming ones)
        if (apptDate < now) continue;

        let isMatch = false;
        if (phoneSearch && rowPhone.includes(phoneSearch)) {
          isMatch = true;
        } else if (nameSearch && rowName.includes(nameSearch)) {
          isMatch = true;
        }

        if (isMatch) {
          const formattedDate = Utilities.formatDate(apptDate, CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
          matches.push({
            service: rowService,
            date: formattedDate,
            rawDate: rowDateStr,
            name: rows[i][1]
          });
        }
      }
    }
  } catch (e) {
    console.warn('Appointment enquiry database lookup failed: ' + e);
  }

  // Fallback / Additional Check: If no matches found in sheet, or to be extra thorough,
  // we can also scan the Google Calendar directly for the next 60 days
  if (matches.length === 0) {
    try {
      const calendar = CalendarApp.getCalendarById(CONFIG.DOCTOR_CALENDAR_ID);
      if (calendar) {
        const startSearch = new Date();
        const endSearch = new Date(startSearch.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
        const events = calendar.getEvents(startSearch, endSearch);
        for (const ev of events) {
          const title = ev.getTitle().toLowerCase();
          const desc = ev.getDescription().toLowerCase();
          
          let isMatch = false;
          if (nameSearch && title.includes(nameSearch)) {
            isMatch = true;
          } else if (phoneSearch && desc.replace(/\s/g, '').includes(phoneSearch)) {
            isMatch = true;
          }

          if (isMatch) {
            const apptDate = ev.getStartTime();
            const formattedDate = Utilities.formatDate(apptDate, CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
            
            const isDuplicate = matches.some(m => new Date(m.rawDate).getTime() === apptDate.getTime());
            if (!isDuplicate) {
              matches.push({
                service: ev.getTitle(),
                date: formattedDate,
                rawDate: apptDate.toISOString(),
                name: ev.getTitle()
              });
            }
          }
        }
      }
    } catch (calErr) {
      console.warn('Calendar fallback search failed: ' + calErr);
    }
  }

  if (matches.length === 0) {
    return {
      status: 'not_found',
      message: 'No upcoming appointments found matching those details.'
    };
  }

  const apptList = matches.map(m => `- ${m.service} on ${m.date}`).join('\n');
  return {
    status: 'success',
    count: matches.length,
    appointments: matches,
    message: 'Found the following upcoming appointment(s):\n' + apptList
  };
}


/**
 * Returns the full system prompt for the AI Assistant.
 * (Sync this with AGENT_SYSTEM_PROMPT.md)
 */
function getAISystemPrompt() {
  const todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "EEEE, MMMM d, yyyy");
  return `You are the friendly and professional AI assistant for Pinnacle Dental Centre, a premium dental clinic located at Sarit Centre, 2nd Floor, Westlands, Nairobi, Kenya. We provide a unique blend of clinical excellence and luxury hospitality.

*** IMPORTANT CONTEXT: TODAY'S DATE IS ${todayStr} ***

Your role is to assist patients via Facebook and Instagram DMs by answering questions, providing clinic information, and helping them book, reschedule, or cancel dental appointments.

Rules:
1. Warm, professional, and concise. Use simple, clear language.
2. Show empathy — patients may be anxious about dental visits.
3. Never provide medical diagnoses or treatment advice. Always recommend consulting a dentist in person for specific concerns.
4. When a patient asks about availability or wants to book, use the check_availability tool first.
5. To book, collect: Full Name, Phone, Service, Date/Time, and Email address (mandatory for reminders).
6. Confirm all details before calling create_booking.
7. If a patient sends inappropriate content, politely steer them back: "I'm only able to help with dental care inquiries and appointments. How can I assist you with your dental needs?"
8. **Multilingual Support**: Always detect and respond in the same language the patient is using (e.g., if they speak Swahili, respond in Swahili).

Clinic Milestones & Trust:
- 10+ Years of Experience in clinical excellence.
- 5+ Highly Qualified Specialists.
- 7000+ Happy Patients.
- Core Values: Professionalism, Teamwork, Integrity, Compassion, Excellence, Respect.

Our Doctors:
- Dr. Jane Nzuve (Lead Surgeon - Orthodontics and Implantology)
- Dr. Tanya Shah (General Dentist)
- Dr. Lavina Kinya (General Dentist)

Clinic Information:
- Phone: +254 706 076 636
- Email: pinnacledentalcentre@gmail.com
- Official Website: https://pinnacledentalcentre.health
- Dental Shop: https://pinnacledentalcentre.health/shop.html (For premium oral care products like Bitvae Water Flossers and Electric Toothbrushes)
- Hours: Mon-Sat 8:00 AM – 5:00 PM (Sunday 9:00 AM – 5:00 PM).
- Services: Clear Aligners, Root Canal Treatment, Dentures & Implants, Crowns & Bridges, Veneers, Cosmetic Dentistry, Dental Check-ups, Teeth Whitening, Braces, Tooth Extraction, Paediatric Dentistry, Dental Fillings, Dental X-rays.

Insurance Supported:
We work with a wide range of insurance providers including AAR, Bupa, Heritage, AXA, Alliance, Fidelity, MUA, CIC, Old Mutual, UAP, and others. For specific coverage queries, our team can confirm details during the initial visit.`;
}

function testBookingIntegration() {
  const tomorrow = new Date(new Date().getTime() + 25 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  const mockData = {
    name:    'Test Patient',
    phone:   '+254700000001',
    email:   'test@example.com',
    service: 'Dental Check-ups',
    date:    tomorrow.toISOString(),
    message: 'Test booking from GAS test function.',
    source:  'Test'
  };
  try {
    const result = handleBooking(mockData);
    Logger.log('✅ createBooking: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('❌ createBooking FAILED: ' + e.toString());
  }
}

function testCheckAvailability() {
  const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
  const dateStr  = Utilities.formatDate(tomorrow, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  try {
    const result = handleCheckAvailability({ date: dateStr });
    Logger.log('✅ checkAvailability: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('❌ checkAvailability FAILED: ' + e.toString());
  }
}

function testCancelBooking() {
  // Run testBookingIntegration() first to create a test event, then run this.
  const tomorrow = new Date(new Date().getTime() + 25 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  try {
    const result = handleCancelBooking({
      name:  'Test Patient',
      phone: '+254700000001',
      date:  tomorrow.toISOString().substring(0, 10)
    });
    Logger.log('✅ cancelBooking: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('❌ cancelBooking FAILED: ' + e.toString());
  }
}

function testContentGuard() {
  const flagged   = moderateContent('Send me nude photos');
  const notFlagged = moderateContent('I want to book a dental check-up');
  Logger.log('✅ Content guard (should be flagged): '     + JSON.stringify(flagged));
  Logger.log('✅ Content guard (should be clean): ' + JSON.stringify(notFlagged));
}

function testReschedule() {
  const dayAfter = new Date(new Date().getTime() + 49 * 60 * 60 * 1000);
  dayAfter.setMinutes(0, 0, 0);
  try {
    const result = handleRescheduleBooking({
      name:    'Test Patient',
      phone:   '+254700000001',
      newDate: dayAfter.toISOString()
    });
    Logger.log('✅ rescheduleBooking: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('❌ rescheduleBooking FAILED: ' + e.toString());
  }
}

/** 
 * TEST CALENDAR NOTIFICATIONS
 * Instructions:
 * 1. Replace the email below with your own email.
 * 2. Run this function and check for an invitation email + push notification.
 */
function testBookingNotification() {
  // Set test for 10 minutes from now to trigger the 'Upcoming Event' notification
  const soon = new Date(new Date().getTime() + 10 * 60 * 1000);
  
  const calendar = CalendarApp.getCalendarById(CONFIG.DOCTOR_CALENDAR_ID);
  if (!calendar) {
    Logger.log('❌ Error: Calendar not found. Check DOCTOR_CALENDAR_ID.');
    return;
  }

  const testData = {
    name: 'Test Push Patient',
    phone: '+254700000000',
    email: 'YOUR_EMAIL@example.com', // <--- YOUR EMAIL MUST BE HERE
    service: 'Test - Near-Immediate Push',
    date: soon.toISOString(),
    message: 'Testing immediate push notifications.',
    source: 'Manual Test'
  };

  try {
    const event = createCalendarEvent(testData, calendar, soon, new Date(soon.getTime() + 15 * 60 * 1000));
    Logger.log('✅ Success! Test event created for: ' + soon.toLocaleString());
    Logger.log('Check your phone — since the event is in 10 mins, you should see an "Upcoming Event" notification soon.');
  } catch (e) {
    Logger.log('❌ Failed to create test event: ' + e.toString());
  }
}

/**
 * FORCE AUTHORIZATION DIALOG
 * (Run this if you get "Permission Denied" errors)
 */
function forceAuth() {
  try {
    const code = UrlFetchApp.fetch("https://www.google.com").getResponseCode();
    Logger.log("External Request Test: Success (Code " + code + ")");
    Browser.msgBox("Success! Permissions for external requests are now granted.");
  } catch (e) {
    Logger.log("Error during auth check: " + e);
    throw e;
  }
}


// ============================================================
//  ELEVENLABS ANALYTICS DASHBOARD
//  Actions: getAnalytics | getTranscripts
//  Called from: admin_dashboard.html (GitHub Pages) via JSONP
//  Security: DASHBOARD_PASSWORD checked on every request
// ============================================================

const DASHBOARD_PASSWORD = PropertiesService.getScriptProperties().getProperty('DASHBOARD_PASSWORD') || 'pinnacle2024admin';

/**
 * Resolves the Agent ID based on the submitted dashboard password.
 * Returns the Agent ID if valid, or null if invalid.
 */
function resolveAgentId(submittedPassword) {
  if (!submittedPassword) return null;

  // 1. Check default dashboard password
  if (submittedPassword === DASHBOARD_PASSWORD) {
    return CONFIG.ELEVENLABS_AGENT_ID;
  }

  // 2. Check individual client mappings
  // Adds support for adding property keys like: "AGENT_mypassword", Value: "agent_xxx"
  const mappedAgent = PropertiesService.getScriptProperties().getProperty('AGENT_' + submittedPassword);
  if (mappedAgent) {
    return mappedAgent;
  }

  return null;
}

/**
 * Verify dashboard password from request params.
 * Returns true if valid, false otherwise.
 */
function verifyDashboardPassword(params) {
  const submitted = params.password || params.pwd || '';
  return resolveAgentId(submitted) !== null;
}

/**
 * Fetch all conversations for the agent from ElevenLabs API.
 * Paginates automatically. Filters by optional date range.
 *
 * @param {string} startDateStr - ISO date string or null
 * @param {string} endDateStr   - ISO date string or null
 * @returns {Array} conversations list
 */
function fetchElevenLabsConversations(startDateStr, endDateStr, clientAgentId) {
  const apiKey   = CONFIG.ELEVENLABS_API_KEY;
  const agentId  = clientAgentId || CONFIG.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) throw new Error('ElevenLabs API key or Agent ID not configured.');

  // Parse dates as Nairobi time (UTC+3) to ensure "Today" filter captures early/late calls
  const startMs = startDateStr ? new Date(startDateStr + 'T00:00:00+03:00').getTime() : null;
  const endMs   = endDateStr   ? new Date(endDateStr + 'T23:59:59+03:00').getTime() : null;

  const conversations = [];
  let   cursor        = null;
  let   page          = 0;
  const MAX_PAGES     = 10; // cap at 1,000 conversations to avoid timeout and rate limits

  do {
    let url = 'https://api.elevenlabs.io/v1/convai/conversations?agent_id=' + agentId + '&page_size=100';
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor);

    // Retry once on 429 with a short back-off
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
        muteHttpExceptions: true
      });
      if (response.getResponseCode() !== 429) break;
      Logger.log('429 on conversation list page ' + page + ', attempt ' + (attempt + 1) + ' — waiting 2s');
      Utilities.sleep(2000);
    }

    const code = response.getResponseCode();
    if (code !== 200) {
      const errMsg = 'ElevenLabs API error ' + code + ': ' + response.getContentText().substring(0, 200);
      throw new Error(errMsg);
    }

    const json = JSON.parse(response.getContentText());
    const items = json.conversations || json.items || [];

    for (const conv of items) {
      let convMs = null;
      if (conv.start_time_unix_secs) {
        convMs = conv.start_time_unix_secs * 1000;
      } else if (conv.start_time) {
        convMs = (typeof conv.start_time === 'number')
          ? conv.start_time * 1000
          : new Date(conv.start_time).getTime();
      } else if (conv.created_at) {
        convMs = new Date(conv.created_at).getTime();
      }

      if (endMs   && convMs && convMs > endMs)   continue;
      if (startMs && convMs && convMs < startMs) continue;

      conversations.push(conv);
    }

    cursor = json.next_cursor || json.cursor || null;
    page++;
  } while (cursor && page < MAX_PAGES);

  return conversations;
}

/**
 * Fetch full details (including transcript) for a single conversation.
 *
 * @param {string} conversationId
 * @returns {Object} conversation detail object
 */
function fetchConversationDetail(conversationId) {
  const apiKey = CONFIG.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ElevenLabs API key not configured.');

  const url = 'https://api.elevenlabs.io/v1/convai/conversations/' + conversationId;
  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { 'xi-api-key': apiKey },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code !== 200) throw new Error('ElevenLabs API error ' + code + ': ' + response.getContentText().substring(0, 200));

  return JSON.parse(response.getContentText());
}

/**
 * Efficiently fetches full details (including transcripts) for an array of conversations.
 * Uses UrlFetchApp.fetchAll to execute requests in parallel.
 * Adds a delay between batches to avoid hitting ElevenLabs rate limits (429).
 *
 * @param {Array} conversations - List of basic conversation objects
 * @param {string} apiKey - ElevenLabs API key
 * @returns {Array} List of detailed conversation objects
 */
function fetchConversationsDetailsParallel(conversations, apiKey) {
  if (!conversations || conversations.length === 0) return [];
  const detailed = [];
  const batchSize = 20; // smaller batch = fewer simultaneous requests = less 429 risk
  const BATCH_DELAY_MS = 1500; // wait 1.5s between batches to respect rate limits
  const fetchStartTime = Date.now();

  for (let b = 0; b < conversations.length; b += batchSize) {
    // Safety stop at 4 minutes to stay well within GAS 6-minute limit
    if (Date.now() - fetchStartTime > 240000) {
      Logger.log('Time limit reached: stopping detail fetch at item ' + b);
      break;
    }

    // Pause between batches (skip before the first batch)
    if (b > 0) Utilities.sleep(BATCH_DELAY_MS);

    const chunk = conversations.slice(b, b + batchSize);
    const requests = chunk.map(function(conv) {
      const cid = conv.conversation_id || conv.id;
      return {
        url: 'https://api.elevenlabs.io/v1/convai/conversations/' + cid,
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
        muteHttpExceptions: true
      };
    });

    try {
      const responses = UrlFetchApp.fetchAll(requests);
      for (let i = 0; i < responses.length; i++) {
        const code = responses[i].getResponseCode();
        if (code === 200) {
          // Merge detail ON TOP of the original list item.
          // The detail endpoint does NOT include list-level fields like
          // start_time_unix_secs, which are essential for date aggregation.
          const detailObj = JSON.parse(responses[i].getContentText());
          const merged = Object.assign({}, chunk[i], detailObj);
          // Restore the list-level timestamp if the detail overrides it with null
          if (!merged.start_time_unix_secs && chunk[i].start_time_unix_secs) {
            merged.start_time_unix_secs = chunk[i].start_time_unix_secs;
          }
          detailed.push(merged);
        } else if (code === 429) {
          // Rate limited — fall back to basic item and log
          Logger.log('429 on detail fetch for item ' + (b + i) + ' — using basic item');
          detailed.push(chunk[i]);
        } else {
          // Other error — fall back to basic item
          detailed.push(chunk[i]);
        }
      }
    } catch(e) {
      Logger.log('Parallel fetch failed for chunk starting at ' + b + ': ' + e.toString());
      detailed.push(...chunk);
    }
  }
  return detailed;
}

/**
 * Detect the primary language in a transcript.
 * Uses heuristic keyword matching + ElevenLabs metadata if available.
 *
 * @param {Object} conv - conversation object (may have transcript array)
 * @returns {string} language label eg "English", "Swahili", "French"
 */
function detectLanguage(conv) {
  // Check metadata first
  if (conv.metadata && conv.metadata.language) return conv.metadata.language;
  if (conv.language) return conv.language;

  // Check transcript messages for language hints
  const transcript = conv.transcript || [];
  const allText = transcript.map(function(t) { return t.message || t.text || ''; }).join(' ').toLowerCase();

  // Swahili keywords
  if (/\b(habari|karibu|ndiyo|asante|tafadhali|samahani|nashindwa|msaada|kliniki)\b/.test(allText)) return 'Swahili';
  // French keywords
  if (/\b(bonjour|merci|oui|non|comment|rendez-vous|dentiste|clinique)\b/.test(allText)) return 'French';
  // Arabic (simplified)
  if (/[\u0600-\u06FF]/.test(allText)) return 'Arabic';

  return 'English'; // Default
}

/**
 * Extract the likely service enquired from a conversation transcript.
 * Matches against the clinic's known services list.
 *
 * @param {Object} conv - conversation object
 * @returns {Array} list of matched services
 */
function extractServices(conv) {
  const transcript = conv.transcript || [];
  const allText = transcript.map(function(t) { return t.message || t.text || ''; }).join(' ').toLowerCase();

  const matches = [];
  const serviceMap = {
    'clear aligner': 'Clear Aligners',
    'root canal': 'Root Canal Treatment',
    'denture': 'Dentures & Implants',
    'implant': 'Dentures & Implants',
    'crown': 'Crowns & Bridges',
    'bridge': 'Crowns & Bridges',
    'veneer': 'Veneers',
    'cosmetic': 'Cosmetic Dentistry',
    'check-up': 'Dental Check-ups',
    'checkup': 'Dental Check-ups',
    'check up': 'Dental Check-ups',
    'whitening': 'Teeth Whitening',
    'brace': 'Braces',
    'extraction': 'Tooth Extraction',
    'paediatric': 'Paediatric Dentistry',
    'pediatric': 'Paediatric Dentistry',
    'children': 'Paediatric Dentistry',
    'filling': 'Dental Fillings',
    'x-ray': 'Dental X-rays',
    'xray': 'Dental X-rays',
    'x ray': 'Dental X-rays'
  };

  for (const keyword in serviceMap) {
    if (allText.indexOf(keyword) !== -1) {
      const svc = serviceMap[keyword];
      if (matches.indexOf(svc) === -1) matches.push(svc);
    }
  }

  return matches.length > 0 ? matches : ['General Enquiry'];
}

/**
 * Detect if a conversation resulted in a booking.
 * Looks for booking-related keywords in the transcript.
 *
 * @param {Object} conv
 * @returns {boolean}
 */
function isBooking(conv) {
  // Check the newer analysis obj first
  if (conv.analysis && conv.analysis.data_collection_results) {
     const res = JSON.stringify(conv.analysis.data_collection_results).toLowerCase();
     if (res.includes("scheduled") || res.includes("booked")) return true;
  }
  const transcript = conv.transcript || [];
  const allText = transcript.map(function(t) { return t.message || t.text || ''; }).join(' ').toLowerCase();
  return /\b(booked|booking confirmed|appointment confirmed|scheduled|see you on)\b/.test(allText);
}

/**
 * Extract customer phone country origin prefix.
 * WhatsApp phone numbers are in the conversation metadata.
 *
 * @param {Object} conv
 * @returns {string} e.g. "+254", "+250", "+44", "Unknown"
 */
function extractOrigin(conv) {
  // Check ElevenLabs 'call_metadata' or 'metadata' or top-level 'caller_id'
  const meta = conv.call_metadata || conv.metadata || {};
  const phone = meta.phone || meta.caller_id || meta.from_phone_number || meta.from ||
                conv.caller_id || conv.from || '';
  if (!phone) return 'Unknown';

  const clean = String(phone).replace(/\s/g, '').replace(/^0/, '+254'); // Assume Kenya if local
  if (!clean.startsWith('+')) return 'Unknown';

  const prefixes = ['+254', '+250', '+255', '+256', '+257', '+258', '+249', '+252',
                    '+44', '+1', '+33', '+49', '+971', '+966', '+91', '+86'];
  for (const p of prefixes) {
    if (clean.startsWith(p)) return p;
  }
  const match = clean.match(/^(\+\d{1,3})/);
  return match ? match[1] : 'Unknown';
}

/**
 * Master aggregation function.
 * Takes array of conversations (with transcript if available) and computes all analytics.
 *
 * @param {Array} conversations
 * @returns {Object} aggregated analytics
 */
function aggregateAnalytics(conversations) {
  const total = conversations.length;

  // Counters
  const servicesCounts  = {};
  const languageCounts  = {};
  const originCounts    = {};
  const hourCounts      = {};
  let   totalBookings   = 0;
  let   totalDuration   = 0;  // seconds
  let   totalCost       = 0;  // in credits/dollars
  let   totalLLMCredits = 0;
  let   flaggedCount    = 0;
  const dailyCounts     = {};

  for (const conv of conversations) {
    // -- Duration --
    let dur = parseFloat(conv.duration || conv.conversation_duration_secs || conv.duration_secs || conv.call_duration_secs || conv.call_duration_seconds || conv.conversation_duration_seconds || 0);
    const meta = conv.call_metadata || conv.metadata || {};
    if (!dur && meta.duration) dur = parseFloat(meta.duration);
    if (!dur && meta.call_duration_secs) dur = parseFloat(meta.call_duration_secs);
    totalDuration += dur;

    // -- Cost / Credits --
    let cost = parseFloat(conv.cost || conv.voice_credits || conv.credits_used || 0);
    const costMeta = conv.call_metadata || conv.metadata || {};
    if (!cost && costMeta.call_cost) cost = parseFloat(costMeta.call_cost);
    if (!cost && costMeta.cost) cost = parseFloat(costMeta.cost);
    if (!cost && costMeta.credits_used) cost = parseFloat(costMeta.credits_used);
    totalCost += cost;

    let llm = parseFloat(conv.llm_cost || conv.llm_credits || 0);
    if (!llm && costMeta.llm_credits) llm = parseFloat(costMeta.llm_credits);
    if (!llm && costMeta.llm_cost) llm = parseFloat(costMeta.llm_cost);
    totalLLMCredits += llm;

    // -- Flagged --
    if (conv.status === 'flagged' || (conv.metadata && conv.metadata.flagged === true)) flaggedCount++;

    // -- Bookings --
    if (isBooking(conv)) totalBookings++;

    // -- Services --
    const services = extractServices(conv);
    for (const svc of services) {
      servicesCounts[svc] = (servicesCounts[svc] || 0) + 1;
    }

    // -- Language --
    const lang = detectLanguage(conv);
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;

    // -- Origin --
    const origin = extractOrigin(conv);
    originCounts[origin] = (originCounts[origin] || 0) + 1;

    // -- Call time (hour bucket) --
    let startTime = null;
    const ts = conv.start_time_unix_secs || conv.created_at_unix_timestamp || conv.start_time_unix_seconds || conv.created_at_unix_seconds;
    if (ts) {
      startTime = new Date(ts * 1000);
    } else if (conv.start_time) {
      startTime = (typeof conv.start_time === 'number') ? new Date(conv.start_time * 1000) : new Date(conv.start_time);
    } else if (conv.created_at) {
      startTime = (typeof conv.created_at === 'number') ? new Date(conv.created_at * 1000) : new Date(conv.created_at);
    }
    if (startTime) {
      // Adjust to Nairobi time (UTC+3)
      const nairobiHour = (startTime.getUTCHours() + 3) % 24;
      const hourLabel   = nairobiHour + ':00-' + (nairobiHour + 1) + ':00';
      hourCounts[hourLabel] = (hourCounts[hourLabel] || 0) + 1;

      // Daily counts for trend chart — compute date in Nairobi time (UTC+3) manually
      // Using Utilities.formatDate can silently fail; manual is safer.
      const nairobiMs   = startTime.getTime() + (3 * 60 * 60 * 1000);
      const nairobiDate = new Date(nairobiMs);
      const yy  = nairobiDate.getUTCFullYear();
      const mm  = String(nairobiDate.getUTCMonth() + 1).padStart(2, '0');
      const dd  = String(nairobiDate.getUTCDate()).padStart(2, '0');
      const dayKey = yy + '-' + mm + '-' + dd;
      dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
    }
  }

  // Convert raw counts to percentage objects
  function toPercent(counts, tot) {
    const result = [];
    for (const key in counts) {
      result.push({ label: key, count: counts[key], percent: tot > 0 ? Math.round((counts[key] / tot) * 100) : 0 });
    }
    return result.sort(function(a, b) { return b.count - a.count; });
  }

  const flaggedPercent = total > 0 ? Math.round((flaggedCount / total) * 100) : 0;
  const avgDuration    = total > 0 ? Math.round(totalDuration / total) : 0;

  // Diagnostic: log the dailyCounts to the GAS execution log
  Logger.log('dailyTrend keys: ' + JSON.stringify(Object.keys(dailyCounts).slice(0, 10)));
  Logger.log('dailyTrend sample: ' + JSON.stringify(dailyCounts));

  return {
    totalConversations: total,
    totalBookings:      totalBookings,
    avgDurationSecs:    avgDuration,
    totalCostCredits:   Math.round(totalCost * 100) / 100,
    totalLLMCredits:    Math.round(totalLLMCredits * 100) / 100,
    flaggedCount:       flaggedCount,
    flaggedPercent:     flaggedPercent,
    services:           toPercent(servicesCounts, total),
    languages:          toPercent(languageCounts, total),
    origins:            toPercent(originCounts, total),
    callTimeByHour:     toPercent(hourCounts, total),
    dailyTrend:         dailyCounts
  };
}

/**
 * Handle getAnalytics action from dashboard.
 * Returns aggregated analytics as JSONP.
 */
function handleGetAnalytics(params) {
  if (!verifyDashboardPassword(params)) {
    throw new Error('Unauthorized');
  }
  const targetAgentId = resolveAgentId(params.password || params.pwd);

  // Step 1: Fetch the list of conversations in the date range (capped at 10 pages / 1,000 items).
  const conversations = fetchElevenLabsConversations(params.startDate || null, params.endDate || null, targetAgentId);

  // Step 2: Fetch details for a small sample to enrich cost, booking, services etc.
  // Reduced to 30 (1 batch) to stay well within rate limits and time budgets.
  const sample = conversations.slice(0, 30);
  const detailedSample = fetchConversationsDetailsParallel(sample, CONFIG.ELEVENLABS_API_KEY);

  // Build a detail lookup by conversation ID
  const detailMap = {};
  for (const d of detailedSample) {
    const id = d.conversation_id || d.id;
    if (id) detailMap[id] = d;
  }

  // Step 3: Merge details into list items where available.
  const enrichedConversations = conversations.map(function(conv) {
    const id = conv.conversation_id || conv.id;
    const detail = detailMap[id];
    if (!detail) return conv;
    const merged = Object.assign({}, conv, detail);
    merged.start_time_unix_secs = conv.start_time_unix_secs || merged.start_time_unix_secs;
    return merged;
  });

  Logger.log('Analytics: total conversations=' + conversations.length + ', enriched=' + detailedSample.length);
  return aggregateAnalytics(enrichedConversations);
}

/**
 * Handle getTranscripts action from dashboard.
 * Returns conversations WITH full transcript details as JSONP.
 * Fetches detail for each conversation (may be slow for large sets — paginate on frontend).
 */
function handleGetTranscripts(params) {
  if (!verifyDashboardPassword(params)) {
    throw new Error('Unauthorized');
  }
  
  const targetAgentId = resolveAgentId(params.password || params.pwd);
  const conversations = fetchElevenLabsConversations(params.startDate || null, params.endDate || null, targetAgentId);
  // Limit to a reasonable number for high-density review (500)
  const limited = conversations.slice(0, 500);

  const detailed = fetchConversationsDetailsParallel(limited, CONFIG.ELEVENLABS_API_KEY);
  for (const detail of detailed) {
    detail._language = detectLanguage(detail);
    detail._services = extractServices(detail);
    detail._isBooking = isBooking(detail);
    detail._origin    = extractOrigin(detail);
  }

  return {
    conversations: detailed,
    total: conversations.length,
    returned: detailed.length
  };
}

/**
 * ============================================================
 *  ADMIN: STRUCTURED CONTENT & MEDIA MANAGEMENT
 * ============================================================
 */

/**
 * Handle admin content requests (GET style)
 * Returns all structured data from spreadsheet.
 */
function handleGetAdminContent(params) {
  if (!verifyDashboardPassword(params)) throw new Error('Unauthorized');
  
  return {
    services: fetchTableData('Services'),
    blog: fetchTableData('BlogPosts'),
    comparisons: fetchTableData('Comparisons'),
    products: fetchTableData('Products'),
    media: fetchTableData('MediaLibrary')
  };
}

/**
 * Handle admin content updates (POST style)
 */
function handleAdminAction(data) {
  if (!verifyDashboardPassword(data)) throw new Error('Unauthorized');
  
  const subAction = data.subAction;
  switch (subAction) {
    case 'saveEntry':
      return saveTableRow(data.table, data.entry);
    case 'deleteEntry':
      return deleteTableRow(data.table, data.id);
    case 'uploadMedia':
      return handleMediaUpload(data);
    case 'syncMedia':
      return syncMediaLibrary();
    default:
      throw new Error('Invalid sub-action: ' + subAction);
  }
}

/**
 * Simple authentication check for dashboard
 */
function verifyDashboardPassword(params) {
  const pwd = params.password || params.pwd;
  const correct = PropertiesService.getScriptProperties().getProperty('DASHBOARD_PASSWORD') || 'pinnacle2024admin';
  return pwd === correct;
}

/**
 * Fetch all rows from a sheet as JSON objects
 */
function fetchTableData(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName.trim());
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Save or Update a row in a sheet
 */
function saveTableRow(sheetName, entry) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName.trim());
  
  // 1. Handle entry if it's a JSON string (common from dashboard)
  if (typeof entry === 'string') {
    try { entry = JSON.parse(entry); } catch (e) { Logger.log('Error parsing entry: ' + e); }
  }

  // 2. Auto-init sheet if missing
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // 3. Ensure we have headers
  let headers;
  if (sheet.getLastColumn() === 0) {
    headers = Object.keys(entry);
    sheet.appendRow(headers);
  } else {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }
  
  const data = sheet.getDataRange().getValues();
  
  // 4. Find existing row by ID (assume first column is 'id' or first column in general)
  let rowIndex = -1;
  const idIndex = headers.indexOf('id');
  
  if (idIndex !== -1 && entry.id) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(entry.id)) {
        rowIndex = i + 1;
        break;
      }
    }
  } else if (idIndex !== -1 && !entry.id) {
    // Generate new ID if missing but ID column exists
    entry.id = 'idx_' + Date.now();
  }
  
  // 5. Map values to match headers
  const rowValues = headers.map(h => entry[h] !== undefined ? entry[h] : '');
  
  // 6. Save or Append
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    return { status: 'updated', id: entry.id };
  } else {
    sheet.appendRow(rowValues);
    return { status: 'created', id: entry.id };
  }
}

/**
 * Delete a row by ID
 */
function deleteTableRow(sheetName, id) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error('ID column not found');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { status: 'deleted', id: id };
    }
  }
  throw new Error('Entry not found: ' + id);
}

/**
 * Handle Media Upload to Google Drive
 */
/**
 * Handle Media Upload to Google Drive
 */
function handleMediaUpload(data) {
  if (!data.file || !data.fileName) throw new Error('Missing file data');
  
  const contentType = data.file.split(',')[0].split(':')[1].split(';')[0];
  const b64Data = data.file.split(',')[1];
  const bytes = Utilities.base64Decode(b64Data);
  const blob = Utilities.newBlob(bytes, contentType, data.fileName);
  
  let folder;
  const folders = DriveApp.getFoldersByName('Pinnacle Media');
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder('Pinnacle Media');
  }
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const publicUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  
  const mediaEntry = {
    id: file.getId(),
    fileName: data.fileName,
    type: contentType,
    publicUrl: publicUrl,
    uploadDate: new Date().toISOString(), // Use string for better stability
    size: file.getSize()
  };
  
  saveTableRow('MediaLibrary', mediaEntry);
  return mediaEntry;
}

/**
 * Scan Drive Folder and Sync Spreadsheet
 */
function syncMediaLibrary() {
  const folders = DriveApp.getFoldersByName('Pinnacle Media');
  if (!folders.hasNext()) return { status: 'error', message: 'No media folder found.' };
  
  const folder = folders.next();
  const files = folder.getFiles();
  let count = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    
    // ENSURE FILE IS PUBLICLY ACCESSIBLE
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Could not set sharing for ' + file.getName() + ': ' + e);
    }

    const mediaEntry = {
      id: file.getId(),
      fileName: file.getName(),
      type: file.getMimeType(),
      publicUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
      uploadDate: file.getDateCreated().toISOString(),
      size: file.getSize()
    };
    saveTableRow('MediaLibrary', mediaEntry);
    count++;
  }
  
  return { status: 'success', synced: count };
}

// ── Patch doGet/doPost integration ─────────────────
// These should be added to the existing doGet/doPost switch blocks in Code.gs

// IN doGet:
// case 'getAdminContent':
//   result = handleGetAdminContent(data);
//   break;

// IN doPost:
// case 'adminAction':
/**
 * FORCE AUTHORIZATION HELPER
 * Run this function manually from the editor if you get Drive permission errors.
 */
function manualAuthCheck() {
  try {
    const folderName = 'Pinnacle Media';
    // 1. Check Read Permission
    const folders = DriveApp.getFoldersByName(folderName);
    let folder;
    
    // 2. Check Write/Create Permission
    if (folders.hasNext()) {
      folder = folders.next();
      Logger.log('Found existing folder.');
    } else {
      folder = DriveApp.createFolder(folderName);
      Logger.log('Created new folder.');
    }
    
    // 3. Check File Create & Sharing Permission
    const tempFile = folder.createFile('auth_test.txt', 'Permission Test');
    tempFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 4. Cleanup
    tempFile.setTrashed(true);
    
    Logger.log('✅ ALL PERMISSIONS GRANTED! You can now re-deploy as a New Deployment.');
  } catch (e) {
    Logger.log('❌ Permission Check Failed: ' + e.toString());
    throw e;
  }
}

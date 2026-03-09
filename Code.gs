/**
 * Pinnacle Dental Centre - Backend Script
 * Handles Lead Capture, Bookings, and Cart Submissions.
 * 
 * Instructions:
 * 1. Create a Google Sheet with tabs: "Leads", "Appointments", "Orders".
 * 2. Deploy this script as a Web App (Me, Anyone).
 * 3. Replace SPREADSHEET_ID if necessary.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    switch(action) {
      case 'createBooking':
        result = handleBooking(data);
        break;
      case 'saveLead':
        result = handleLead(data);
        break;
      case 'submitOrder':
        result = handleOrder(data);
        break;
      default:
        throw new Error('Invalid action');
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleBooking(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Appointments');
  sheet.appendRow([
    new Date(),
    data.name,
    data.phone,
    data.email,
    data.service,
    data.date,
    data.message || ''
  ]);
  
  // Create Calendar Event
  createCalendarEvent(data);
  return { message: 'Booking received' };
}

function handleLead(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Leads');
  sheet.appendRow([
    new Date(),
    data.name,
    data.phone,
    data.source || 'Website'
  ]);
  return { message: 'Lead saved' };
}

function handleOrder(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
  sheet.appendRow([
    new Date(),
    data.name,
    data.phone,
    JSON.stringify(data.cart),
    data.total
  ]);
  return { message: 'Order recorded' };
}

function createCalendarEvent(data) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const startTime = new Date(data.date);
    const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour duration
    
    calendar.createEvent(
      `Pinnacle Dental: ${data.name} - ${data.service}`,
      startTime,
      endTime,
      {
        description: `Phone: ${data.phone}\nMessage: ${data.message || 'No additional info'}`
      }
    );
  } catch (e) {
    console.error('Calendar error: ' + e.toString());
  }
}

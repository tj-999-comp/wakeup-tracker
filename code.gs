// 1. config
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'records';

// 2. test function
function testAppendRecord() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  sheet.appendRow([new Date(), '06:45', 'weekday']);
}

// 3. json respons function
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 4. doGet function
function doGet() {
  return jsonResponse({
    ok: true,
    message: 'wake-up API is running'
  });
}

// 5. doPost function
function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : '{}';
    const body = JSON.parse(raw);

    const wakeupTime = body.wakeup_time;
    const dayType = body.day_type;

    if (!wakeupTime || !dayType) {
      return jsonResponse({
        ok: false,
        error: 'wakeup_time and day_type are required'
      });
    }

    if (!['weekday', 'holiday'].includes(dayType)) {
      return jsonResponse({
        ok: false,
        error: 'day_type must be weekday or holiday'
      });
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: 'sheet not found'
      });
    }

    sheet.appendRow([
      new Date(),
      wakeupTime,
      dayType
    ]);

    return jsonResponse({
      ok: true,
      message: 'record inserted'
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message
    });
  }
}
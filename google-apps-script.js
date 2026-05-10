const SPREADSHEET_ID = "16_4BzhPCMsgmZVOQeaxsGOCXiL9VjOPonFJWbhJ0QYI";
const SHEET_NAME = "Signups";

function doPost(e) {
  const sheet = getSignupSheet_();
  const data = e.parameter || {};

  sheet.appendRow([
    new Date(),
    data.name || "",
    data.email || "",
    data.company || "",
    data.role || "",
    data.team_size || "",
    data.automation_interest || "",
    data.automation_goals || "",
    data.source || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSignupSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Submitted at",
      "Name",
      "Work email",
      "Company",
      "Role",
      "Team size",
      "Automation interest",
      "Comments",
      "Source",
    ]);
  }

  return sheet;
}

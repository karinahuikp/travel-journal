const SHEETS = {
  trips: "Trips",
  dailyPlans: "DailyPlans",
  members: "Members",
  expenses: "Expenses"
};

const HEADERS = {
  Trips: ["tripId", "title", "startDate", "endDate", "destination", "updatedAt"],
  DailyPlans: ["tripId", "planId", "date", "dayNumber", "location", "transport", "accommodation", "spots"],
  Members: ["tripId", "memberName"],
  Expenses: ["tripId", "expenseId", "date", "name", "category", "amount", "currency", "payer", "splitAmount"]
};

function doGet(e) {
  try {
    const tripId = e.parameter.tripId || e.parameter.trip;
    if (!tripId) return jsonOutput({ ok: false, error: "Missing tripId" });

    const trip = readTrip(tripId);
    if (!trip) return jsonOutput({ ok: false, error: "Trip not found" });

    return jsonOutput({ ok: true, trip });
  } catch (error) {
    return jsonOutput({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const adminKey = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");

    if (!adminKey || payload.adminKey !== adminKey) {
      return jsonOutput({ ok: false, error: "Unauthorized" });
    }

    if (payload.action !== "saveTrip" || !payload.trip || !payload.trip.tripId) {
      return jsonOutput({ ok: false, error: "Invalid payload" });
    }

    ensureSheets();
    saveTrip(payload.trip);

    return jsonOutput({
      ok: true,
      tripId: payload.trip.tripId,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonOutput({ ok: false, error: String(error) });
  }
}

function readTrip(tripId) {
  ensureSheets();

  const tripRows = rowsAsObjects(SHEETS.trips);
  const trip = tripRows.find((row) => row.tripId === tripId);
  if (!trip) return null;

  const dailyPlans = rowsAsObjects(SHEETS.dailyPlans)
    .filter((row) => row.tripId === tripId)
    .map((row) => ({
      id: row.planId,
      date: row.date,
      dayNumber: Number(row.dayNumber) || 0,
      location: row.location,
      transport: row.transport,
      accommodation: row.accommodation,
      spots: parseJsonList(row.spots)
    }))
    .sort((a, b) => a.dayNumber - b.dayNumber || String(a.date).localeCompare(String(b.date)));

  const members = rowsAsObjects(SHEETS.members)
    .filter((row) => row.tripId === tripId)
    .map((row) => row.memberName)
    .filter(Boolean);

  const expenses = rowsAsObjects(SHEETS.expenses)
    .filter((row) => row.tripId === tripId)
    .map((row) => ({
      id: row.expenseId,
      date: row.date,
      name: row.name,
      category: row.category,
      amount: Number(row.amount) || 0,
      currency: row.currency,
      payer: row.payer,
      splitAmount: Number(row.splitAmount) || 0
    }));

  return {
    tripId: trip.tripId,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    destination: trip.destination,
    members,
    dailyPlans,
    expenses,
    updatedAt: trip.updatedAt
  };
}

function saveTrip(trip) {
  deleteRowsByTripId(SHEETS.trips, trip.tripId);
  deleteRowsByTripId(SHEETS.dailyPlans, trip.tripId);
  deleteRowsByTripId(SHEETS.members, trip.tripId);
  deleteRowsByTripId(SHEETS.expenses, trip.tripId);

  appendRows(SHEETS.trips, [[
    trip.tripId,
    trip.title || "",
    trip.startDate || "",
    trip.endDate || "",
    trip.destination || "",
    new Date().toISOString()
  ]]);

  appendRows(SHEETS.dailyPlans, (trip.dailyPlans || []).map((plan) => [
    trip.tripId,
    plan.id || plan.planId || Utilities.getUuid(),
    plan.date || "",
    plan.dayNumber || "",
    plan.location || "",
    plan.transport || "",
    plan.accommodation || "",
    JSON.stringify(plan.spots || [])
  ]));

  appendRows(SHEETS.members, (trip.members || []).map((memberName) => [
    trip.tripId,
    memberName
  ]));

  appendRows(SHEETS.expenses, (trip.expenses || []).map((expense) => [
    trip.tripId,
    expense.id || expense.expenseId || Utilities.getUuid(),
    expense.date || "",
    expense.name || "",
    expense.category || "",
    Number(expense.amount) || 0,
    expense.currency || "",
    expense.payer || "",
    Number(expense.splitAmount) || 0
  ]));
}

function ensureSheets() {
  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = getOrCreateSheet(sheetName);
    const headers = HEADERS[sheetName];
    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsHeaders = currentHeaders.every((value) => value === "");

    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function rowsAsObjects(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).map((row) => {
    return headers.reduce((record, header, index) => {
      record[header] = row[index];
      return record;
    }, {});
  });
}

function deleteRowsByTripId(sheetName, tripId) {
  const sheet = getOrCreateSheet(sheetName);
  const values = sheet.getDataRange().getValues();

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    if (values[rowIndex][0] === tripId) {
      sheet.deleteRow(rowIndex + 1);
    }
  }
}

function appendRows(sheetName, rows) {
  if (!rows.length) return;

  const sheet = getOrCreateSheet(sheetName);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function getOrCreateSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return String(value || "")
      .split(/\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

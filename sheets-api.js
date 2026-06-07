const SHEETS_API_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbyMSkLISdpf4W7ylZfU8QeddKYaljA8nmgGNgG5unTWrtSCm01wXRL4l6u9AfEGGjywbw/exec",
  adminKey: "karina-trip-2026"
};

async function syncTripToGoogleSheet(trip) {
  if (!SHEETS_API_CONFIG.webAppUrl) {
    throw new Error("請先在 sheets-api.js 填入 Apps Script Web App URL。");
  }

  if (!SHEETS_API_CONFIG.adminKey) {
    throw new Error("請先在 sheets-api.js 填入 adminKey。");
  }

  const payload = {
    action: "saveTrip",
    adminKey: SHEETS_API_CONFIG.adminKey,
    trip: toSheetTrip(trip)
  };

  const response = await fetch(SHEETS_API_CONFIG.webAppUrl, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "同步到 Google Sheet 失敗。");
  }

  return result;
}

async function fetchTripFromGoogleSheet(tripId) {
  if (!SHEETS_API_CONFIG.webAppUrl) {
    throw new Error("請先在 sheets-api.js 填入 Apps Script Web App URL。");
  }

  const url = new URL(SHEETS_API_CONFIG.webAppUrl);
  url.searchParams.set("tripId", tripId);

  const response = await fetch(url.toString());
  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "讀取 Google Sheet 旅程失敗。");
  }

  return result.trip;
}

function toSheetTrip(trip) {
  return {
    tripId: trip.id,
    title: trip.title,
    startDate: trip.date,
    endDate: addDaysForSheets(trip.date, Math.max(Number(trip.days || 1) - 1, 0)),
    destination: trip.location,
    members: Array.isArray(trip.members) ? trip.members : [],
    dailyPlans: (trip.itineraries || []).map((item) => ({
      id: item.id,
      date: item.date,
      dayNumber: item.day,
      location: item.place,
      transport: item.drive,
      accommodation: item.lodging,
      spots: Array.isArray(item.spots) ? item.spots : []
    })),
    expenses: (trip.expenses || []).map((expense) => ({
      id: expense.id,
      date: expense.date,
      name: expense.name,
      category: expense.category,
      amount: Number(expense.amount) || 0,
      currency: expense.currency,
      payer: expense.payer,
      splitAmount: Number(expense.splitAmount) || 0
    }))
  };
}

function addDaysForSheets(dateKey, days) {
  if (!dateKey) return "";

  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKeyForSheets(date);
}

function toDateKeyForSheets(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

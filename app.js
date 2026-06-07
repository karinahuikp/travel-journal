const STORAGE_KEY = "travel-journal-trips";

let trips = loadTrips();
let calendarDate = new Date();
let selectedCalendarDate = toDateKey(calendarDate);

const page = document.body.dataset.page;

if (page === "dashboard") initDashboard();
if (page === "add-trip") initAddTrip();
if (page === "trip-detail") initTripDetail();
if (page === "budget") initBudget();

function initDashboard() {
  const tripGrid = document.querySelector("#tripGrid");
  const emptyTrips = document.querySelector("#emptyTrips");
  const tripCount = document.querySelector("#tripCount");
  const calendarGrid = document.querySelector("#calendarGrid");
  const calendarTitle = document.querySelector("#calendarTitle");
  const selectedDateLabel = document.querySelector("#selectedDateLabel");
  const dateSpots = document.querySelector("#dateSpots");

  document.querySelector("#prevMonth").addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    selectedCalendarDate = toDateKey(calendarDate);
    renderDashboard();
  });

  document.querySelector("#nextMonth").addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    selectedCalendarDate = toDateKey(calendarDate);
    renderDashboard();
  });

  calendarGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    selectedCalendarDate = button.dataset.date;
    renderDashboard();
  });

  tripGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-trip]");
    if (!button) return;

    const tripId = button.dataset.deleteTrip;
    const trip = trips.find((item) => item.id === tripId);
    const confirmed = confirm(`確定要刪除「${trip?.title || "這個旅程"}」嗎？這只會移除本機 LocalStorage 資料。`);
    if (!confirmed) return;

    trips = trips.filter((item) => item.id !== tripId);
    saveTrips();
    renderDashboard();
  });

  function renderDashboard() {
    const sortedTrips = [...trips].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    const hasTrips = sortedTrips.length > 0;

    emptyTrips.classList.toggle("hidden", hasTrips);
    tripGrid.innerHTML = sortedTrips.map(renderTripCard).join("");
    tripCount.textContent = `${sortedTrips.length} ${sortedTrips.length === 1 ? "trip" : "trips"}`;

    renderCalendar(calendarGrid, calendarTitle);
    renderDateSpots(selectedDateLabel, dateSpots);
  }

  renderDashboard();
}

function initAddTrip() {
  const form = document.querySelector("#addTripForm");
  const title = document.querySelector("#tripTitle");
  const date = document.querySelector("#tripDate");
  const days = document.querySelector("#tripDays");
  const location = document.querySelector("#tripLocation");
  const members = document.querySelector("#tripMembers");

  date.value = toDateKey(new Date());

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const trip = {
      id: createId(),
      title: title.value.trim(),
      date: date.value,
      days: Number(days.value),
      location: location.value.trim(),
      members: parseList(members.value),
      itineraries: [],
      expenses: [],
      createdAt: new Date().toISOString()
    };

    trips = [trip, ...trips];
    saveTrips();
    window.location.href = `trip-detail.html?id=${encodeURIComponent(trip.id)}`;
  });
}

function initTripDetail() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get("id");
  const trip = trips.find((item) => item.id === tripId);

  const missingTrip = document.querySelector("#missingTrip");
  const detailContent = document.querySelector("#detailContent");

  if (!trip) {
    missingTrip.classList.remove("hidden");
    return;
  }

  trip.itineraries = Array.isArray(trip.itineraries) ? trip.itineraries : [];
  trip.members = Array.isArray(trip.members) ? trip.members : [];
  trip.expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
  detailContent.classList.remove("hidden");

  const tripName = document.querySelector("#tripName");
  const tripMeta = document.querySelector("#tripMeta");
  const tripDestination = document.querySelector("#tripDestination");
  const budgetLink = document.querySelector("#budgetLink");
  const syncSheetButton = document.querySelector("#syncSheetButton");
  const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
  const sheetSyncStatus = document.querySelector("#sheetSyncStatus");
  const memberForm = document.querySelector("#memberForm");
  const memberName = document.querySelector("#memberName");
  const memberList = document.querySelector("#memberList");
  const emptyMembers = document.querySelector("#emptyMembers");
  const form = document.querySelector("#itineraryForm");
  const itineraryList = document.querySelector("#itineraryList");
  const emptyItineraries = document.querySelector("#emptyItineraries");

  const fields = {
    date: document.querySelector("#itineraryDate"),
    day: document.querySelector("#itineraryDay"),
    place: document.querySelector("#itineraryPlace"),
    drive: document.querySelector("#itineraryDrive"),
    lodging: document.querySelector("#itineraryLodging"),
    spots: document.querySelector("#itinerarySpots"),
    notes: document.querySelector("#itineraryNotes")
  };

  tripName.textContent = trip.title;
  tripMeta.textContent = `${formatDate(trip.date)} · ${trip.days} 天`;
  tripDestination.textContent = trip.location;
  budgetLink.href = `budget.html?id=${encodeURIComponent(trip.id)}`;
  fields.date.value = trip.date;

  syncSheetButton.addEventListener("click", async () => {
    setSheetStatus("同步中...");
    syncSheetButton.disabled = true;

    try {
      const result = await syncTripToGoogleSheet(trip);
      setSheetStatus(`已同步：${formatDateTime(result.updatedAt)}`);
    } catch (error) {
      setSheetStatus(error.message);
    } finally {
      syncSheetButton.disabled = false;
    }
  });

  copyShareLinkButton.addEventListener("click", async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname.replace("trip-detail.html", "share.html")}?tripId=${encodeURIComponent(trip.id)}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setSheetStatus("分享連結已複製。");
    } catch (error) {
      setSheetStatus(`分享連結：${shareUrl}`);
    }
  });

  memberForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = memberName.value.trim();
    if (!name || trip.members.includes(name)) return;

    trip.members = [...trip.members, name];
    recalculateExpenseSplits(trip);
    persistTrip(trip);
    renderMembers();
    memberForm.reset();
    memberName.focus();
  });

  memberList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-member]");
    if (!button) return;

    trip.members = trip.members.filter((name) => name !== button.dataset.deleteMember);
    recalculateExpenseSplits(trip);
    persistTrip(trip);
    renderMembers();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const itinerary = {
      id: createId(),
      date: fields.date.value,
      day: Number(fields.day.value),
      place: fields.place.value.trim(),
      drive: fields.drive.value.trim(),
      lodging: fields.lodging.value.trim(),
      spots: parseSpots(fields.spots.value),
      notes: fields.notes.value.trim(),
      createdAt: new Date().toISOString()
    };

    trip.itineraries = [...trip.itineraries, itinerary].sort((a, b) => a.day - b.day || a.date.localeCompare(b.date));
    persistTrip(trip);
    renderItineraries();
    form.reset();
    fields.date.value = addDays(trip.date, Math.min(trip.itineraries.length, trip.days - 1));
    fields.day.value = Math.min(trip.itineraries.length + 1, trip.days);
    fields.place.focus();
  });

  itineraryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-itinerary]");
    if (!button) return;

    trip.itineraries = trip.itineraries.filter((item) => item.id !== button.dataset.deleteItinerary);
    persistTrip(trip);
    renderItineraries();
  });

  function renderMembers() {
    emptyMembers.classList.toggle("hidden", trip.members.length > 0);
    memberList.innerHTML = trip.members.map((name) => `
      <span class="inline-flex items-center gap-2 rounded-full bg-washi px-3 py-2 text-sm font-bold text-slate-700">
        ${escapeHtml(name)}
        <button class="text-persimmon transition hover:text-persimmon/80" data-delete-member="${escapeHtml(name)}" type="button" aria-label="刪除 ${escapeHtml(name)}">
          x
        </button>
      </span>
    `).join("");
  }

  function renderItineraries() {
    const items = [...trip.itineraries].sort((a, b) => a.day - b.day || a.date.localeCompare(b.date));
    emptyItineraries.classList.toggle("hidden", items.length > 0);
    itineraryList.innerHTML = items.map(renderItineraryCard).join("");
  }

  function setSheetStatus(message) {
    sheetSyncStatus.textContent = message;
  }

  renderMembers();
  renderItineraries();
}

function initBudget() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get("id");
  const trip = trips.find((item) => item.id === tripId);

  const missingTrip = document.querySelector("#missingBudgetTrip");
  const budgetContent = document.querySelector("#budgetContent");

  if (!trip) {
    missingTrip.classList.remove("hidden");
    return;
  }

  trip.members = Array.isArray(trip.members) ? trip.members : [];
  trip.expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
  budgetContent.classList.remove("hidden");

  const backToTrip = document.querySelector("#backToTrip");
  const budgetTripMeta = document.querySelector("#budgetTripMeta");
  const budgetTripName = document.querySelector("#budgetTripName");
  const budgetMembers = document.querySelector("#budgetMembers");
  const form = document.querySelector("#expenseForm");
  const totalExpense = document.querySelector("#totalExpense");
  const averageExpense = document.querySelector("#averageExpense");
  const emptyExpenses = document.querySelector("#emptyExpenses");
  const expenseList = document.querySelector("#expenseList");
  const payerHint = document.querySelector("#payerHint");
  const splitPreview = document.querySelector("#splitPreview");
  const expenseSubmit = document.querySelector("#expenseSubmit");

  const fields = {
    date: document.querySelector("#expenseDate"),
    name: document.querySelector("#expenseName"),
    category: document.querySelector("#expenseCategory"),
    amount: document.querySelector("#expenseAmount"),
    currency: document.querySelector("#expenseCurrency"),
    payer: document.querySelector("#expensePayer")
  };

  backToTrip.href = `trip-detail.html?id=${encodeURIComponent(trip.id)}`;
  budgetTripMeta.textContent = `${formatDate(trip.date)} · ${trip.location}`;
  budgetTripName.textContent = `${trip.title} 分帳記帳`;
  fields.date.value = toDateKey(new Date());

  fields.amount.addEventListener("input", renderSplitPreview);
  fields.currency.addEventListener("change", renderSplitPreview);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!trip.members.length) return;

    const amount = Number(fields.amount.value);
    const splitAmount = calculateSplit(amount, trip.members.length);
    const expense = {
      id: createId(),
      date: fields.date.value,
      name: fields.name.value.trim(),
      category: fields.category.value,
      amount,
      currency: fields.currency.value,
      payer: fields.payer.value,
      splitAmount
    };

    trip.expenses = [expense, ...trip.expenses];
    persistTrip(trip);
    renderBudget();
    form.reset();
    fields.date.value = toDateKey(new Date());
    renderPayerOptions();
    renderSplitPreview();
    fields.name.focus();
  });

  expenseList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-expense]");
    if (!button) return;

    trip.expenses = trip.expenses.filter((expense) => expense.id !== button.dataset.deleteExpense);
    persistTrip(trip);
    renderBudget();
  });

  function renderBudget() {
    renderPayerOptions();
    renderSplitPreview();
    budgetMembers.textContent = trip.members.length
      ? `團友：${trip.members.join("、")}`
      : "尚未加入團友。請先回旅程詳情新增團友，才能選擇支付者。";

    const totals = getExpenseTotals(trip.expenses);
    totalExpense.textContent = formatCurrencyTotals(totals);
    averageExpense.textContent = formatCurrencyTotals(getAverageTotals(totals, trip.members.length));

    emptyExpenses.classList.toggle("hidden", trip.expenses.length > 0);
    expenseList.innerHTML = trip.expenses.map(renderExpenseCard).join("");
  }

  function renderPayerOptions() {
    const hasMembers = trip.members.length > 0;
    fields.payer.disabled = !hasMembers;
    expenseSubmit.disabled = !hasMembers;
    payerHint.textContent = trip.members.length
      ? "支付者選項來自旅程團友名單。"
      : "請先回旅程詳情新增團友。";
    fields.payer.innerHTML = trip.members.map((member) => `
      <option value="${escapeHtml(member)}">${escapeHtml(member)}</option>
    `).join("");
  }

  function renderSplitPreview() {
    const amount = Number(fields.amount.value) || 0;
    const splitAmount = calculateSplit(amount, trip.members.length);
    splitPreview.textContent = `${formatAmount(splitAmount)} ${fields.currency.value}`;
  }

  renderBudget();
}

function renderTripCard(trip) {
  const itineraryCount = Array.isArray(trip.itineraries) ? trip.itineraries.length : 0;
  const spotsCount = Array.isArray(trip.itineraries)
    ? trip.itineraries.reduce((sum, item) => sum + item.spots.length, 0)
    : 0;

  return `
    <article class="rounded-lg bg-white/90 p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-persimmon">${formatDate(trip.date)}</p>
          <h3 class="mt-3 break-words text-2xl font-bold">${escapeHtml(trip.title)}</h3>
          <p class="mt-2 text-sm font-bold text-matcha">${escapeHtml(trip.location)} · ${trip.days} 天</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <span class="rounded-full bg-washi px-3 py-1 text-xs font-bold text-slate-700">手帳</span>
          <button class="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-persimmon transition hover:border-persimmon hover:text-persimmon" data-delete-trip="${trip.id}" type="button">
            刪除
          </button>
        </div>
      </div>
      <div class="mt-5 grid grid-cols-2 gap-3 text-center">
        <div class="rounded-md bg-paper p-3">
          <p class="text-xl font-bold text-matcha">${itineraryCount}</p>
          <p class="mt-1 text-xs font-bold text-slate-500">每日行程</p>
        </div>
        <div class="rounded-md bg-paper p-3">
          <p class="text-xl font-bold text-matcha">${spotsCount}</p>
          <p class="mt-1 text-xs font-bold text-slate-500">景點</p>
        </div>
      </div>
      ${(trip.members || []).length ? `
        <div class="mt-4 flex flex-wrap gap-2">
          ${trip.members.slice(0, 4).map((member) => `<span class="rounded-full bg-washi px-3 py-1 text-xs font-bold text-slate-700">${escapeHtml(member)}</span>`).join("")}
          ${trip.members.length > 4 ? `<span class="rounded-full bg-washi px-3 py-1 text-xs font-bold text-slate-700">+${trip.members.length - 4}</span>` : ""}
        </div>
      ` : ""}
      <a href="trip-detail.html?id=${encodeURIComponent(trip.id)}" class="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-matcha px-5 text-sm font-bold text-white transition hover:bg-matcha/90">
        查看每日行程
      </a>
    </article>
  `;
}

function renderCalendar(calendarGrid, calendarTitle) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entriesByDate = getEntriesByDate();
  const cells = [];

  calendarTitle.textContent = new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "long"
  }).format(calendarDate);

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(`<span class="min-h-11 rounded-md bg-paper/50"></span>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = toDateKey(new Date(year, month, day));
    const hasEntries = Boolean(entriesByDate[dateKey]?.length);
    const selected = dateKey === selectedCalendarDate;
    const classes = selected
      ? "bg-matcha text-white"
      : hasEntries
        ? "bg-sakura/40 text-ink hover:bg-sakura/60"
        : "bg-paper text-slate-700 hover:bg-washi";

    cells.push(`
      <button class="relative min-h-11 rounded-md text-sm font-bold transition ${classes}" data-date="${dateKey}" type="button">
        ${day}
        ${hasEntries ? `<span class="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-persimmon"></span>` : ""}
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");
}

function renderDateSpots(selectedDateLabel, dateSpots) {
  selectedDateLabel.textContent = formatDate(selectedCalendarDate);

  const entries = getEntriesByDate()[selectedCalendarDate] || [];
  if (!entries.length) {
    dateSpots.innerHTML = `
      <div class="rounded-lg border border-dashed border-slate-300 bg-paper p-6 text-center">
        <p class="text-lg font-bold">這一天還沒有安排景點</p>
        <p class="mt-2 text-sm text-slate-600">點擊月曆中有標記的日期，或到旅程詳情新增每日行程。</p>
      </div>
    `;
    return;
  }

  dateSpots.innerHTML = entries.map((entry) => `
    <article class="rounded-lg bg-paper p-5 ring-1 ring-washi">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-sm font-bold text-matcha">${escapeHtml(entry.tripTitle)} · Day ${entry.day}</p>
          <h3 class="mt-2 text-2xl font-bold">${escapeHtml(entry.place)}</h3>
        </div>
        <a href="trip-detail.html?id=${encodeURIComponent(entry.tripId)}" class="inline-flex min-h-10 items-center justify-center rounded-md bg-matcha px-4 text-sm font-bold text-white transition hover:bg-matcha/90">
          查看旅程
        </a>
      </div>

      ${(entry.drive || entry.lodging) ? `
        <dl class="mt-4 grid gap-3 sm:grid-cols-2">
          ${entry.drive ? `
            <div class="rounded-md bg-white px-4 py-3">
              <dt class="text-xs font-bold text-slate-500">車程／交通方式</dt>
              <dd class="mt-1 font-semibold">${escapeHtml(entry.drive)}</dd>
            </div>
          ` : ""}
          ${entry.lodging ? `
            <div class="rounded-md bg-white px-4 py-3">
              <dt class="text-xs font-bold text-slate-500">住宿地點</dt>
              <dd class="mt-1 font-semibold">${escapeHtml(entry.lodging)}</dd>
            </div>
          ` : ""}
        </dl>
      ` : ""}

      <p class="mt-5 text-sm font-bold text-slate-700">景點列表</p>
      <ul class="mt-2 grid gap-2 sm:grid-cols-2">
        ${entry.spots.map((spot) => `<li class="rounded-md bg-white px-4 py-3 text-sm font-semibold">${escapeHtml(spot)}</li>`).join("")}
      </ul>
      ${entry.notes ? `
        <div class="mt-4 rounded-md bg-white px-4 py-3">
          <p class="text-xs font-bold text-slate-500">備註</p>
          <p class="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">${escapeHtml(entry.notes)}</p>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderItineraryCard(item) {
  return `
    <article class="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-persimmon">${formatDate(item.date)}</p>
          <h3 class="mt-2 text-2xl font-bold">Day ${item.day} · ${escapeHtml(item.place)}</h3>
        </div>
        <button class="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-persimmon hover:text-persimmon" data-delete-itinerary="${item.id}" type="button">
          刪除
        </button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-md bg-paper p-3">
          <dt class="text-xs font-bold text-slate-500">車程／交通方式</dt>
          <dd class="mt-1 font-semibold">${escapeHtml(item.drive || "未填寫")}</dd>
        </div>
        <div class="rounded-md bg-paper p-3">
          <dt class="text-xs font-bold text-slate-500">住宿地點</dt>
          <dd class="mt-1 font-semibold">${escapeHtml(item.lodging || "未填寫")}</dd>
        </div>
      </dl>
      <div class="mt-4">
        <p class="text-sm font-bold text-slate-700">景點列表</p>
        <div class="mt-2 flex flex-wrap gap-2">
          ${item.spots.map((spot) => `<span class="rounded-full bg-washi px-3 py-1 text-sm font-bold text-slate-700">${escapeHtml(spot)}</span>`).join("")}
        </div>
      </div>
      ${item.notes ? `
        <div class="mt-4 rounded-md bg-paper p-3">
          <p class="text-xs font-bold text-slate-500">備註</p>
          <p class="mt-1 whitespace-pre-wrap font-semibold">${escapeHtml(item.notes)}</p>
        </div>
      ` : ""}
    </article>
  `;
}

function renderExpenseCard(expense) {
  return `
    <article class="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-persimmon">${formatDate(expense.date)}</p>
          <h3 class="mt-2 text-2xl font-bold">${escapeHtml(expense.name)}</h3>
          <p class="mt-1 text-sm font-bold text-matcha">${escapeHtml(expense.category)} · ${escapeHtml(expense.payer)} 支付</p>
        </div>
        <button class="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-persimmon hover:text-persimmon" data-delete-expense="${expense.id}" type="button">
          刪除
        </button>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-md bg-paper p-3">
          <p class="text-xs font-bold text-slate-500">金額</p>
          <p class="mt-1 text-xl font-bold">${formatAmount(expense.amount)} ${escapeHtml(expense.currency)}</p>
        </div>
        <div class="rounded-md bg-paper p-3">
          <p class="text-xs font-bold text-slate-500">每人金額</p>
          <p class="mt-1 text-xl font-bold">${formatAmount(expense.splitAmount)} ${escapeHtml(expense.currency)}</p>
        </div>
      </div>
    </article>
  `;
}

function getEntriesByDate() {
  return trips.reduce((dates, trip) => {
    const itineraries = Array.isArray(trip.itineraries) ? trip.itineraries : [];

    itineraries.forEach((item) => {
      if (!dates[item.date]) dates[item.date] = [];
      dates[item.date].push({
        tripId: trip.id,
        tripTitle: trip.title,
        day: item.day,
        place: item.place,
        drive: item.drive,
        lodging: item.lodging,
        spots: item.spots,
        notes: item.notes
      });
    });

    return dates;
  }, {});
}

function persistTrip(updatedTrip) {
  trips = trips.map((trip) => trip.id === updatedTrip.id ? updatedTrip : trip);
  saveTrips();
}

function recalculateExpenseSplits(trip) {
  trip.expenses = trip.expenses.map((expense) => ({
    ...expense,
    splitAmount: calculateSplit(expense.amount, trip.members.length)
  }));
}

function loadTrips() {
  try {
    const storedTrips = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return storedTrips.map((trip) => ({
      ...trip,
      members: Array.isArray(trip.members) ? trip.members : [],
      itineraries: Array.isArray(trip.itineraries)
        ? trip.itineraries.map((item) => ({
            ...item,
            spots: Array.isArray(item.spots) ? item.spots : [],
            notes: item.notes || ""
          }))
        : [],
      expenses: Array.isArray(trip.expenses)
        ? trip.expenses.map((expense) => ({
            ...expense,
            amount: Number(expense.amount) || 0,
            splitAmount: Number(expense.splitAmount) || 0
          }))
        : []
    }));
  } catch {
    return [];
  }
}

function saveTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

function parseSpots(value) {
  return parseList(value);
}

function parseList(value) {
  return value
    .split(/\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function calculateSplit(amount, memberCount) {
  if (!memberCount) return 0;
  return Math.round((amount / memberCount) * 100) / 100;
}

function getExpenseTotals(expenses) {
  return expenses.reduce((totals, expense) => {
    totals[expense.currency] = (totals[expense.currency] || 0) + expense.amount;
    return totals;
  }, {});
}

function getAverageTotals(totals, memberCount) {
  return Object.entries(totals).reduce((averages, [currency, amount]) => {
    averages[currency] = calculateSplit(amount, memberCount);
    return averages;
  }, {});
}

function formatCurrencyTotals(totals) {
  const entries = Object.entries(totals);
  if (!entries.length) return "0";
  return entries
    .map(([currency, amount]) => `${formatAmount(amount)} ${currency}`)
    .join(" / ");
}

function formatAmount(value) {
  return new Intl.NumberFormat("zh-Hant", {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "未設定日期";
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return "剛剛";
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

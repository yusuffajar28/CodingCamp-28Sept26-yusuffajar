// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  TRANSACTIONS: "ebv_transactions",
  CATEGORIES:   "ebv_categories",
  LIMITS:       "ebv_limits",
  THEME:        "ebv_theme",
};

const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];

const SORT = {
  CHRONOLOGICAL_DESC: "chronological_desc",
  AMOUNT_ASC:         "amount_asc",
  AMOUNT_DESC:        "amount_desc",
  CATEGORY_AZ:        "category_az",
};

const VALIDATION = {
  MAX_NAME_LEN:          100,
  MAX_CATEGORY_LEN:      50,
  MAX_CUSTOM_CATEGORIES: 20,
  AMOUNT_MIN:            0.01,
  AMOUNT_MAX:            999999999.99,
};

/**
 * Fixed palette of 12 visually distinct hex colors used for pie-chart segments.
 * Colors are assigned by category index (modulo-wrapped) so each category
 * always gets the same color regardless of which transactions are visible.
 */
const CHART_PALETTE = [
  "#4e79a7", // steel blue
  "#f28e2b", // orange
  "#59a14f", // green
  "#e15759", // rose
  "#76b7b2", // teal
  "#edc948", // yellow
  "#b07aa1", // purple
  "#ff9da7", // pink
  "#9c755f", // brown
  "#bab0ac", // grey
  "#d37295", // magenta
  "#a0cbe8", // light blue
];

/**
 * Vivid red used to replace a category's normal palette color when that
 * category's total spending exceeds its defined limit (Req 10.4).
 */
const CHART_OVER_LIMIT_COLOR = "#e63946";

// ─── Application State ───────────────────────────────────────────────────────

const AppState = {
  transactions:     [],       // Transaction[]
  customCategories: [],       // string[] — user-defined (max 20)
  limits:           {},       // Record<string, number> — per-category spending limits
  theme:            "light",  // "light" | "dark"
  activeMonth:      null,     // "YYYY-MM" | null (null = all months)
  sortOption:       SORT.CHRONOLOGICAL_DESC,
  _chartInstance:   null,     // Chart.js instance, managed by renderChart()
};

// ─── Notifications ───────────────────────────────────────────────────────────

/**
 * Creates a dismissible notification element in #notification-area and appends
 * it. The notification persists until the user explicitly clicks the dismiss
 * button (Req 6.4, 6.5, 7.7).
 *
 * @param {string} message - Human-readable message to display.
 * @param {"error"|"info"} [type="info"] - Visual style variant.
 */
function showNotification(message, type = "info") {
  const area = document.getElementById("notification-area");
  if (!area) {
    // DOM not ready yet — surface to console so the message isn't lost.
    console.warn(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  const note = document.createElement("div");
  note.className = `notification ${type}`;
  note.setAttribute("role", "alert");
  note.setAttribute("aria-live", "assertive");

  const text = document.createElement("span");
  text.className = "notification-body";
  text.textContent = message;

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "notification-dismiss";
  dismiss.textContent = "✕";
  dismiss.setAttribute("aria-label", "Dismiss notification");
  dismiss.addEventListener("click", () => {
    note.remove();
  });

  note.appendChild(text);
  note.appendChild(dismiss);
  area.appendChild(note);
}

// ─── Render: Category Selects ─────────────────────────────────────────────────

/**
 * Rebuilds the `<option>` elements in every category `<select>` across the UI.
 * Targets:
 *   - `#tx-category` inside `#transaction-form`  (Req 1.1, 7.2)
 *   - Any `<select data-role="category-select">` rendered inside `#limit-section`
 *     by `renderLimitIndicators()` (Req 10.1)
 *
 * The current selection is preserved when the element's value still refers to
 * a valid category after the rebuild.
 */
function renderCategorySelects() {
  const categories = allCategories();

  // Collect all category <select> elements across the page.
  const selects = [
    document.getElementById("tx-category"),
    ...Array.from(
      document.querySelectorAll("#limit-section select[data-role='category-select']")
    ),
  ].filter(Boolean); // Remove nulls if an element isn't in the DOM yet.

  for (const sel of selects) {
    // Remember what was previously selected so we can restore it.
    const previousValue = sel.value;

    // Clear all existing options except a leading placeholder if present.
    sel.innerHTML = "";

    // Re-add a placeholder option for selects that need one (identified by
    // a data-placeholder attribute set in HTML).
    const placeholder = sel.dataset.placeholder;
    if (placeholder) {
      const placeholderOpt = document.createElement("option");
      placeholderOpt.value = "";
      placeholderOpt.textContent = placeholder;
      placeholderOpt.disabled = true;
      // Only select the placeholder if there was no prior valid selection.
      placeholderOpt.selected = !categories.includes(previousValue);
      sel.appendChild(placeholderOpt);
    }

    // Add one <option> per category.
    for (const cat of categories) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if (cat === previousValue) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    }
  }
  // Rebuild the limit inputs whenever categories change so new categories
  // get their own limit row immediately (Task 7.1, Req 10.1).
  if (typeof renderLimitSection === "function") renderLimitSection();
}

// ─── Persistence Layer ───────────────────────────────────────────────────────

/**
 * Returns the full list of available categories: defaults + any user-defined ones.
 * @returns {string[]}
 */
function allCategories() {
  return [...DEFAULT_CATEGORIES, ...AppState.customCategories];
}

/**
 * Persists AppState.transactions to localStorage.
 * Shows an error notification on failure (storage full, unavailable, etc.).
 */
function saveTransactions() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(AppState.transactions)
    );
  } catch (e) {
    showNotification(
      "Could not save transactions. Your browser storage may be full or unavailable.",
      "error"
    );
  }
}

/**
 * Persists AppState.customCategories to localStorage.
 * Shows an error notification on failure.
 */
function saveCategories() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.CATEGORIES,
      JSON.stringify(AppState.customCategories)
    );
  } catch (e) {
    showNotification(
      "Could not save custom categories. Your browser storage may be full or unavailable.",
      "error"
    );
  }
}

/**
 * Persists AppState.limits to localStorage.
 * Shows an error notification on failure.
 */
function saveLimits() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LIMITS,
      JSON.stringify(AppState.limits)
    );
  } catch (e) {
    showNotification(
      "Could not save spending limits. Your browser storage may be full or unavailable.",
      "error"
    );
  }
}

/**
 * Persists AppState.theme to localStorage.
 * Shows an error notification on failure.
 */
function saveTheme() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.THEME,
      JSON.stringify(AppState.theme)
    );
  } catch (e) {
    showNotification(
      "Could not save theme preference. Your browser storage may be unavailable.",
      "error"
    );
  }
}

/**
 * Reads all four storage keys and hydrates AppState.
 * Each key is parsed independently so a single bad value never blocks the rest.
 * On any localStorage read failure (API unavailable), shows a persistent
 * error notification and leaves AppState at its empty defaults.
 */
function loadFromStorage() {
  // Guard: if localStorage itself throws on access, surface a single error and bail.
  let storage;
  try {
    storage = window.localStorage;
  } catch (e) {
    showNotification(
      "Could not load saved data. Your browser storage may be unavailable.",
      "error"
    );
    return;
  }

  // Helper — safely parse one key; returns parsed value or the supplied fallback.
  function readKey(key, fallback) {
    try {
      const raw = storage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (e) {
      showNotification(
        "Could not load saved data. Your browser storage may be unavailable.",
        "error"
      );
      return fallback;
    }
  }

  // Hydrate each field — wrong types fall back silently to the default.
  const transactions = readKey(STORAGE_KEYS.TRANSACTIONS, []);
  AppState.transactions = Array.isArray(transactions) ? transactions : [];

  const customCategories = readKey(STORAGE_KEYS.CATEGORIES, []);
  AppState.customCategories = Array.isArray(customCategories) ? customCategories : [];

  const limits = readKey(STORAGE_KEYS.LIMITS, {});
  AppState.limits = (limits !== null && typeof limits === "object" && !Array.isArray(limits))
    ? limits
    : {};

  const theme = readKey(STORAGE_KEYS.THEME, "light");
  AppState.theme = (theme === "dark" || theme === "light") ? theme : "light";
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates a transaction input object.
 * All fields are checked independently so every error is reported at once.
 *
 * @param {{ name: any, amount: any, category: any }} data
 * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateTransactionInput(data) {
  const errors = {};

  // ── Name validation ──────────────────────────────────────────────────────
  if (typeof data.name !== "string" || data.name.trim() === "") {
    errors.name = "Item name is required.";
  } else if (data.name.trim().length > VALIDATION.MAX_NAME_LEN) {
    errors.name = `Item name must be ${VALIDATION.MAX_NAME_LEN} characters or fewer.`;
  }

  // ── Amount validation ────────────────────────────────────────────────────
  const rawAmount = data.amount;
  const parsed = parseFloat(rawAmount);

  if (rawAmount === "" || rawAmount === null || rawAmount === undefined || isNaN(parsed)) {
    errors.amount = "Amount is required and must be a valid number.";
  } else if (parsed < VALIDATION.AMOUNT_MIN || parsed > VALIDATION.AMOUNT_MAX) {
    errors.amount = `Amount must be between ${VALIDATION.AMOUNT_MIN} and ${VALIDATION.AMOUNT_MAX.toLocaleString()}.`;
  } else if (Math.round(parsed * 100) / 100 !== parsed) {
    errors.amount = "Amount must have no more than 2 decimal places.";
  }

  // ── Category validation ──────────────────────────────────────────────────
  if (typeof data.category !== "string" || !allCategories().includes(data.category)) {
    errors.category = "Please select a valid category.";
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (Object.keys(errors).length === 0) {
    return { valid: true };
  }
  return { valid: false, errors };
}

/**
 * Validates a custom category name before it is added.
 *
 * Rules (Req 7.5):
 *  - Must not be empty.
 *  - Must be ≤ 50 characters.
 *  - Must not already exist (case-insensitive) in allCategories().
 *
 * @param {string} name - The proposed category name.
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
function validateCategoryName(name) {
  // ── Empty check ──────────────────────────────────────────────────────────
  if (typeof name !== "string" || name.trim() === "") {
    return { valid: false, error: "Category name cannot be empty." };
  }

  // ── Length check ─────────────────────────────────────────────────────────
  if (name.trim().length > VALIDATION.MAX_CATEGORY_LEN) {
    return {
      valid: false,
      error: `Category name must be ${VALIDATION.MAX_CATEGORY_LEN} characters or fewer.`,
    };
  }

  // ── Duplicate check (case-insensitive) ───────────────────────────────────
  const nameLower = name.trim().toLowerCase();
  const duplicate = allCategories().some(
    (cat) => cat.toLowerCase() === nameLower
  );
  if (duplicate) {
    return { valid: false, error: "Category already exists." };
  }

  return { valid: true };
}

// ─── Business Logic ───────────────────────────────────────────────────────────

/**
 * Builds a single transaction `<li>` element matching the structure produced
 * by `renderTransactionList`. Used by `insertTransactionRowSorted` to create
 * a new row without a full list rebuild.
 *
 * Structure:
 *   <li class="transaction-item [over-limit]" data-id="...">
 *     <span class="tx-name">...</span>
 *     <span class="tx-amount">...</span>
 *     <span class="tx-category">...</span>
 *     <button class="btn btn-delete" data-id="..." aria-label="...">Delete</button>
 *   </li>
 *
 * @param {Object} tx - Transaction object from AppState.
 * @returns {HTMLLIElement}
 */
function buildTransactionRow(tx) {
  const li = document.createElement("li");
  li.className = "transaction-item";
  li.dataset.id = tx.id;

  if (isOverLimit(tx.category)) {
    li.classList.add("over-limit");
  }

  const nameEl = document.createElement("span");
  nameEl.className = "tx-name";
  nameEl.textContent = tx.name;

  const amountEl = document.createElement("span");
  amountEl.className = "tx-amount";
  amountEl.textContent = (Math.round(tx.amount * 100) / 100).toFixed(2);

  const categoryEl = document.createElement("span");
  categoryEl.className = "tx-category";
  categoryEl.textContent = tx.category;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-delete";
  deleteBtn.dataset.id = tx.id;
  deleteBtn.setAttribute("aria-label", `Delete transaction: ${tx.name}`);
  deleteBtn.textContent = "Delete";

  li.appendChild(nameEl);
  li.appendChild(amountEl);
  li.appendChild(categoryEl);
  li.appendChild(deleteBtn);

  return li;
}

/**
 * Inserts the given transaction's `<li>` row at the correct sorted position
 * in `#transaction-list` without rebuilding the entire list (Req 9.4).
 *
 * Steps:
 *  1. Check whether the transaction passes the active month filter — if not,
 *     skip the insert (the transaction is stored but not visible in this view).
 *  2. Obtain the fully sorted+filtered list (which already includes the new tx).
 *  3. Find the index of the new transaction in that sorted list.
 *  4. Remove any empty-state `<li>` that might be showing.
 *  5. Build the `<li>` element and splice it into position.
 *
 * Only called when `AppState.sortOption !== SORT.CHRONOLOGICAL_DESC`.
 *
 * @param {Object} tx - The newly added transaction object.
 * @returns {void}
 */
function insertTransactionRowSorted(tx) {
  const list = document.getElementById("transaction-list");
  if (!list) return;

  // ── Month filter check ──────────────────────────────────────────────────────
  // If an active month filter is set and this transaction falls outside it,
  // don't insert the row — the transaction is saved but not visible right now.
  if (AppState.activeMonth) {
    const d     = new Date(tx.timestamp);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    if (`${year}-${month}` !== AppState.activeMonth) {
      // Transaction doesn't belong in the current view — nothing to insert.
      return;
    }
  }

  // ── Get the sorted list that includes the new transaction ───────────────────
  const sortedList = getFilteredTransactions();
  const targetIndex = sortedList.findIndex((t) => t.id === tx.id);
  if (targetIndex === -1) return; // Shouldn't happen, but guard anyway.

  // ── Remove empty-state message if it's showing ──────────────────────────────
  const emptyMsg = list.querySelector("#empty-state-msg");
  if (emptyMsg) emptyMsg.remove();

  // ── Build and insert the new row ────────────────────────────────────────────
  const li = buildTransactionRow(tx);

  // `list.children` reflects the current DOM rows (no empty-state msg now).
  const referenceNode = list.children[targetIndex] ?? null;
  if (referenceNode) {
    list.insertBefore(li, referenceNode);
  } else {
    list.appendChild(li);
  }
}

/**
 * Adds a new transaction to AppState, persists it, and updates the UI.
 *
 * Optimisation (Req 9.4): when a non-default sort is active, inserts only the
 * new row at the correct sorted position instead of rebuilding the full list.
 * The default (chronological_desc) sort still uses the full `render()` path
 * because the new item must appear at the top — a simple prepend would also
 * work, but `render()` keeps the logic consistent across all update triggers.
 *
 * Sort-on-empty (Req 9.6): `AppState.sortOption` is already set by the sort
 * select's change handler before this function is called, so when the first
 * transaction is added to an otherwise empty list, `insertTransactionRowSorted`
 * (or `render()` for the default case) naturally respects the stored option.
 *
 * Silently returns if validation fails — the caller is responsible for
 * displaying field-level error messages.
 *
 * @param {{ name: string, amount: string|number, category: string }} data
 * @returns {void}
 */
function addTransaction(data) {
  const validation = validateTransactionInput(data);
  if (!validation.valid) return;

  // Generate a UUID, falling back when crypto.randomUUID is unavailable.
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

  const transaction = {
    id,
    name:      data.name.trim(),
    amount:    Math.round(parseFloat(data.amount) * 100) / 100,
    category:  data.category,
    timestamp: Date.now(),
  };

  AppState.transactions.push(transaction);
  saveTransactions();

  // ── Decide render strategy ──────────────────────────────────────────────────
  const isNonDefaultSort =
    AppState.sortOption !== SORT.CHRONOLOGICAL_DESC;
  const listInDom =
    typeof document !== "undefined" &&
    document.getElementById("transaction-list") !== null;

  if (isNonDefaultSort && listInDom) {
    // Sorted insertion: add the row at the correct DOM position without a
    // full list rebuild, then update the other components independently.
    insertTransactionRowSorted(transaction);

    const txList = getFilteredTransactions();
    renderBalance(txList);
    renderChart(txList);
    renderLimitIndicators();
  } else {
    // Default case: full render() handles everything (including prepending the
    // new row at the top for chronological_desc order).
    if (typeof render === "function") render();
  }
}

/**
 * Removes the transaction with the given id from AppState and localStorage.
 * If the localStorage write fails the deletion is rolled back and the user
 * is notified — the list remains in its pre-deletion state.
 *
 * @param {string} id - The id of the transaction to remove.
 * @returns {void}
 */
function deleteTransaction(id) {
  const index = AppState.transactions.findIndex((t) => t.id === id);
  if (index === -1) return; // Transaction not found — nothing to do.

  // Snapshot current list so we can roll back on storage failure.
  const snapshot = [...AppState.transactions];

  // Remove the transaction from in-memory state.
  AppState.transactions.splice(index, 1);

  // Attempt to persist the change directly so we can detect and handle failure.
  try {
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(AppState.transactions)
    );
  } catch (e) {
    // Storage write failed — roll back to the pre-deletion state.
    AppState.transactions = snapshot;
    showNotification(
      "Could not save changes. The transaction was not deleted.",
      "error"
    );
    if (typeof render === "function") render();
    return;
  }

  if (typeof render === "function") render();
}

/**
 * Validates and adds a custom category to AppState, persists the updated
 * category list, and refreshes all category `<select>` elements.
 * Silently returns if the name is invalid or the maximum limit is reached.
 *
 * @param {string} name - The proposed custom category name.
 * @returns {void}
 */
function addCustomCategory(name) {
  const validation = validateCategoryName(name);
  if (!validation.valid) return;

  // Guard against exceeding the maximum number of custom categories.
  if (AppState.customCategories.length >= VALIDATION.MAX_CUSTOM_CATEGORIES) return;

  AppState.customCategories.push(name.trim());
  saveCategories();

  if (typeof renderCategorySelects === "function") renderCategorySelects();

  // Enforce the custom category cap in the UI (Req 7.6).
  // Guard: only call when the DOM is ready.
  if (document.getElementById("custom-category-name")) {
    updateCustomCategoryFormState();
  }
}

/**
 * Sets a spending limit for a given category, persists it, and refreshes
 * the over-limit indicators in the transaction list.
 *
 * @param {string} category - A category name that must exist in allCategories().
 * @param {string|number} amount - The limit amount (0.01–999,999,999.99, ≤ 2 dp).
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
function setSpendingLimit(category, amount) {
  // ── Category validation ──────────────────────────────────────────────────
  if (typeof category !== "string" || category.trim() === "") {
    return { valid: false, error: "Category is required." };
  }
  if (!allCategories().includes(category)) {
    return { valid: false, error: "Please select a valid category." };
  }

  // ── Amount validation ────────────────────────────────────────────────────
  const parsed = parseFloat(amount);

  if (amount === "" || amount === null || amount === undefined || isNaN(parsed)) {
    return { valid: false, error: "Spending limit must be a valid number." };
  }
  if (parsed < VALIDATION.AMOUNT_MIN || parsed > VALIDATION.AMOUNT_MAX) {
    return {
      valid: false,
      error: `Spending limit must be between ${VALIDATION.AMOUNT_MIN} and ${VALIDATION.AMOUNT_MAX.toLocaleString()}.`,
    };
  }
  if (Math.round(parsed * 100) / 100 !== parsed) {
    return { valid: false, error: "Spending limit must have no more than 2 decimal places." };
  }

  // ── Apply and persist ────────────────────────────────────────────────────
  AppState.limits[category] = Math.round(parsed * 100) / 100;
  saveLimits();

  if (typeof renderLimitIndicators === "function") renderLimitIndicators();

  return { valid: true };
}

// ─── Filtering & Aggregation ──────────────────────────────────────────────────

/**
 * Returns a filtered and sorted copy of AppState.transactions.
 *
 * Filtering: if AppState.activeMonth is a "YYYY-MM" string, only transactions
 * whose timestamp falls in that calendar month are included.
 *
 * Sorting: determined by AppState.sortOption. Ties on all non-chronological
 * sorts are broken by timestamp descending.
 *
 * @returns {Transaction[]}
 */
function getFilteredTransactions() {
  // 1. Filter by active month if one is selected.
  let list = AppState.transactions;
  if (AppState.activeMonth) {
    list = list.filter((t) => {
      const d = new Date(t.timestamp);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}` === AppState.activeMonth;
    });
  }

  // 2. Sort — always return a new array to avoid mutating AppState.
  return [...list].sort((a, b) => {
    switch (AppState.sortOption) {
      case SORT.AMOUNT_ASC:
        return a.amount !== b.amount
          ? a.amount - b.amount
          : b.timestamp - a.timestamp;

      case SORT.AMOUNT_DESC:
        return a.amount !== b.amount
          ? b.amount - a.amount
          : b.timestamp - a.timestamp;

      case SORT.CATEGORY_AZ:
        if (a.category < b.category) return -1;
        if (a.category > b.category) return  1;
        return b.timestamp - a.timestamp;

      case SORT.CHRONOLOGICAL_DESC:
      default:
        return b.timestamp - a.timestamp;
    }
  });
}

/**
 * Computes per-category spending totals for the supplied transaction list.
 * Math.round is used to prevent floating-point accumulation errors.
 *
 * @param {Transaction[]} txList
 * @returns {Record<string, number>} Map of category name → total amount
 */
function getCategoryTotals(txList) {
  const totals = {};
  for (const t of txList) {
    totals[t.category] = Math.round(((totals[t.category] ?? 0) + t.amount) * 100) / 100;
  }
  return totals;
}

/**
 * Returns true if the total amount spent in `category` (across ALL
 * transactions, not just the filtered view) exceeds the defined spending
 * limit for that category.
 *
 * Returns false when no limit is defined for the category.
 *
 * @param {string} category
 * @returns {boolean}
 */
function isOverLimit(category) {
  const limit = AppState.limits[category];
  if (limit === undefined || limit === null) return false;

  const totals = getCategoryTotals(AppState.transactions);
  const total  = totals[category] ?? 0;
  return total > limit;
}

// ─── Render: Balance Display ──────────────────────────────────────────────────

/**
 * Calculates the sum of all transaction amounts in `txList` and writes the
 * result to `#balance-display`, formatted to exactly 2 decimal places.
 *
 * Precision strategy: accumulate using integer cents (×100) and divide at the
 * end to avoid floating-point drift across large transaction lists.
 *
 * @param {Transaction[]} txList - The currently displayed (filtered) transactions.
 */
function renderBalance(txList) {
  const el = document.getElementById("balance-display");
  if (!el) return;

  // Accumulate in integer cents to avoid floating-point drift.
  const totalCents = txList.reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
  const total = totalCents / 100;

  el.textContent = total.toFixed(2); // Always 2 decimal places (Req 4.1).
}

// ─── Render: Transaction List ─────────────────────────────────────────────────

/**
 * Clears and fully rebuilds the `#transaction-list` `<ul>` from `txList`.
 *
 * Each `<li>` row contains:
 *   - Item name
 *   - Amount formatted to exactly 2 decimal places
 *   - Category label
 *   - Delete button with `data-id` attribute for event-delegated deletion
 *
 * The `.over-limit` CSS class is applied to rows whose category currently
 * exceeds its defined spending limit (only when a limit is actually set).
 * When `txList` is empty, an empty-state message is shown instead (Req 2.5).
 *
 * @param {Transaction[]} txList - The currently displayed (filtered) transactions.
 */
function renderTransactionList(txList) {
  const list = document.getElementById("transaction-list");
  if (!list) return;

  // Clear all existing children.
  list.innerHTML = "";

  // ── Empty state ───────────────────────────────────────────────────────────
  if (txList.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.id = "empty-state-msg";
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No transactions recorded yet. Add one above to get started.";
    list.appendChild(emptyItem);
    return;
  }

  // ── Build one <li> per transaction ────────────────────────────────────────
  for (const tx of txList) {
    const li = document.createElement("li");
    li.className = "transaction-item";
    li.dataset.id = tx.id;

    // Apply over-limit highlight when the category has a limit and it is exceeded.
    if (isOverLimit(tx.category)) {
      li.classList.add("over-limit");
    }

    // ── Item name ─────────────────────────────────────────────────────────
    const nameEl = document.createElement("span");
    nameEl.className = "tx-name";
    nameEl.textContent = tx.name;

    // ── Amount (exactly 2 decimal places) ────────────────────────────────
    const amountEl = document.createElement("span");
    amountEl.className = "tx-amount";
    amountEl.textContent = (Math.round(tx.amount * 100) / 100).toFixed(2);

    // ── Category label ────────────────────────────────────────────────────
    const categoryEl = document.createElement("span");
    categoryEl.className = "tx-category";
    categoryEl.textContent = tx.category;

    // ── Delete button ─────────────────────────────────────────────────────
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-delete";
    deleteBtn.dataset.id = tx.id;
    deleteBtn.setAttribute("aria-label", `Delete transaction: ${tx.name}`);
    deleteBtn.textContent = "Delete";

    // ── Assemble row ──────────────────────────────────────────────────────
    li.appendChild(nameEl);
    li.appendChild(amountEl);
    li.appendChild(categoryEl);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }
}

// ─── Render: Chart ────────────────────────────────────────────────────────────

/**
 * Renders (or updates) a Chart.js pie chart inside `#chart-canvas` showing
 * per-category spending totals for the supplied transaction list.
 *
 * Behavior overview:
 *  - CDN failure (Chart undefined): renders a plain-text fallback list and returns.
 *  - Empty `txList`: shows a placeholder message, destroys any existing chart, returns.
 *  - First call: creates a new Chart instance and stores it in AppState._chartInstance.
 *  - Subsequent calls: mutates the existing chart's data arrays and calls chart.update()
 *    to avoid canvas memory leaks and keep transitions smooth.
 *  - Canvas removed from DOM: destroys the stale instance and recreates.
 *
 * Color assignment (Req 5.5): each category is mapped to CHART_PALETTE[index % len]
 * using its index in allCategories(), giving stable, unique colors across renders.
 * Over-limit categories (Req 10.4) use CHART_OVER_LIMIT_COLOR instead.
 *
 * @param {import('./app.js').Transaction[]} txList - Filtered transactions to display.
 */
function renderChart(txList) {
  const section   = document.getElementById("chart-section");
  const canvas    = document.getElementById("chart-canvas");
  const container = canvas ? canvas.parentElement : section;

  // ── Helper: show placeholder text and clean up any chart instance ──────────
  function showChartPlaceholder(message) {
    // Destroy any existing Chart instance cleanly.
    if (AppState._chartInstance) {
      try { AppState._chartInstance.destroy(); } catch (_) { /* ignore */ }
      AppState._chartInstance = null;
    }

    // Show the placeholder paragraph that already exists in the HTML, or inject
    // a temporary one if it has been removed.
    let placeholder = document.getElementById("chart-placeholder");
    if (!placeholder && container) {
      placeholder = document.createElement("p");
      placeholder.id = "chart-placeholder";
      placeholder.className = "chart-placeholder";
      placeholder.setAttribute("aria-live", "polite");
      container.appendChild(placeholder);
    }
    if (placeholder) {
      placeholder.textContent = message;
      placeholder.style.display = "";
    }

    // Make the canvas invisible so the placeholder is the only thing shown.
    if (canvas) canvas.style.display = "none";
  }

  // ── Guard 1: Chart.js CDN failed to load ──────────────────────────────────
  if (typeof Chart === "undefined") {
    console.warn("renderChart: Chart.js is not available (CDN failure). Rendering text fallback.");

    if (!container) return;

    // Clear the container and render a plain-text summary.
    container.innerHTML = "";

    const heading = document.createElement("p");
    heading.className = "chart-fallback-message";
    heading.textContent = "Chart unavailable. Spending summary:";
    container.appendChild(heading);

    const totals = getCategoryTotals(txList);
    const entries = Object.entries(totals);

    if (entries.length === 0) {
      const none = document.createElement("p");
      none.className = "chart-placeholder";
      none.textContent = "No spending data to display.";
      container.appendChild(none);
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "chart-fallback-list";
    for (const [cat, total] of entries) {
      const li = document.createElement("li");
      li.textContent = `${cat}: $${total.toFixed(2)}`;
      ul.appendChild(li);
    }
    container.appendChild(ul);
    return;
  }

  // ── Guard 2: No transactions — show placeholder ───────────────────────────
  const totals  = getCategoryTotals(txList);
  const entries = Object.entries(totals).filter(([, v]) => v > 0);

  if (txList.length === 0 || entries.length === 0) {
    showChartPlaceholder("No spending data to display.");
    return;
  }

  // ── Data arrays for Chart.js ──────────────────────────────────────────────
  const categories = allCategories();
  const labels     = entries.map(([cat])   => cat);
  const data       = entries.map(([, val]) => val);
  const colors     = entries.map(([cat])   => {
    if (isOverLimit(cat)) return CHART_OVER_LIMIT_COLOR;
    const idx = categories.indexOf(cat);
    return CHART_PALETTE[(idx === -1 ? 0 : idx) % CHART_PALETTE.length];
  });

  // ── Hide placeholder, show canvas ─────────────────────────────────────────
  const placeholder = document.getElementById("chart-placeholder");
  if (placeholder) placeholder.style.display = "none";
  if (canvas) canvas.style.display = "";

  // ── Guard 3: canvas was removed from DOM — destroy stale instance ─────────
  if (AppState._chartInstance && (!canvas || !canvas.isConnected)) {
    try { AppState._chartInstance.destroy(); } catch (_) { /* ignore */ }
    AppState._chartInstance = null;
  }

  // ── First render: create Chart instance ──────────────────────────────────
  if (!AppState._chartInstance) {
    if (!canvas) {
      console.warn("renderChart: #chart-canvas element not found in DOM.");
      return;
    }

    AppState._chartInstance = new Chart(canvas, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth:      2,
          borderColor:      "rgba(255, 255, 255, 0.6)",
          hoverOffset:      8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels:   { padding: 16, boxWidth: 14 },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const value = ctx.parsed;
                return ` ${ctx.label}: $${value.toFixed(2)}`;
              },
            },
          },
        },
      },
    });
    return;
  }

  // ── Subsequent renders: mutate existing chart data in-place ───────────────
  const chart = AppState._chartInstance;
  chart.data.labels                        = labels;
  chart.data.datasets[0].data             = data;
  chart.data.datasets[0].backgroundColor  = colors;
  chart.update();
}

// ─── Render: Limit Section ───────────────────────────────────────────────────

/**
 * Dynamically renders one numeric input per category inside `#limit-section`
 * so the user can set or update per-category spending limits (Req 10.1, Task 7.1).
 *
 * Layout per category:
 *   <div class="limit-row">
 *     <label>Food</label>
 *     <input type="number" data-limit-for="Food" value="...">
 *     <span class="field-error" aria-live="polite"></span>
 *   </div>
 *
 * Existing input values are preserved when the list is rebuilt so that a
 * mid-edit value isn't lost if `renderCategorySelects()` is called.
 *
 * Called from `renderCategorySelects()` whenever the category list changes
 * (e.g. after a custom category is added).
 */
function renderLimitSection() {
  const section = document.getElementById("limit-section");
  if (!section) return;

  const categories = allCategories();

  // Remove all existing limit rows (but keep the static label/hint elements).
  const existingRows = section.querySelectorAll(".limit-row");
  existingRows.forEach((row) => row.remove());

  for (const cat of categories) {
    const row = document.createElement("div");
    row.className = "limit-row";

    const label = document.createElement("label");
    label.textContent = cat;
    label.setAttribute("for", `limit-input-${CSS.escape(cat)}`);

    const input = document.createElement("input");
    input.type = "number";
    input.id = `limit-input-${CSS.escape(cat)}`;
    input.dataset.limitFor = cat;
    input.min = String(VALIDATION.AMOUNT_MIN);
    input.max = String(VALIDATION.AMOUNT_MAX);
    input.step = "0.01";
    input.placeholder = "No limit";
    input.setAttribute("aria-label", `Spending limit for ${cat}`);
    input.setAttribute("aria-describedby", `limit-error-${CSS.escape(cat)}`);

    // Pre-populate with the currently saved limit value if one exists.
    if (AppState.limits[cat] !== undefined) {
      input.value = String(AppState.limits[cat]);
    }

    const errorEl = document.createElement("span");
    errorEl.id = `limit-error-${CSS.escape(cat)}`;
    errorEl.className = "field-error";
    errorEl.setAttribute("role", "alert");
    errorEl.setAttribute("aria-live", "polite");

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(errorEl);
    section.appendChild(row);
  }
}

// ─── Render: Limit Indicators ─────────────────────────────────────────────────

/**
 * Scans every transaction row in `#transaction-list` and toggles the
 * `.over-limit` CSS class based on whether the row's category currently
 * exceeds its defined spending limit.
 *
 * This function is called by `setSpendingLimit()` and `render()` so that
 * limit indicators stay in sync whenever limits change or transactions are
 * added/deleted, without requiring a full list rebuild.
 *
 * Behavior per requirement:
 *  - Req 10.3: rows whose category total > limit receive `.over-limit`.
 *  - Req 10.5: rows whose category total ≤ limit have `.over-limit` removed.
 *  - Req 10.6: rows with no limit defined never receive `.over-limit`.
 *
 * Category identity is read from the `.tx-category` child span of each row,
 * matching the structure built by `renderTransactionList`.
 */
function renderLimitIndicators() {
  const list = document.getElementById("transaction-list");
  if (!list) return;

  // Collect all transaction <li> rows.
  const rows = list.querySelectorAll("li.transaction-item");

  rows.forEach((row) => {
    // Read the category from the text content of the .tx-category child span.
    const categoryEl = row.querySelector(".tx-category");
    if (!categoryEl) return;

    const category = categoryEl.textContent.trim();

    if (isOverLimit(category)) {
      row.classList.add("over-limit");
    } else {
      // Covers both "within limit" (Req 10.5) and "no limit defined" (Req 10.6).
      row.classList.remove("over-limit");
    }
  });
}

// ─── Render: Dispatcher ───────────────────────────────────────────────────────

/**
 * Central render dispatcher. Computes the currently visible transaction list
 * once (applying month filter and active sort) then fans out to every render
 * function so each component receives the same filtered data.
 *
 * Called after every state-mutating operation (add, delete, filter, sort, limit).
 */
function render() {
  const txList = getFilteredTransactions();
  renderBalance(txList);
  renderTransactionList(txList);
  renderChart(txList);
  renderLimitIndicators();
}

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * Detects the operating-system preferred color scheme using the
 * `prefers-color-scheme` media query.
 *
 * Returns `"dark"` when the OS is in dark mode, `"light"` otherwise.
 * If `window.matchMedia` is unavailable (Req 11.6), defaults to `"light"`.
 *
 * @returns {"light"|"dark"}
 */
function detectSystemTheme() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  } catch (_) {
    return "light";
  }
}

/**
 * Applies the given theme to the document and persists the preference.
 *
 * Steps:
 *  1. Sets `document.body.dataset.theme` so CSS custom properties kick in.
 *  2. Updates `AppState.theme` and calls `saveTheme()` (Req 11.3).
 *  3. If a Chart.js instance exists, updates its legend label color to
 *     match the new theme for legibility and calls `chart.update()`.
 *
 * @param {"light"|"dark"} theme
 */
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  AppState.theme = theme;
  saveTheme();

  // Keep chart legend/tooltip colors readable in both themes (Req 11.2).
  if (AppState._chartInstance) {
    const labelColor = theme === "dark" ? "#f0f0f0" : "#111111";
    AppState._chartInstance.options.plugins.legend.labels.color = labelColor;
    AppState._chartInstance.update();
  }
}

// ─── Custom Category Form State ──────────────────────────────────────────────

/**
 * Enforces the 20-custom-category maximum by disabling or re-enabling the
 * custom category form controls and showing/hiding the max-reached message.
 *
 * Safe to call at any time (page load, after add, after storage restore).
 * Guards against a missing DOM to allow calls from non-DOM contexts.
 *
 * Req 7.6.
 */
function updateCustomCategoryFormState() {
  const nameInput = document.getElementById("custom-category-name");
  if (!nameInput) return; // DOM not ready — skip silently.

  const submitBtn = document.querySelector("#custom-category-form button[type='submit']");
  const errorEl   = document.getElementById("custom-category-error");

  // Get or create the max-reached message element.
  let maxMsg = document.getElementById("custom-category-max-msg");
  if (!maxMsg) {
    maxMsg = document.createElement("p");
    maxMsg.id = "custom-category-max-msg";
    maxMsg.className = "field-error";
    if (errorEl) {
      errorEl.insertAdjacentElement("afterend", maxMsg);
    } else {
      const catForm = document.getElementById("custom-category-form");
      if (catForm) catForm.appendChild(maxMsg);
    }
  }

  const atMax = AppState.customCategories.length >= VALIDATION.MAX_CUSTOM_CATEGORIES;

  nameInput.disabled = atMax;
  if (submitBtn) submitBtn.disabled = atMax;
  maxMsg.textContent = atMax ? "Maximum of 20 custom categories reached." : "";
}

// ─── Initialisation & Event Listeners ────────────────────────────────────────

/**
 * Wires all DOM event listeners and bootstraps the application on
 * `DOMContentLoaded`. This function must be called synchronously at
 * module/script level so the handler is registered before the event fires.
 *
 * Event wiring summary:
 *  A. `#transaction-form`        → validate → addTransaction
 *  B. `#transaction-list`        → event-delegated delete
 *  C. `#custom-category-form`    → validate → addCustomCategory
 *  D. `#month-input` change      → filter by month
 *  E. `#clear-month-btn` click   → clear month filter
 *  F. `#sort-select` change      → re-sort list
 *  G. `#limit-section` change    → event-delegated setSpendingLimit
 *  H. `#theme-toggle` click      → toggle light/dark theme
 */
function init() {

  // ── A. Transaction form submit ─────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    const txForm = document.getElementById("transaction-form");
    if (txForm) {
      txForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name     = document.getElementById("tx-name")?.value     ?? "";
        const amount   = document.getElementById("tx-amount")?.value   ?? "";
        const category = document.getElementById("tx-category")?.value ?? "";

        // Clear previous inline errors before re-validating.
        ["name", "amount", "category"].forEach((field) => {
          const el = document.getElementById(`tx-${field}-error`);
          if (el) el.textContent = "";
        });

        const result = validateTransactionInput({ name, amount, category });

        if (!result.valid) {
          // Surface each field-level error adjacent to its input.
          for (const [field, message] of Object.entries(result.errors)) {
            const el = document.getElementById(`tx-${field}-error`);
            if (el) el.textContent = message;
          }
          return;
        }

        addTransaction({ name, amount, category });
        txForm.reset();
      });
    }

    // ── B. Transaction list delete (event delegation) ────────────────────────
    const txList = document.getElementById("transaction-list");
    if (txList) {
      txList.addEventListener("click", (e) => {
        if (e.target.matches(".btn-delete") && e.target.dataset.id) {
          deleteTransaction(e.target.dataset.id);
        }
      });
    }

    // ── C. Custom category form submit ───────────────────────────────────────
    const catForm = document.getElementById("custom-category-form");
    if (catForm) {
      catForm.addEventListener("submit", (e) => {
        e.preventDefault();

        // The HTML uses id="custom-category-name" for the text input.
        const nameInput = document.getElementById("custom-category-name");
        const errorEl   = document.getElementById("custom-category-error");
        const name      = nameInput?.value ?? "";

        if (errorEl) errorEl.textContent = "";

        const result = validateCategoryName(name);
        if (!result.valid) {
          if (errorEl) errorEl.textContent = result.error;
          return;
        }

        addCustomCategory(name);
        catForm.reset();

        // Enforce the 20-category maximum UI lock (Req 7.6).
        updateCustomCategoryFormState();
      });
    }

    // ── D. Month input change ─────────────────────────────────────────────────
    const monthInput = document.getElementById("month-input");
    if (monthInput) {
      monthInput.addEventListener("change", (e) => {
        AppState.activeMonth = e.target.value || null;
        render();
      });

      // Default the month selector to the current calendar month (Req 8.1).
      const now    = new Date();
      const year   = now.getFullYear();
      const month  = String(now.getMonth() + 1).padStart(2, "0");
      monthInput.value = `${year}-${month}`;

      // Also set the initial active month filter to match the default value.
      AppState.activeMonth = monthInput.value;
    }

    // ── E. Clear month filter button ──────────────────────────────────────────
    const clearMonthBtn = document.getElementById("clear-month-btn");
    if (clearMonthBtn) {
      clearMonthBtn.addEventListener("click", () => {
        AppState.activeMonth = null;
        if (monthInput) monthInput.value = "";
        render();
      });
    }

    // ── F. Sort select change ─────────────────────────────────────────────────
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        AppState.sortOption = e.target.value;
        render();
      });
    }

    // ── G. Spending limit inputs (event delegation on #limit-section) ─────────
    const limitSection = document.getElementById("limit-section");
    if (limitSection) {
      limitSection.addEventListener("change", (e) => {
        if (e.target.matches("input[data-limit-for]")) {
          const category = e.target.dataset.limitFor;
          const amount   = e.target.value;

          // Find the adjacent error span (placed right after the input in HTML).
          const errorEl = e.target.nextElementSibling;

          const result = setSpendingLimit(category, amount);

          if (!result.valid) {
            if (errorEl) errorEl.textContent = result.error;
            return;
          }

          if (errorEl) errorEl.textContent = "";
        }
      });
    }

    // ── H. Theme toggle click ─────────────────────────────────────────────────
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const newTheme = AppState.theme === "dark" ? "light" : "dark";
        applyTheme(newTheme);

        // Update the button's accessible label and visible text to reflect the
        // new state (Req 11.2 — all UI components updated, including the toggle).
        const isDark = newTheme === "dark";
        themeToggle.setAttribute(
          "aria-label",
          isDark ? "Switch to light mode" : "Switch to dark mode"
        );
        themeToggle.setAttribute("aria-pressed", String(isDark));

        const iconEl  = themeToggle.querySelector(".theme-icon");
        const labelEl = themeToggle.querySelector(".theme-label");
        if (iconEl)  iconEl.textContent  = isDark ? "☀️" : "🌙";
        if (labelEl) labelEl.textContent = isDark ? "Light Mode" : "Dark Mode";
      });
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    loadFromStorage();

    // Use saved theme preference; fall back to OS preference if none is stored.
    const savedTheme = AppState.theme || detectSystemTheme();
    applyTheme(savedTheme);

    // Sync the toggle button label/icon with whichever theme was applied.
    if (themeToggle) {
      const isDark  = savedTheme === "dark";
      themeToggle.setAttribute("aria-label",  isDark ? "Switch to light mode" : "Switch to dark mode");
      themeToggle.setAttribute("aria-pressed", String(isDark));
      const iconEl  = themeToggle.querySelector(".theme-icon");
      const labelEl = themeToggle.querySelector(".theme-label");
      if (iconEl)  iconEl.textContent  = isDark ? "☀️" : "🌙";
      if (labelEl) labelEl.textContent = isDark ? "Light Mode" : "Dark Mode";
    }

    renderCategorySelects();
    updateCustomCategoryFormState();
    render();
  });
}

// Start the application.
init();

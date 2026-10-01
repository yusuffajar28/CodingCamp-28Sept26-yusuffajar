# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side single-page expense tracker using plain HTML, CSS, and Vanilla JavaScript. The app is composed of exactly three files: `index.html`, `css/style.css`, and `js/app.js`. All state lives in a single `AppState` object and is persisted to `localStorage`. Chart.js is loaded via CDN. Tasks are ordered so each step is immediately runnable and verifiable in the browser.

## Tasks

- [x] 1. Scaffold HTML structure and CSS baseline
  - [x] 1.1 Create `index.html` with semantic sections and all required element IDs
    - Add `<header>` with `#balance-display` and `#theme-toggle`
    - Add `<main>` with `#input-section`, `#controls-section`, `#chart-section`, `#list-section`
    - Inside `#input-section`: add `#transaction-form` and `#custom-category-form`
    - Inside `#controls-section`: add `#month-selector`, `#sort-controls`, `#limit-section`
    - Inside `#chart-section`: add `<canvas id="chart-canvas">`
    - Inside `#list-section`: add `#transaction-list`
    - Add `<div id="notification-area">` outside `<main>`
    - Include Chart.js CDN `<script>` tag before closing `</body>`
    - Include `<link>` to `css/style.css` and `<script src="js/app.js" defer>`
    - Set `<body data-theme="light">` attribute
    - _Requirements: 1.1, 2.1, 4.1, 5.1, TC-4_

  - [x] 1.2 Create `css/style.css` with layout, typography, and CSS custom properties for theming
    - Define `--color-bg`, `--color-surface`, `--color-text`, `--color-accent` custom properties on `[data-theme="light"]` and `[data-theme="dark"]`
    - Style header, main sections, form fields, buttons, and notification area
    - Make `#transaction-list` scrollable (`overflow-y: auto; max-height: ...`) without affecting page layout
    - Add `.over-limit` class with a distinct background/border color for over-limit transaction rows
    - Ensure minimum readable layout at 320px viewport width
    - _Requirements: 2.3, 10.3, 11.1, NFR-3_

  - [ ]* 1.3 Write property test scaffold for Property 4 (amount formatting)
    - Create `tests/index.html` test harness loading fast-check via CDN and `js/app.js` as a module
    - Create `tests/render.test.js` with a stub for P4; test can be extended once `app.js` exposes the format function
    - _Requirements: 2.2, 4.1_

- [x] 2. Implement AppState, constants, and persistence layer in `js/app.js`
  - [x] 2.1 Define constants and `AppState` object
    - Define `STORAGE_KEYS = { TRANSACTIONS, CATEGORIES, LIMITS, THEME }` with keys `ebv_transactions`, `ebv_categories`, `ebv_limits`, `ebv_theme`
    - Define `DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"]`
    - Define `SORT` enum constants: `CHRONOLOGICAL_DESC`, `AMOUNT_ASC`, `AMOUNT_DESC`, `CATEGORY_AZ`
    - Define `VALIDATION` constants: `MAX_NAME_LEN = 100`, `MAX_CATEGORY_LEN = 50`, `MAX_CUSTOM_CATEGORIES = 20`, `AMOUNT_MIN = 0.01`, `AMOUNT_MAX = 999999999.99`
    - Initialize `AppState` with empty `transactions`, `customCategories`, `limits`, `theme: "light"`, `activeMonth: null`, `sortOption: SORT.CHRONOLOGICAL_DESC`, `_chartInstance: null`
    - _Requirements: 6.1, 6.2, TC-2_

  - [x] 2.2 Implement persistence layer functions
    - Write `saveTransactions()`, `saveCategories()`, `saveLimits()`, `saveTheme()` — each wraps `localStorage.setItem` in `try/catch` and calls `showNotification` on failure
    - Write `loadFromStorage()` — reads all four keys, hydrates `AppState`, falls back to empty defaults on parse error, calls `showNotification` on read failure
    - Write `allCategories()` helper returning `[...DEFAULT_CATEGORIES, ...AppState.customCategories]`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.3, 7.4, TC-2_

  - [ ]* 2.3 Write property test for Property 5 (transaction persistence round-trip)
    - In `tests/persistence.test.js`, use `fc.array(transactionArb)` to verify `saveTransactions` → `loadFromStorage` round-trip preserves all fields
    - Tag: `// Feature: expense-budget-visualizer, Property 5: Transaction persistence round-trip`
    - _Requirements: 2.4, 6.1, 6.2, 6.3_

  - [ ]* 2.4 Write property test for Property 11 (category persistence round-trip)
    - In `tests/persistence.test.js`, use `fc.array(fc.string({minLength:1, maxLength:50}), {maxLength:20})` to verify `saveCategories` → `loadFromStorage` round-trip
    - Tag: `// Feature: expense-budget-visualizer, Property 11: Custom category persistence round-trip`
    - _Requirements: 7.3, 7.4_

  - [ ]* 2.5 Write property test for Property 17 (spending limit persistence round-trip)
    - In `tests/persistence.test.js`, use `fc.dictionary(fc.string(), fc.float({min:0.01}))` to verify `saveLimits` → `loadFromStorage` round-trip
    - Tag: `// Feature: expense-budget-visualizer, Property 17: Spending limit persistence round-trip`
    - _Requirements: 10.7_

- [x] 3. Implement validation and business logic functions
  - [x] 3.1 Implement `validateTransactionInput(data)`
    - Return `{ valid: true }` or `{ valid: false, errors: { name?, amount?, category? } }` per validation rules
    - Name: non-empty, ≤ 100 chars
    - Amount: parseable float, 0.01–999,999,999.99, ≤ 2 decimal places (check with `Math.round(x * 100) / 100 === x`)
    - Category: must exist in `allCategories()`
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Implement `validateCategoryName(name)`
    - Return `{ valid: true }` or `{ valid: false, error: string }` with specific reason message
    - Reject empty, > 50 chars, case-insensitive duplicate against `allCategories()`
    - _Requirements: 7.5_

  - [x] 3.3 Implement `addTransaction(data)`, `deleteTransaction(id)`, `addCustomCategory(name)`, `setSpendingLimit(category, amount)`
    - `addTransaction`: generate UUID (`crypto.randomUUID()` with `Date.now()+Math.random()` fallback), push to `AppState.transactions`, call `saveTransactions()`, call `render()`
    - `deleteTransaction`: snapshot list before deletion for rollback, splice target, call `saveTransactions()` — on failure restore snapshot and show notification, then call `render()`
    - `addCustomCategory`: validate, push to `AppState.customCategories`, call `saveCategories()`, call `renderCategorySelects()`
    - `setSpendingLimit`: validate amount, set `AppState.limits[category]`, call `saveLimits()`, call `renderLimitIndicators()`
    - _Requirements: 1.2, 1.5, 3.2, 3.5, 7.2, 10.1, 10.2_

  - [x] 3.4 Implement `getFilteredTransactions()` and `getCategoryTotals(txList)`
    - `getFilteredTransactions`: filter `AppState.transactions` by `AppState.activeMonth` ("YYYY-MM") if set; apply sort per `AppState.sortOption`; tiebreaker is timestamp descending
    - `getCategoryTotals(txList)`: return `Record<string, number>` summing amounts by category
    - Implement `isOverLimit(category)`: compare `getCategoryTotals(AppState.transactions)[category] > AppState.limits[category]`
    - _Requirements: 8.2, 9.1, 9.2, 9.3, 9.5, 10.3_

  - [ ]* 3.5 Write property test for Property 1 (valid add grows list)
    - In `tests/transactions.test.js`, use `fc.record(...)` arbitrary for valid transaction data; assert list length increases by 1 and new entry is present
    - Tag: `// Feature: expense-budget-visualizer, Property 1: Valid transaction addition grows the list`
    - _Requirements: 1.2_

  - [ ]* 3.6 Write property test for Property 2 (invalid input rejected)
    - In `tests/validation.test.js`, use `fc.oneof` to generate inputs violating each rule; assert `validateTransactionInput` returns `valid: false` and list is unchanged
    - Tag: `// Feature: expense-budget-visualizer, Property 2: Invalid transaction input is rejected`
    - _Requirements: 1.3, 1.4_

  - [ ]* 3.7 Write property test for Property 6 (deletion removes exactly the target)
    - In `tests/transactions.test.js`, use `fc.array(transactionArb, {minLength:1})`; assert the deleted id is absent, all others intact, localStorage updated
    - Tag: `// Feature: expense-budget-visualizer, Property 6: Deletion removes exactly the target transaction`
    - _Requirements: 3.2_

  - [ ]* 3.8 Write property test for Property 12 (invalid category names rejected)
    - In `tests/validation.test.js`, generate empty strings, strings > 50 chars, and duplicates; assert `validateCategoryName` returns error and `customCategories` is unchanged
    - Tag: `// Feature: expense-budget-visualizer, Property 12: Invalid category names are rejected`
    - _Requirements: 7.5_

  - [ ]* 3.9 Write property test for Property 3 (default sort is reverse chronological)
    - In `tests/sort.test.js`, use `fc.array(transactionArb, {minLength:2})` with distinct timestamps; assert each element's timestamp ≥ next element's timestamp
    - Tag: `// Feature: expense-budget-visualizer, Property 3: Default sort is reverse chronological`
    - _Requirements: 2.1, 9.5_

  - [ ]* 3.10 Write property test for Property 15 (sort ordering correct for each option)
    - In `tests/sort.test.js`, use `fc.array(transactionArb, {minLength:2})` + `fc.constantFrom(...Object.values(SORT))`; assert full ordering per sort criterion with timestamp tiebreaker
    - Tag: `// Feature: expense-budget-visualizer, Property 15: Sort ordering is correct for each option`
    - _Requirements: 9.2, 9.3_

  - [ ]* 3.11 Write property test for Property 13 (month filter correctness)
    - In `tests/filter.test.js`, use varied timestamps and a "YYYY-MM" arbitrary; assert only in-month transactions are returned
    - Tag: `// Feature: expense-budget-visualizer, Property 13: Month filter returns only in-month transactions`
    - _Requirements: 8.2, 8.6_

  - [ ]* 3.12 Write property test for Property 14 (clearing filter restores full list)
    - In `tests/filter.test.js`, set an active month, then set `activeMonth = null`; assert full list returned
    - Tag: `// Feature: expense-budget-visualizer, Property 14: Clearing month filter restores full list`
    - _Requirements: 8.5_

- [x] 4. Checkpoint — Core logic complete
  - Open `tests/index.html` in a browser and verify all property tests for persistence, validation, business logic, and filtering pass. Ask the user if any questions arise before continuing.

- [x] 5. Implement render functions and wire the UI
  - [x] 5.1 Implement `showNotification(message, type)` and `renderCategorySelects()`
    - `showNotification`: create a dismissible notification element in `#notification-area` with `type` class (`error`/`info`); persistent until user clicks dismiss
    - `renderCategorySelects`: populate all `<select>` elements for category (in `#transaction-form` and `#limit-section`) with current `allCategories()` options
    - _Requirements: 3.5, 6.4, 6.5, 7.7_

  - [x] 5.2 Implement `renderBalance(txList)` and `renderTransactionList(txList)`
    - `renderBalance`: sum `txList` amounts using `Math.round` for precision; display formatted to exactly 2 decimal places in `#balance-display`; display `0.00` for empty list
    - `renderTransactionList`: clear and rebuild `#transaction-list`; each row shows item name, amount (2 dp), category, and a delete button; apply `.over-limit` class to rows where `isOverLimit(transaction.category)` is true; show empty-state message when list is empty
    - Apply `.over-limit` indicator only when a spending limit is defined and exceeded (per `isOverLimit`)
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.1, 4.1, 4.2, 4.3, 4.4, 10.3, 10.6_

  - [ ]* 5.3 Write property test for Property 4 (amount formatting always 2 decimal places)
    - In `tests/render.test.js`, use `fc.float({min:0.01, max:999999999.99})` to generate valid amounts; assert each formatted string matches `/^\d+\.\d{2}$/`
    - Tag: `// Feature: expense-budget-visualizer, Property 4: Amount formatting is always two decimal places`
    - _Requirements: 2.2, 4.1_

  - [ ]* 5.4 Write property test for Property 7 (balance equals sum of displayed transactions)
    - In `tests/balance.test.js`, use `fc.array(transactionArb)` and compare `renderBalance` output against `transactions.reduce((s,t) => s + t.amount, 0)` rounded to 2 dp
    - Tag: `// Feature: expense-budget-visualizer, Property 7: Balance equals sum of displayed transactions`
    - _Requirements: 3.3, 4.1, 4.4_

  - [x] 5.5 Implement `renderChart(txList)`
    - If `Chart` is undefined (CDN failure): display a text fallback of category totals inside the chart section; return
    - On first call: create a `Chart` instance on `#chart-canvas` of type `"pie"`, store in `AppState._chartInstance`
    - On subsequent calls: update `chart.data.labels`, `chart.data.datasets[0].data`, and `chart.data.datasets[0].backgroundColor`; call `chart.update()`
    - Assign colors from a fixed palette array using `allCategories().indexOf(category)` for stable, unique color mapping
    - Show placeholder text in parent container when `txList` is empty
    - Mark over-limit category segments with a visually distinct color/pattern
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.4_

  - [ ]* 5.6 Write property test for Property 8 (chart data matches category totals)
    - In `tests/chart.test.js`, use `fc.array(transactionArb, {minLength:1})`; assert `chart.data.datasets[0].data` values equal `getCategoryTotals(txList)` values in the same order
    - Tag: `// Feature: expense-budget-visualizer, Property 8: Chart data matches category totals`
    - _Requirements: 3.4, 5.1, 10.4_

  - [ ]* 5.7 Write property test for Property 9 (chart legend colors are unique)
    - In `tests/chart.test.js`, use `fc.array(fc.string({minLength:1, maxLength:50}), {minLength:2})` as category names; assert no two entries in the backgroundColor array share the same value
    - Tag: `// Feature: expense-budget-visualizer, Property 9: Chart legend colors are unique`
    - _Requirements: 5.5_

  - [x] 5.8 Implement `renderLimitIndicators()`
    - For each category in `allCategories()`: call `isOverLimit(category)` and toggle the `.over-limit` CSS class on all matching transaction rows in `#transaction-list`
    - Remove `.over-limit` from rows where the category is within limit or has no limit defined
    - _Requirements: 10.3, 10.5, 10.6_

  - [ ]* 5.9 Write property test for Property 16 (over-limit indicator tracks threshold)
    - In `tests/limits.test.js`, use `fc.array(transactionArb, {minLength:1})` + `fc.float({min:0.01})`; assert `isOverLimit` returns `true` iff total > limit, and `.over-limit` class presence on rows matches
    - Tag: `// Feature: expense-budget-visualizer, Property 16: Over-limit indicator tracks the threshold`
    - _Requirements: 10.3, 10.5, 10.6_

  - [~] 5.10 Implement `render()` dispatcher, theme functions, and event listeners
    - `render()`: call `getFilteredTransactions()`, then call `renderBalance`, `renderTransactionList`, `renderChart`, `renderLimitIndicators` in sequence
    - `applyTheme(theme)`: set `document.body.dataset.theme = theme`; call `saveTheme()`; if `AppState._chartInstance` exists update its colors to match the theme
    - `detectSystemTheme()`: use `window.matchMedia("(prefers-color-scheme: dark)")` to detect OS preference; return `"dark"` or `"light"`; return `"light"` if `matchMedia` is unavailable
    - Wire event listeners in `init()`:
      - `#transaction-form` submit → validate → `addTransaction` or show inline errors
      - `#transaction-list` delete button click (event delegation) → `deleteTransaction(id)`
      - `#custom-category-form` submit → validate → `addCustomCategory` or show inline error
      - `#month-selector` change → set `AppState.activeMonth`; clear → set `null`; call `render()`
      - `#sort-controls` change → set `AppState.sortOption`; call `render()`
      - `#limit-section` inputs change → `setSpendingLimit(category, amount)` or show validation error
      - `#theme-toggle` click → toggle theme; call `applyTheme`
    - Call `loadFromStorage()` → `applyTheme(AppState.theme)` → `renderCategorySelects()` → `render()` on `DOMContentLoaded`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 7.1, 7.2, 7.5, 7.6, 8.1, 8.2, 8.5, 9.1, 10.1, 10.2, 11.1, 11.2, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 5.11 Write property test for Property 10 (custom category addition makes it available)
    - In `tests/categories.test.js`, use `fc.string({minLength:1, maxLength:50})` (deduplicated); call `addCustomCategory`; assert name appears in `allCategories()` and in the category `<select>` options
    - Tag: `// Feature: expense-budget-visualizer, Property 10: Custom category addition makes it available`
    - _Requirements: 7.2_

  - [ ]* 5.12 Write property test for Property 18 (theme application is exhaustive and stable)
    - In `tests/theme.test.js`, use `fc.constantFrom("light","dark")`; call `applyTheme` twice with same value; assert `document.body.dataset.theme` equals the value and `localStorage` entry matches; assert idempotence
    - Tag: `// Feature: expense-budget-visualizer, Property 18: Theme application is exhaustive and stable`
    - _Requirements: 11.2, 11.3, 11.4_

- [x] 6. Checkpoint — Full render pipeline wired
  - Load `index.html` in a browser. Add a few transactions, delete one, switch theme, add a custom category, set a month filter, and set a spending limit. Verify all components update as expected. Run `tests/index.html` and confirm all property tests still pass. Ask the user if questions arise.

- [ ] 7. Polish, edge cases, and custom-category limit enforcement
  - [x] 7.1 Add custom category limit enforcement and limit-section dynamic rendering
    - When `AppState.customCategories.length >= 20`: disable the custom category input and show the max-reached message per Req 7.6
    - Dynamically render one numeric input per category in `#limit-section`; populate with current `AppState.limits[category]` value if set; call `renderLimitIndicators()` on each input's change event
    - _Requirements: 7.6, 10.1_

  - [~] 7.2 Add sort insertion behavior and sort-on-empty handling
    - When a transaction is added while a non-default sort is active, insert the new row at the correct sorted position in the DOM rather than re-rendering the full list
    - When sort is changed with an empty list, store the sort option and apply it when the first transaction is added
    - _Requirements: 9.4, 9.6_

  - [ ] 7.3 Add month selector defaulting to current month and "clear filter" control
    - Initialize `#month-selector` to the current calendar month/year (`YYYY-MM`) on page load
    - Add a "Show All" button or equivalent clear control that sets `AppState.activeMonth = null` and calls `render()`
    - _Requirements: 8.1, 8.5_

  - [ ] 7.4 Finalize accessibility attributes and responsive layout
    - Add `aria-label` and `role` attributes to form fields, delete buttons, chart canvas, and notification area
    - Verify layout renders without horizontal scroll at 320px viewport width
    - Ensure theme toggle button has an accessible name and the current theme is reflected in its label
    - _Requirements: NFR-3, TC-3_

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Run `tests/index.html` and verify all 18 property tests pass with at least 100 iterations each. Open `index.html` and perform a full manual walkthrough: add transactions, delete, filter by month, sort, add custom category, set spending limits, toggle theme, reload page and verify localStorage restoration. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP — all core functionality is in the non-starred tasks
- Property tests live in `tests/` which is separate from the production `index.html`, `css/`, and `js/` directories, preserving TC-4
- Each task references the specific requirements and design properties it satisfies
- The `render()` dispatcher is synchronous, so all UI updates complete well within the 100 ms NFR-2 threshold
- `Math.round(x * 100) / 100` is used throughout to prevent floating-point precision drift

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4"] },
    { "id": 5, "tasks": ["3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2", "5.5"] },
    { "id": 8, "tasks": ["5.3", "5.4", "5.6", "5.7", "5.8"] },
    { "id": 9, "tasks": ["5.9", "5.10"] },
    { "id": 10, "tasks": ["5.11", "5.12"] },
    { "id": 11, "tasks": ["7.1", "7.2", "7.3", "7.4"] }
  ]
}
```

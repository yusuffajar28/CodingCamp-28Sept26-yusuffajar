# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, manage budget categories, and visualize spending patterns through interactive charts. The application runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with all data persisted in the browser's Local Storage. No backend server is required.

The application targets individuals who want a lightweight, zero-setup tool to monitor their daily or monthly spending without relying on cloud services or account registration.

## Glossary

- **Application**: The Expense & Budget Visualizer single-page web application
- **Transaction**: A single expense entry consisting of an item name, amount, category, and recorded timestamp
- **Category**: A classification label assigned to a transaction (e.g., Food, Transport, Fun, or a user-defined custom category)
- **Transaction_List**: The scrollable UI component that displays all recorded transactions
- **Input_Form**: The UI form component used to create new transactions
- **Balance_Display**: The UI component that shows the current total of all transaction amounts
- **Chart**: The pie chart visualization component that displays spending distribution by category
- **Local_Storage**: The browser's Web Storage API used to persist transaction data client-side
- **Monthly_Summary**: A filtered view showing transactions and totals for a specific calendar month
- **Spending_Limit**: A user-defined threshold amount per category above which spending is flagged visually
- **Theme**: The visual color scheme of the Application (light or dark mode)

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to enter expense details using a form, so that I can record my spending transactions.

#### Acceptance Criteria

1. THE Input_Form SHALL provide an item name text field (maximum 100 characters), an amount numeric field (accepting values between 0.01 and 999,999,999.99 with up to 2 decimal places), and a category selector field with at least the default options: Food, Transport, Fun.
2. WHEN the user submits the Input_Form with all fields filled, THE Application SHALL add a new Transaction to the Transaction_List.
3. WHEN the user submits the Input_Form with one or more empty fields, THE Input_Form SHALL display a validation error message adjacent to each invalid field and SHALL NOT add a Transaction.
4. WHEN the user submits the Input_Form with a value outside the range 0.01–999,999,999.99 or exceeding 2 decimal places in the amount field, THE Input_Form SHALL display a validation error message adjacent to the amount field and SHALL NOT add a Transaction.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty state.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored Transactions sorted by their recorded timestamp in reverse chronological order (most recent first).
2. THE Transaction_List SHALL display the item name, amount formatted to exactly 2 decimal places, and category for each Transaction.
3. WHILE the number of Transactions exceeds the visible area, THE Transaction_List SHALL remain scrollable without affecting the rest of the page layout.
4. WHEN the Application loads, THE Transaction_List SHALL render all Transactions previously saved in Local_Storage.
5. WHEN no Transactions exist, THE Transaction_List SHALL display an empty state message indicating no transactions have been recorded.

---

### Requirement 3: Transaction Deletion

**User Story:** As a user, I want to delete individual transactions, so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL display a delete control for each Transaction.
2. WHEN the user activates the delete control for a Transaction, THE Application SHALL remove that Transaction from the Transaction_List and from Local_Storage.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total.
4. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the new spending distribution.
5. IF a write to Local_Storage fails during deletion, THEN THE Application SHALL display an error notification informing the user that the deletion could not be saved, and SHALL revert the Transaction_List to its state before the deletion was attempted.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see the total amount of all my expenses at a glance, so that I can understand my overall spending.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all currently displayed Transaction amounts, formatted as a numeric value with exactly 2 decimal places, at the top of the Application.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update within 100 milliseconds to reflect the new total.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update within 100 milliseconds to reflect the revised total.
4. WHEN no Transactions exist, THE Balance_Display SHALL display a value of 0.00.

---

### Requirement 5: Spending Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand which categories consume the most of my budget.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart where each segment represents one Category that has at least one Transaction, and its segment size is proportional to the total amount spent in that Category relative to all displayed Transactions.
2. WHEN a new Transaction is added, THE Chart SHALL update automatically within 100 milliseconds to reflect the new spending distribution.
3. WHEN a Transaction is deleted, THE Chart SHALL update automatically within 100 milliseconds to reflect the revised spending distribution.
4. WHEN no Transactions exist, THE Chart SHALL display a placeholder message indicating no data is available.
5. THE Chart SHALL display a legend identifying each Category that has at least one Transaction by name and a unique color, with no two Categories sharing the same color.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my data when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE Application SHALL save the updated Transaction list to Local_Storage.
2. WHEN a Transaction is deleted, THE Application SHALL save the updated Transaction list to Local_Storage.
3. WHEN the Application loads, THE Application SHALL read all Transactions from Local_Storage and restore the Transaction_List, Balance_Display, and Chart to their last saved state.
4. IF Local_Storage is unavailable or a read from Local_Storage fails, THEN THE Application SHALL display an error notification informing the user that saved data could not be loaded, and the notification SHALL remain visible until dismissed by the user.
5. IF a write to Local_Storage fails, THEN THE Application SHALL display an error notification informing the user that the current changes could not be saved, and the notification SHALL remain visible until dismissed by the user.

---

### Requirement 7: Custom Categories

**User Story:** As a user, I want to define my own spending categories, so that I can organize transactions in a way that reflects my personal budget.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text input for the user to enter a new Category name of 1–50 characters beyond the default set (Food, Transport, Fun).
2. WHEN the user adds a valid custom Category, THE Application SHALL make that Category available for selection in the Input_Form category field.
3. WHEN the user adds a custom Category, THE Application SHALL persist the custom Category list to Local_Storage.
4. WHEN the Application loads, THE Application SHALL restore all previously saved custom Categories from Local_Storage.
5. IF the user submits an empty string, a string exceeding 50 characters, or a Category name that already exists (case-insensitive comparison), THEN THE Input_Form SHALL display a validation error message indicating the specific reason and SHALL NOT add the Category.
6. WHEN the user has added 20 custom Categories, THE Application SHALL disable the custom Category input and display a message indicating the maximum limit has been reached.
7. IF Local_Storage is unavailable when saving custom Categories, THEN THE Application SHALL display an error notification informing the user that custom categories could not be saved.

---

### Requirement 8: Monthly Summary View

**User Story:** As a user, I want to view a summary of transactions for a specific month, so that I can track how my spending changes over time.

#### Acceptance Criteria

1. THE Application SHALL provide a month selector control that allows the user to select a calendar month and year, defaulting to the current calendar month and year on initial load.
2. WHEN the user selects a month, THE Transaction_List SHALL filter to display only Transactions whose recorded timestamp falls within that selected calendar month and year.
3. WHEN the user selects a month, THE Balance_Display SHALL update to show the total of the filtered Transactions only.
4. WHEN the user selects a month, THE Chart SHALL update to show the distribution of Transactions by category for the filtered Transactions only.
5. WHEN the user clears the month filter, THE Application SHALL restore the Transaction_List, Balance_Display, and Chart to show all Transactions across all recorded dates.
6. IF the selected month contains no Transactions, THEN THE Application SHALL display the Transaction_List as empty, the Balance_Display as 0.00, and the Chart with a placeholder message indicating no data is available for that month.

---

### Requirement 9: Transaction Sorting

**User Story:** As a user, I want to sort my transaction list, so that I can find and compare transactions more easily.

#### Acceptance Criteria

1. THE Transaction_List SHALL provide sort controls allowing the user to sort Transactions by amount (ascending or descending) and by Category (alphabetical A–Z).
2. WHEN the user selects a sort option, THE Transaction_List SHALL reorder all currently displayed Transactions according to the selected sort criteria within 500 milliseconds.
3. WHEN two Transactions have identical values for the active sort field, THE Transaction_List SHALL order those Transactions by their recorded timestamp descending as a tiebreaker.
4. WHEN a new Transaction is added while a sort option is active, THE Transaction_List SHALL insert the new Transaction in the correct sorted position without resetting or reloading the full list.
5. WHEN the user selects no sort option, THE Transaction_List SHALL display Transactions in reverse chronological order (most recent first).
6. IF the Transaction_List contains no Transactions when a sort option is selected, THEN THE Transaction_List SHALL retain the selected sort option and apply it when Transactions become available.

---

### Requirement 10: Spending Limit Alerts

**User Story:** As a user, I want to set a spending limit per category, so that I can be notified when I exceed my intended budget for that category.

#### Acceptance Criteria

1. THE Application SHALL provide a numeric input control for the user to set a Spending_Limit amount (0.01–999,999,999.99) for each Category.
2. IF the user submits a Spending_Limit value that is not a positive number within the valid range, THEN THE Application SHALL display a validation error message adjacent to the input and SHALL NOT update the Spending_Limit.
3. WHEN the total Transaction amount for a Category exceeds the defined Spending_Limit for that Category, THE Transaction_List SHALL apply a distinct visual indicator (such as a colored border or background highlight) to all Transactions belonging to that Category.
4. WHEN the total Transaction amount for a Category exceeds the defined Spending_Limit, THE Chart SHALL render the over-limit segment using a visually distinct color or pattern that differentiates it from compliant segments.
5. WHEN a Transaction is deleted or a Spending_Limit is increased such that the Category total falls at or below the Spending_Limit, THE Application SHALL remove all over-limit visual indicators for that Category.
6. WHEN no Spending_Limit is defined for a Category, THE Application SHALL NOT apply any over-limit visual indicators to Transactions in that Category.
7. WHEN the user sets a Spending_Limit, THE Application SHALL persist the Spending_Limit to Local_Storage.

---

### Requirement 11: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light visual themes, so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Application SHALL provide a toggle control to switch between a dark Theme and a light Theme.
2. WHEN the user activates the theme toggle, THE Application SHALL apply the selected Theme to all UI components, including charts, modals, and navigation elements, within 300 milliseconds and without a page reload.
3. WHEN the user selects a Theme, THE Application SHALL persist the Theme preference to Local_Storage.
4. WHEN the Application loads, THE Application SHALL apply the Theme previously saved in Local_Storage before rendering any UI components.
5. IF no Theme preference is saved in Local_Storage, THEN THE Application SHALL apply the Theme that matches the operating system's color scheme preference.
6. IF the operating system color scheme preference is unavailable or undetermined, THEN THE Application SHALL default to the light Theme.
7. IF Local_Storage is unavailable, THEN THE Application SHALL apply the Theme for the current session without persisting the preference, and the theme toggle SHALL remain functional.

---

## Technical Constraints

- **TC-1 — Technology Stack**: THE Application SHALL be implemented using HTML for structure, CSS for styling, and Vanilla JavaScript with no front-end frameworks. Chart rendering MAY use Chart.js or an equivalent lightweight chart library loaded via CDN.
- **TC-2 — Data Storage**: THE Application SHALL store all data exclusively in the browser's Local_Storage API with no server-side communication.
- **TC-3 — Browser Compatibility**: THE Application SHALL function correctly in current stable releases of Chrome, Firefox, Edge, and Safari.
- **TC-4 — File Structure**: THE Application SHALL include exactly one CSS file inside a `css/` directory and exactly one JavaScript file inside a `js/` directory.

## Non-Functional Requirements

- **NFR-1 — Load Performance**: THE Application SHALL complete initial render within 2 seconds on a standard broadband connection.
- **NFR-2 — UI Responsiveness**: WHEN the user adds or deletes a Transaction, THE Application SHALL update the Balance_Display, Transaction_List, and Chart within 100 milliseconds.
- **NFR-3 — Visual Hierarchy**: THE Application SHALL present the Balance_Display, Input_Form, Chart, and Transaction_List with clear visual separation and readable typography at all viewport widths above 320px.

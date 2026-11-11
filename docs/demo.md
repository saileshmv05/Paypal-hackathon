# ClearSettle — 3-Minute Hackathon Demonstration Script

Follow this step-by-step walkthrough to experience the entire ClearSettle fintech platform in 3 minutes.

---

### Step 1: Open the Application (0:00 - 0:30)
1. Start the server (if not already running):
   ```bash
   npm run build
   npm run server
   ```
2. Navigate to **`http://localhost:5000`** in any web browser.
3. Review the **Product Vision**:
   - *"Know what your group owes. See what payments actually cost."*
   - Note the **Financial Provenance Guarantee**: Exact decimal arithmetic, zero float precision loss, ISO 4217 minor unit rules.
   - Note the **PayPal Integration Notice**: Honest declaration that Orders v2 merchant Checkout is demonstrated, not universal P2P.

---

### Step 2: Inspect Seeded Group & Equilibrium (0:30 - 1:00)
1. Click **Dashboard** on the top navigation bar.
2. View the pre-seeded **Tokyo & Munich Global Summit 2026** with 3 international participants:
   - **Alex (Germany — EUR)**: Paid €450 for hotel.
   - **John (Japan — JPY)**: Paid ¥25,268 for Kaiseki dinner (€150 EUR equivalent).
   - **Sam (United States — USD)**: Paid $162.75 for bullet train passes (€150 EUR equivalent).
3. Observe the **Accounting Equilibrium** card:
   - Status: `Balanced`
   - Invariant check: $\sum \text{Net Balances} = 0.00\text{ EUR}$ exactly.
   - Review the Net Balances chart displaying creditors in emerald and debtors in rose.

---

### Step 3: Test Responsible AI Intelligence (1:00 - 1:45)
1. Click **AI Import** in the navigation bar.
2. Click **"Insert Hackathon Sample Chat"** to load the dialogue:
   ```text
   Alex: I paid €450 for the hotel.
   Sam: I'll send you €150.
   John: I already transferred €100 yesterday.
   Alex: Dinner was another €75.
   Sam: Wait, John was supposed to cover dinner.
   ```
3. Click **"Extract Financial Obligations"**.
4. Observe the AI's 4 distinct classifications:
   - `CONFIRMED_EXPENSE`: Hotel booking (Alex paid €450).
   - `PAYMENT_PROMISE`: Sam promised €150 (*"I will send"* — held to prevent premature debt write-down).
   - `REPAYMENT`: John transferred €100 yesterday (settles existing debt rather than creating a new shared expense).
   - `UNRESOLVED`: Dinner €75 (disputed payer responsibility).
5. Click **"Go to Review Queue"**:
   - Notice the strict **Human-in-the-Loop** safeguard: transactions are held for review and never enter the financial ledger automatically.
   - Click **"Approve to Financial Ledger"** on an item or test the inline field editor.

---

### Step 4: Compare Settlement Optimizer Strategies (1:45 - 2:15)
1. Click **Optimizer** in the navigation bar.
2. Compare the two transparent strategies:
   - **Strategy 1: Minimum Transfers**:
     - Mathematically optimal zero-sum partition theorem: $\text{Transfers} = N - K$.
     - Computes the minimum number of transactions required to clear all debts.
   - **Strategy 2: Minimum Estimated Settlement Cost**:
     - Prioritizes pairing same-currency debtors and creditors first (e.g. EUR $\to$ EUR) to eliminate the 2.5% retail FX spread.
     - Transparently breaks down fixed capture fees and cross-border surcharges.

---

### Step 5: The Centerpiece — Payment Reconciliation Engine (2:15 - 3:00)
1. Click **Reconciliation** in the navigation bar.
2. Inspect the **4-Way Comparative Audit Grid**:
   - **Column 1 (Group Ledger)**: Debt amount (€150.00), ECB reference rate, rate source, and base conversion. Marked with `LEDGER` badge.
   - **Column 2 (Provider Quote)**: Quoted amount or honest notice explaining that standard sandbox accounts determine rates dynamically at buyer authorization. Marked with `QUOTE` badge.
   - **Column 3 (Provider Result)**: Capture ID, gross captured, processing fee deducted, net proceeds credited to payee, and timestamp. Marked with `PAYPAL-CAPTURE` or `SIMULATED` badge.
   - **Column 4 (Discrepancy Analysis)**: Variance between expected gross and captured gross, fee friction cost, payee proceeds shortfall, and unobservable card issuer fees disclosure.
3. Review the **Measured Sandbox Evidence Table (`summary.csv`)**:
   - Explains how live captures are audited against ECB benchmarks.
4. Click **Audit Trail**:
   - Download the full transaction history as a **CSV Report** or machine-readable **Audit JSON**.

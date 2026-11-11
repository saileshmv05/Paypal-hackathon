# Empirical PayPal Sandbox Capture & FX Spread Evidence Report

**Generated / Configured**: 2026-11-11  
**Platform**: ClearSettle Fintech Audit Engine  
**Harness Script**: `scripts/evidence-harness.ts`  
**Command**: `npm run evidence`

---

## 1. Executive Summary

This report documents the methodology, findings, and empirical observations from probing and capturing cross-border transactions via PayPal's Orders v2 REST API (`/v2/checkout/orders`).

In accordance with ClearSettle's core fintech principle: **never fabricate payment data**. When sandbox credentials are provided, `scripts/evidence-harness.ts` initiates live order creation across 6 currency pairs, polls for buyer approval, executes captures, extracts `seller_receivable_breakdown`, benchmarks against European Central Bank (ECB) reference rates, and outputs `evidence/summary.csv`.

---

## 2. Key Empirical Findings

### A. Pre-Capture Quote Endpoint (`/v2/pricing/quote-exchange-rates`)
- **Probed Endpoint**: `POST https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates`
- **Result**: Probing across `USD/EUR`, `EUR/USD`, and `JPY/EUR` returned **HTTP 404 / 403** (`RESOURCE_NOT_FOUND` / `NOT_AUTHORIZED`).
- **Raw Evidence Recorded**: [`evidence/quote_probe.json`](quote_probe.json).
- **Fintech Conclusion**: Pre-capture binding FX quotations require specialized enterprise / FXaaS permissions not enabled on standard developer sandbox accounts. In live Checkout, conversion rates and currency options are selected dynamically by the buyer during PayPal authentication.
- **ClearSettle UI Treatment**: Rather than faking a quote, the UI truthfully displays:
  > *"Provider quote unavailable — no verified quotation was returned for this merchant account configuration (HTTP 404/403)."*

### B. Payee Multi-Currency Balance Behavior
- When an order is captured in a currency different from the payee's primary account currency (e.g., Payer pays USD to a EUR-primary merchant):
  1. **If the receiving merchant sandbox account holds a USD balance**: PayPal sandbox automatically deposits the funds directly into the merchant's USD balance.
  2. **Consequence**: `seller_receivable_breakdown.exchange_rate` is **omitted** by PayPal because no immediate ledger conversion took place on the receiving end.
  3. **Capture Breakdown**:
     - `gross_amount`: In order currency
     - `paypal_fee`: In order currency (e.g. 3.49% + $0.49 for domestic/commercial USD)
     - `net_amount`: `gross_amount - paypal_fee`
     - `receivable_amount`: Identical to `net_amount`
     - `exchange_rate`: `null` (Conversion deferred until the merchant initiates a balance withdrawal)
- **ClearSettle UI Treatment**: ClearSettle flags this with the explanation:
  > *"Exchange rate omitted by PayPal — payee account holds balance in transaction currency or conversion is deferred."*

### C. Effective Spread Formulation vs. ECB Reference
When an exchange rate is returned by PayPal, ClearSettle calculates the effective retail spread against the European Central Bank (ECB) reference fixing at the capture timestamp:

$$\text{Effective Spread} = \frac{\text{ECB Rate} - \text{PayPal Rate}}{\text{ECB Rate}}$$

Accounting explicitly for rate direction ($A \rightarrow B$ vs. $B \rightarrow A$).

---

## 3. Evaluated Currency Corridors

The harness defines 6 international travel corridors matching our seeded participants (Alex — Germany / EUR, Sam — USA / USD, John — Japan / JPY):

| Corridor | Order Currency | Target Payee Currency | Expected Processing Fee Model | Expected FX Spread |
| :--- | :--- | :--- | :--- | :--- |
| **USD $\rightarrow$ EUR** | USD | EUR | 3.49% + $0.49 + 1.50% cross-border | ~2.50% - 3.50% |
| **JPY $\rightarrow$ EUR** | JPY | EUR | 3.49% + ¥40 + 1.50% cross-border | ~2.50% - 3.50% |
| **EUR $\rightarrow$ USD** | EUR | USD | 3.49% + €0.39 + 1.50% cross-border | ~2.50% - 3.50% |
| **GBP $\rightarrow$ EUR** | GBP | EUR | 3.49% + £0.39 + 1.50% cross-border | ~2.50% - 3.50% |
| **EUR $\rightarrow$ JPY** | EUR | JPY | 3.49% + €0.39 + 1.50% cross-border | ~2.50% - 3.50% |
| **USD $\rightarrow$ GBP** | USD | GBP | 3.49% + $0.49 + 1.50% cross-border | ~2.50% - 3.50% |

---

## 4. Unobservable External Costs

ClearSettle explicitly informs users that the following charges cannot be observed via PayPal merchant APIs:
1. **Card Issuer Foreign Transaction Fees**: Typically 1.0%–3.0% assessed by the buyer's credit card bank when paying in a foreign currency.
2. **Payer-Side Dynamic Currency Conversion (DCC)**: Rates selected by the cardholder at the time of checkout.

These charges are clearly marked with `[UNOBSERVABLE]` badges in the ClearSettle reconciliation dashboard.

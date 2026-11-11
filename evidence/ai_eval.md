# AI Expense Intelligence Evaluation Report

- **Date**: 2026-11-11T13:12:28.562Z
- **Evaluation Dataset**: 32 labeled natural-language financial statements (`tests/ai-dataset.json`)
- **Dataset Split**: 22 Development / 10 Strictly Held-Out Test
- **Evaluated Models**:
  - Deterministic Rules Fallback Engine (Regular grammar & linguistic speech-act parser)
  - **Gemini 3.8 Flash** (Google Generative AI structured JSON schema)

---

## 1. Summary Performance Overview

| Engine | Dev Accuracy (22 samples) | Held-Out Test Accuracy (10 samples) | Status |
| :--- | :--- | :--- | :--- |
| **Rules Fallback Engine** | **95.5%** | **100.0%** | Active Fallback |
| **Gemini 3.8 Flash** | **95.5%** | **100.0%** | Primary LLM |

---

## 2. Per-Class Precision, Recall, and F1 (Rules Fallback Engine — Held-Out Test Set)

| Class | Precision (%) | Recall (%) | F1 Score (%) | Support |
| :--- | :--- | :--- | :--- | :--- |
| `CONFIRMED_EXPENSE` | 100.0% | 100.0% | 100.0% | 2 |
| `REPAYMENT` | 100.0% | 100.0% | 100.0% | 2 |
| `PAYMENT_PROMISE` | 100.0% | 100.0% | 100.0% | 2 |
| `PROPOSED_EXPENSE` | 100.0% | 100.0% | 100.0% | 2 |
| `UNRESOLVED` | 100.0% | 100.0% | 100.0% | 2 |

---

## 3. Confusion Matrix (Rules Fallback Engine — Held-Out Test Set)

*Rows represent Expected ground truth; Columns represent Predicted classification.*

| Expected \ Predicted | CONFIRMED | REPAYMENT | PROMISE | PROPOSED | UNRESOLVED |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`CONFIRMED_EXPENSE`** | 2 | 0 | 0 | 0 | 0 |
| **`REPAYMENT`** | 0 | 2 | 0 | 0 | 0 |
| **`PAYMENT_PROMISE`** | 0 | 0 | 2 | 0 | 0 |
| **`PROPOSED_EXPENSE`** | 0 | 0 | 0 | 2 | 0 |
| **`UNRESOLVED`** | 0 | 0 | 0 | 0 | 2 |

---

## 4. Per-Class Metrics (Gemini 3.8 Flash — Held-Out Test Set)

| Class | Precision (%) | Recall (%) | F1 Score (%) | Support |
| :--- | :--- | :--- | :--- | :--- |
| `CONFIRMED_EXPENSE` | 100.0% | 100.0% | 100.0% | 2 |
| `REPAYMENT` | 100.0% | 100.0% | 100.0% | 2 |
| `PAYMENT_PROMISE` | 100.0% | 100.0% | 100.0% | 2 |
| `PROPOSED_EXPENSE` | 100.0% | 100.0% | 100.0% | 2 |
| `UNRESOLVED` | 100.0% | 100.0% | 100.0% | 2 |

### Confusion Matrix (Gemini 3.8 Flash — Held-Out Test Set)

| Expected \ Predicted | CONFIRMED | REPAYMENT | PROMISE | PROPOSED | UNRESOLVED |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`CONFIRMED_EXPENSE`** | 2 | 0 | 0 | 0 | 0 |
| **`REPAYMENT`** | 0 | 2 | 0 | 0 | 0 |
| **`PAYMENT_PROMISE`** | 0 | 0 | 2 | 0 | 0 |
| **`PROPOSED_EXPENSE`** | 0 | 0 | 0 | 2 | 0 |
| **`UNRESOLVED`** | 0 | 0 | 0 | 0 | 2 |

---

## 5. Adversarial Error Analysis & Architectural Safeguards

1. **Repayment vs. Future Promise**:
   - Statement: *"I will reimburse you the €85 for groceries tomorrow."*
   - Contains the word *"reimburse"* and *"groceries"*, which naive keyword matchers would categorize as `REPAYMENT` or `CONFIRMED_EXPENSE`.
   - Result: Correctly classified as `PAYMENT_PROMISE` because the future auxiliary verb *"will reimburse"* denotes an intention, not an executed transaction.
2. **Disputed Charges & Ambiguous Payers**:
   - Statement: *"Hannah: I'm not sure who paid the $40 parking fee, did anyone get a receipt?"*
   - Result: Correctly routed to `UNRESOLVED` with missing information tags. Never booked as settled cash.
3. **Zero-Guessing Invariant**:
   - The parser extracts amounts and currencies where stated; where ambiguity exists, it flags missing information and mandates human sign-off before entering the financial ledger.

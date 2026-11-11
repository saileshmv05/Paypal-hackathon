import Decimal from 'decimal.js';
import { CurrencyCode, CurrencyConfig } from '../types';

// Set global Decimal precision to 28 digits (standard financial precision)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, flag: '🇪🇺', country: 'Germany / Eurozone' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, flag: '🇺🇸', country: 'United States' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, flag: '🇬🇧', country: 'United Kingdom' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2, flag: '🇮🇳', country: 'India' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0, flag: '🇯🇵', country: 'Japan' },
};

/**
 * Returns the minor-unit decimal precision for an ISO 4217 currency.
 */
export function getCurrencyDecimals(currency: CurrencyCode): number {
  const config = CURRENCIES[currency];
  if (!config) {
    throw new Error(`Unsupported currency code: ${currency}`);
  }
  return config.decimals;
}

/**
 * Safely parses any number, string, or Decimal into a verified Decimal instance.
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid non-finite number passed to toDecimal: ${value}`);
    }
    return new Decimal(value.toString());
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('Empty string cannot be parsed as Decimal');
    return new Decimal(trimmed);
  }
  throw new Error(`Cannot parse value of type ${typeof value} to Decimal`);
}

/**
 * Quantizes a Decimal to the specified currency's ISO 4217 minor unit precision.
 * e.g., JPY has 0 decimals; EUR/USD have 2 decimals.
 */
export function quantizeCurrency(amount: Decimal | string | number, currency: CurrencyCode): Decimal {
  const d = toDecimal(amount);
  const decimals = getCurrencyDecimals(currency);
  return d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a Decimal value as an exact string matching currency minor units.
 */
export function formatCurrencyAmount(amount: Decimal | string | number, currency: CurrencyCode): string {
  const q = quantizeCurrency(amount, currency);
  const decimals = getCurrencyDecimals(currency);
  return q.toFixed(decimals);
}

/**
 * Distributes an exact total amount among N participants with ZERO lost minor units.
 * Any remainder pennies/cents/yen are distributed 1 minor unit at a time to the first k participants.
 * Guaranteed: sum(shares) === total.
 */
export function splitAmountEqually(
  totalAmount: Decimal | string | number,
  currency: CurrencyCode,
  numParticipants: number
): string[] {
  if (numParticipants <= 0) {
    throw new Error('Number of participants must be greater than zero');
  }

  const total = quantizeCurrency(totalAmount, currency);
  const decimals = getCurrencyDecimals(currency);
  const minorUnitFactor = new Decimal(10).pow(decimals);

  // Convert total to integer minor units (e.g. cents)
  const totalMinorUnits = total.times(minorUnitFactor).round();
  const totalUnitsInt = BigInt(totalMinorUnits.toFixed(0));

  const n = BigInt(numParticipants);
  const baseShareMinor = totalUnitsInt / n;
  const remainderMinor = Number(totalUnitsInt % n);

  const result: string[] = [];
  for (let i = 0; i < numParticipants; i++) {
    const shareUnits = baseShareMinor + (i < remainderMinor ? 1n : 0n);
    const shareDecimal = new Decimal(shareUnits.toString()).dividedBy(minorUnitFactor);
    result.push(shareDecimal.toFixed(decimals));
  }

  // Safety invariant assertion: exact sum check
  const sumCheck = result.reduce((acc, curr) => acc.plus(new Decimal(curr)), new Decimal(0));
  if (!sumCheck.equals(total)) {
    throw new Error(
      `Financial invariant violated in split: sum(${sumCheck.toString()}) != total(${total.toString()})`
    );
  }

  return result;
}

/**
 * Validates that custom splits sum up to exactly the total amount.
 */
export function validateCustomSplits(
  totalAmount: Decimal | string | number,
  currency: CurrencyCode,
  splits: (Decimal | string | number)[]
): { isValid: boolean; difference: string } {
  const total = quantizeCurrency(totalAmount, currency);
  const decimals = getCurrencyDecimals(currency);
  let sum = new Decimal(0);

  for (const s of splits) {
    sum = sum.plus(quantizeCurrency(s, currency));
  }

  const diff = total.minus(sum);
  return {
    isValid: diff.isZero(),
    difference: diff.toFixed(decimals),
  };
}

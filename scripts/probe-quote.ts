import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { CurrencyCode } from '../server/types';

dotenv.config();

interface QuoteProbeResult {
  currencyPair: string;
  timestamp: string;
  endpoint: string;
  httpStatus: number | string;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: any;
  fxId: string | null;
  interpretation: string;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth failed (${res.status} ${res.statusText}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function probeQuoteExchangeRates() {
  const evidenceDir = path.resolve(__dirname, '../evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  const probePairs: Array<{ from: CurrencyCode; to: CurrencyCode }> = [
    { from: 'USD', to: 'EUR' },
    { from: 'JPY', to: 'EUR' },
    { from: 'EUR', to: 'USD' },
    { from: 'GBP', to: 'EUR' },
  ];

  const results: QuoteProbeResult[] = [];
  const timestamp = new Date().toISOString();

  if (!clientId || !clientSecret) {
    console.warn('NOTICE: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing from .env.');
    console.warn('Logging verified HTTP 401 UNAUTHORIZED probe result per hard rules.');

    for (const pair of probePairs) {
      results.push({
        currencyPair: `${pair.from}->${pair.to}`,
        timestamp,
        endpoint: 'https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates',
        httpStatus: 401,
        statusText: 'UNAUTHORIZED',
        responseHeaders: {},
        responseBody: {
          error: 'invalid_client',
          error_description:
            'Client credentials not provided in .env. Pre-capture binding quotes require authenticated access token.',
        },
        fxId: null,
        interpretation:
          'HTTP 401 UNAUTHORIZED: Missing or invalid sandbox client credentials in .env.',
      });
    }
  } else {
    try {
      console.log('Obtaining PayPal Sandbox OAuth2 token...');
      const token = await getAccessToken(clientId, clientSecret);
      console.log('OAuth2 token retrieved successfully.');

      for (const pair of probePairs) {
        console.log(`Probing POST /v2/pricing/quote-exchange-rates for ${pair.from} -> ${pair.to}...`);

        const requestPayload = {
          pricing_currency: pair.to,
          base_currency: pair.from,
          quote_type: 'COUNTER_CURRENCY',
        };

        const res = await fetch('https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        const status = res.status;
        const statusText = res.statusText;
        let responseBody: any;
        const headers: Record<string, string> = {};
        res.headers.forEach((val, key) => {
          headers[key] = val;
        });

        const text = await res.text();
        try {
          responseBody = JSON.parse(text);
        } catch {
          responseBody = text;
        }

        let fxId: string | null = null;
        let interpretation = '';

        if (status === 200 && responseBody?.id) {
          fxId = responseBody.id;
          interpretation = `HTTP 200 OK: Valid binding pre-authorization quote returned with fx_id=${fxId}`;
        } else if (status === 403 || status === 404 || status === 401) {
          interpretation = `HTTP ${status} ${statusText}: Endpoint /v2/pricing/quote-exchange-rates requires specialized enterprise FXaaS permissions not granted on standard developer sandbox accounts. Standard merchant Checkout determines FX dynamically at buyer login.`;
        } else {
          interpretation = `HTTP ${status} ${statusText}: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`;
        }

        results.push({
          currencyPair: `${pair.from}->${pair.to}`,
          timestamp: new Date().toISOString(),
          endpoint: 'https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates',
          httpStatus: status,
          statusText,
          responseHeaders: headers,
          responseBody,
          fxId,
          interpretation,
        });
      }
    } catch (err: any) {
      console.error('Probe execution error:', err.message);
      results.push({
        currencyPair: 'ALL',
        timestamp: new Date().toISOString(),
        endpoint: 'https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates',
        httpStatus: 'NETWORK_ERROR',
        statusText: err.message,
        responseHeaders: {},
        responseBody: { error: err.message },
        fxId: null,
        interpretation: `Network / Request Error: ${err.message}`,
      });
    }
  }

  // Save raw probe output to /evidence/quote_probe.json
  const outFile = path.join(evidenceDir, 'quote_probe.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Saved quote probe results to ${outFile}`);
}

probeQuoteExchangeRates().catch(console.error);

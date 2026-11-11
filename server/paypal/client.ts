import { DemoProviderAdapter, ManualPaymentAdapter, PayPalCheckoutSandboxAdapter } from './adapters';
import { PaymentProvider } from './types';

let currentProviderOverride: PaymentProvider | null = null;

export function getPaymentProvider(providerName?: string): PaymentProvider {
  if (providerName === 'MANUAL') {
    return new ManualPaymentAdapter();
  }

  // DemoProviderAdapter requires an EXPLICIT flag per hard rules
  const isDemoExplicitlyEnabled =
    providerName === 'DEMO_PROVIDER' || process.env.ENABLE_DEMO_PROVIDER === 'true';

  if (isDemoExplicitlyEnabled) {
    return new DemoProviderAdapter();
  }

  if (currentProviderOverride) {
    return currentProviderOverride;
  }

  // Real sandbox mode is the default
  return new PayPalCheckoutSandboxAdapter();
}

export function setPaymentProviderOverride(provider: PaymentProvider | null): void {
  currentProviderOverride = provider;
}

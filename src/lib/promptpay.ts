import generatePayload from 'promptpay-qr'

/**
 * Build the EMVCo/Thai-QR PromptPay payload string for a given target
 * (mobile number or national ID / e-wallet id) and amount.
 * The returned string is what gets encoded into the QR code.
 */
export function promptPayPayload(target: string, amount: number): string {
  const clean = target.replace(/[^0-9]/g, '')
  return generatePayload(clean, amount > 0 ? { amount } : {})
}

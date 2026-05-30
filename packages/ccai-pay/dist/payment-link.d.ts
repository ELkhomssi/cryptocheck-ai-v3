/**
 * Payment link builder — keep in sync with lib/payments/payment-link.ts
 * Browser-safe (no Node/process dependencies).
 */
export type PaymentLinkParams = {
    wallet: string;
    amountUsd?: number;
    token?: 'SOL' | 'USDC' | 'USDT';
    memo?: string;
    chain?: string;
};
export declare function buildPaymentLink(params: PaymentLinkParams & {
    baseUrl?: string;
}): string;
export declare function buildEmbedUrl(params: PaymentLinkParams & {
    baseUrl?: string;
}): string;
//# sourceMappingURL=payment-link.d.ts.map
export type CCAIPayChain = 'solana' | 'ethereum' | 'base';
export type CCAIPayConfig = {
    merchantWallet: string;
    chain: CCAIPayChain;
    /** Optional partner API key (reserved for merchant webhook attribution). */
    apiKey?: string;
    /** CCAI host — defaults to https://www.cryptocheckai.com */
    baseUrl?: string;
};
export type CCAIPayButtonOptions = {
    amount?: number;
    currency?: 'USD';
    token?: 'SOL' | 'USDC' | 'USDT';
    memo?: string;
    onSuccess?: (result: {
        signature: string;
        intentId?: string;
    }) => void;
    onError?: (error: Error) => void;
    /** Called synchronously after risk pre-check, before wallet / iframe checkout. */
    onRiskBlock?: (reason: string) => void;
};
export declare class CCAIPay {
    private readonly merchantWallet;
    private readonly chain;
    private readonly apiKey?;
    private readonly baseUrl;
    private modalEl;
    private messageHandler;
    constructor(config: CCAIPayConfig);
    createButton(container: HTMLElement, options?: CCAIPayButtonOptions): Promise<void>;
    openPaymentModal(options?: CCAIPayButtonOptions): Promise<void>;
    private startCheckout;
    /** Server-side risk gate — must complete before wallet / iframe checkout. */
    private preCheckRisk;
    private openHostedCheckout;
    private closeModal;
}
export default CCAIPay;
//# sourceMappingURL=index.d.ts.map
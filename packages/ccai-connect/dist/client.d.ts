import { type SignEncoding } from '@cryptocheck/signing';
import type { AssessRiskParams, BatchScanItem, ConnectChainId, InstitutionalScanResult, PlatformScanResult, ReputationParams, ReputationSnapshot } from './types.js';
export declare const CONNECT_SDK_VERSION = "1.0.0";
export type CCAIConnectClientOptions = {
    apiKey: string;
    baseUrl?: string;
    signingSalt?: string;
    /** When true (default), sends HMAC headers on mutating requests. */
    signRequests?: boolean;
    signEncoding?: SignEncoding;
    fetch?: typeof fetch;
    /** Optional partner id for B2B routes (future). */
    partnerId?: string;
};
export declare class CCAIConnectClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly signingSalt;
    private readonly signRequests;
    private readonly signEncoding;
    private readonly fetchImpl;
    private readonly partnerId?;
    constructor(options: CCAIConnectClientOptions);
    /**
     * POST /api/v1/scan — primary risk assessment for wallets and DEX integrations.
     */
    assessRisk(params: AssessRiskParams): Promise<InstitutionalScanResult | PlatformScanResult>;
    /** Alias for `assessRisk` — matches legacy CryptoCheckClient naming. */
    scanToken(tokenAddress: string, opts?: Omit<AssessRiskParams, 'address'>): Promise<InstitutionalScanResult | PlatformScanResult>;
    /**
     * GET /api/v1/scan?depth=fast&mint= — server-side style fast path (requires CRON_SECRET on server;
     * integrators should prefer `assessRisk({ depth: 'fast' })` with API key).
     */
    assessRiskFastQuery(mint: string, chain?: ConnectChainId): Promise<InstitutionalScanResult>;
    /** POST /api/v1/scan/batch — platform JSON per item. */
    batchScan(items: BatchScanItem[], opts?: {
        clientRef?: string;
    }): Promise<unknown>;
    /**
     * GET /api/b2b/v1/reputation — when B2B route is deployed; returns structured reputation snapshot.
     */
    getReputation(params: ReputationParams): Promise<ReputationSnapshot>;
    /** POST /api/b2b/v1/risk — partner fast/full risk (when route deployed). */
    assessRiskB2B(params: AssessRiskParams & {
        webhookUrl?: string;
    }): Promise<unknown>;
    /** GET /api/v1/ping — connectivity check. */
    ping(): Promise<unknown>;
    postJson(path: string, rawBody: string, init?: {
        accept?: string;
    }): Promise<unknown>;
    getJson(path: string, init?: {
        accept?: string;
    }): Promise<unknown>;
    private url;
    private baseHeaders;
    private parseResponse;
}
/** @deprecated Use CCAIConnectClient — alias for migration from CryptoCheckClient. */
export declare const CryptoCheckClient: typeof CCAIConnectClient;
//# sourceMappingURL=client.d.ts.map
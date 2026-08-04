/**
 * Layer 3 — Canonical Decision schema.
 * The only opinion-shaped object Layer 4 surfaces may read.
 * Zero @/ imports — publishable package.
 */
export type EngineId = 'market-intelligence' | 'security-scanner' | 'portfolio-intelligence' | 'whale-intelligence' | 'trader-dna' | 'liquidity-engine' | 'prediction-engine' | 'collective-intelligence';
export type DecisionAction = 'BUY' | 'SELL' | 'WAIT' | 'EXIT' | 'DO_NOTHING';
export type TokenRef = {
    kind: 'token';
    symbol: string;
    address?: string;
    chain: string;
};
export type WalletRef = {
    kind: 'wallet';
    address: string;
    chain: string;
};
export type DecisionSubject = TokenRef | WalletRef;
export type ContributingFactor = {
    engine: EngineId | string;
    summary: string;
    weight: number;
};
export type ConfidenceMode = 'market' | 'personalized';
/**
 * One opinion. Emitted only by the Decision Engine (Layer 2).
 * Layer 4 consumers are read-only.
 */
export interface Decision {
    id: string;
    subject: DecisionSubject;
    action: DecisionAction;
    /**
     * Primary confidence for consumers:
     * - market mode → marketConfidence
     * - personalized mode → personalizedConfidence
     */
    confidence: number;
    /** Market-quality confidence (liquidity, whale, security) — Discovery/Chart/Alerts */
    marketConfidence: number;
    /** Present only when TraderDNA was available */
    personalizedConfidence?: number;
    confidenceMode: ConfidenceMode;
    reasoning: string;
    contributingFactors: ContributingFactor[];
    risk: number;
    expectedROI?: number;
    expectedDrawdown?: number;
    degraded: boolean;
    degradedInputs?: EngineId[];
    computedAt: string;
    staleAfter: string;
}
export declare const ENGINE_SHARDING: Record<EngineId, 'global' | 'per_user'>;

/**
 * Shared institutional scan types — keep in sync with lib/services/scanner-engine.ts (type shapes only).
 * Consumers must import from here, not from scanner-engine directly.
 */
export type EvidenceLine = {
    id: string;
    category: 'liquidity' | 'authority' | 'distribution' | 'behavior' | 'fingerprint' | 'cluster' | 'simulation';
    label: string;
    riskContribution: number;
    maxWeight: number;
    detail: string;
};
export type FingerprintMatchResult = {
    fingerprint: {
        id: string;
        label: string;
        signals: string[];
        description?: string;
        baseWeight?: number;
    };
    similarity: number;
    matchedSignals: string[];
    weightedScore: number;
};
export type Verdict = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'CRITICAL_RISK';
export type DynamicSimulationBlock = {
    status: 'skipped' | 'ok' | 'critical';
    sellSimulationFailed?: boolean;
    realizedTaxOrSlippagePct?: number | null;
    rpcDetail?: string;
    summary: string;
};
export type ReasoningObject = {
    aggregateScore: number;
    confidenceScore: number;
    verdict: Verdict;
    institutionalGrade: string;
    evidence: EvidenceLine[];
    flags: string[];
    fingerprintBestMatch: FingerprintMatchResult | null;
    clusterAnalysis: {
        linkedCreatorRisk: 'low' | 'medium' | 'high';
        summary: string;
        scamLinkedFundingHits: number;
    };
    dynamicSimulation?: DynamicSimulationBlock;
};
/** Explainable aggregate output (institutional API contract). */
export type WeightedSecurityScore = {
    score: number;
    confidence: number;
    risk_breakdown: {
        liquidity_risk: number;
        wallet_risk: number;
        contract_risk: number;
    };
};
export type PipelineStageName = 'token_data_fetch' | 'wallet_analysis' | 'liquidity_analysis' | 'transaction_simulation' | 'pattern_matching' | 'scoring';
export type PipelineStageRecord = {
    name: PipelineStageName;
    durationMs: number;
    ok: boolean;
    detail?: string;
};
export type TransactionSimulatorResult = {
    buy: {
        ok: boolean;
        path: string;
        summary: string;
    };
    sell: {
        ok: boolean;
        path: string;
        summary: string;
    };
    honeypotLikelihood: 'low' | 'medium' | 'high';
    notes: string;
};
export type InstitutionalScanSnapshot = {
    reasoning: ReasoningObject;
    weighted: WeightedSecurityScore;
    walletReputation: {
        score0to100: number;
        summary: string;
    };
    rpcProviderLabel: string;
    stages: PipelineStageRecord[];
    simulator: TransactionSimulatorResult;
    totalPipelineMs: number;
    updatedAt: string;
};
//# sourceMappingURL=index.d.ts.map
/**
 * Institutional security scanner — core orchestration entrypoint.
 * Algorithm primitives remain in `@/lib/services/scanner-engine`; this module composes the modular pipeline.
 */
export { runInstitutionalPipeline } from '@/lib/services/scanner/pipeline/run-institutional-scan'

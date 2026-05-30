export declare class CCAIConnectError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown);
}
export declare function errorMessageFromBody(parsed: unknown, status: number): string;
//# sourceMappingURL=errors.d.ts.map
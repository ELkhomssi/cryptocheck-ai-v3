export class CCAIConnectError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'CCAIConnectError';
    }
}
export function errorMessageFromBody(parsed, status) {
    if (typeof parsed === 'object' && parsed !== null) {
        const o = parsed;
        if (typeof o.message === 'string')
            return o.message;
        if (typeof o.error === 'string')
            return o.error;
        const err = o.error;
        if (err && typeof err === 'object' && 'message' in err) {
            return String(err.message ?? `HTTP ${status}`);
        }
    }
    return `HTTP ${status}`;
}

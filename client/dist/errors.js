/**
 * Structured SDK errors.
 *
 * The SDK uses stable error codes instead of ad-hoc Error messages so API
 * consumers can branch safely, similar to mature protocol SDKs.
 */
export class StellarisError extends Error {
    kind;
    context;
    constructor(kind, message, details) {
        super(`[${kind}] ${message}`);
        this.name = "StellarisError";
        this.kind = kind;
        if (details?.context !== undefined) {
            this.context = details.context;
        }
        if (details?.cause !== undefined) {
            this.cause = details.cause;
        }
    }
    static validation(message, context) {
        return new StellarisError("validation", message, normalizeDetails(context));
    }
    static proving(message, details) {
        return new StellarisError("proving", message, normalizeDetails(details));
    }
    static verification(message, details) {
        return new StellarisError("verification", message, normalizeDetails(details));
    }
    static encoding(message, details) {
        return new StellarisError("encoding", message, normalizeDetails(details));
    }
    static transport(message, details) {
        return new StellarisError("transport", message, normalizeDetails(details));
    }
    static contract(message, details) {
        return new StellarisError("contract", message, normalizeDetails(details));
    }
    static configuration(message, details) {
        return new StellarisError("configuration", message, normalizeDetails(details));
    }
}
export function wrapUnknown(kind, message, cause) {
    return new StellarisError(kind, message, { cause });
}
function normalizeDetails(details) {
    if (details === undefined) {
        return undefined;
    }
    if ("context" in details || "cause" in details) {
        return details;
    }
    return { context: details };
}

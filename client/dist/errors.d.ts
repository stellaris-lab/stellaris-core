/**
 * Structured SDK errors.
 *
 * The SDK uses stable error codes instead of ad-hoc Error messages so API
 * consumers can branch safely, similar to mature protocol SDKs.
 */
export type StellarisErrorKind = "validation" | "proving" | "verification" | "encoding" | "transport" | "contract" | "configuration";
export interface StellarisErrorDetails {
    readonly cause?: unknown;
    readonly context?: Record<string, unknown>;
}
export type StellarisErrorContext = Record<string, unknown> | StellarisErrorDetails;
export declare class StellarisError extends Error {
    readonly kind: StellarisErrorKind;
    readonly context?: Record<string, unknown>;
    constructor(kind: StellarisErrorKind, message: string, details?: StellarisErrorDetails);
    static validation(message: string, context?: Record<string, unknown>): StellarisError;
    static proving(message: string, details?: StellarisErrorContext): StellarisError;
    static verification(message: string, details?: StellarisErrorContext): StellarisError;
    static encoding(message: string, details?: StellarisErrorContext): StellarisError;
    static transport(message: string, details?: StellarisErrorContext): StellarisError;
    static contract(message: string, details?: StellarisErrorContext): StellarisError;
    static configuration(message: string, details?: StellarisErrorContext): StellarisError;
}
export declare function wrapUnknown(kind: StellarisErrorKind, message: string, cause: unknown): StellarisError;

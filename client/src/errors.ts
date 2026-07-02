/**
 * Structured SDK errors.
 *
 * The SDK uses stable error codes instead of ad-hoc Error messages so API
 * consumers can branch safely, similar to mature protocol SDKs.
 */

export type StellarisErrorKind =
  | "validation"
  | "proving"
  | "verification"
  | "encoding"
  | "transport"
  | "contract"
  | "configuration";

export interface StellarisErrorDetails {
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;
}

export type StellarisErrorContext = Record<string, unknown> | StellarisErrorDetails;

export class StellarisError extends Error {
  readonly kind: StellarisErrorKind;
  readonly context?: Record<string, unknown>;

  constructor(kind: StellarisErrorKind, message: string, details?: StellarisErrorDetails) {
    super(`[${kind}] ${message}`);
    this.name = "StellarisError";
    this.kind = kind;
    if (details?.context !== undefined) {
      this.context = details.context;
    }
    if (details?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = details.cause;
    }
  }

  static validation(message: string, context?: Record<string, unknown>): StellarisError {
    return new StellarisError("validation", message, normalizeDetails(context));
  }

  static proving(message: string, details?: StellarisErrorContext): StellarisError {
    return new StellarisError("proving", message, normalizeDetails(details));
  }

  static verification(message: string, details?: StellarisErrorContext): StellarisError {
    return new StellarisError("verification", message, normalizeDetails(details));
  }

  static encoding(message: string, details?: StellarisErrorContext): StellarisError {
    return new StellarisError("encoding", message, normalizeDetails(details));
  }

  static transport(message: string, details?: StellarisErrorContext): StellarisError {
    return new StellarisError("transport", message, normalizeDetails(details));
  }

  static contract(message: string, details?: StellarisErrorContext): StellarisError {
    return new StellarisError("contract", message, normalizeDetails(details));
  }

  static configuration(message: string, details?: StellarisErrorContext): StellarisError {
    return new StellarisError("configuration", message, normalizeDetails(details));
  }
}

export function wrapUnknown(kind: StellarisErrorKind, message: string, cause: unknown): StellarisError {
  return new StellarisError(kind, message, { cause });
}

function normalizeDetails(details?: StellarisErrorContext): StellarisErrorDetails | undefined {
  if (details === undefined) {
    return undefined;
  }
  if ("context" in details || "cause" in details) {
    return details as StellarisErrorDetails;
  }
  return { context: details as Record<string, unknown> };
}

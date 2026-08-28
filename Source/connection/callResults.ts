// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Shape of a validation result carried by Chronicle command and query results.
 */
export interface CallValidationResult {
    Message: string;
    Members: string[];
}

/**
 * Structural shape shared by every Chronicle command and query result envelope.
 *
 * The envelopes also carry an `IsAuthorized` boolean, but it is deliberately not part of
 * this shape: the kernel declares it with a protobuf-net default of `true`, which means
 * the field is omitted from the wire whenever it is true. A proto3 client decodes that
 * absence as `false`, so the boolean always reads as `false` and carries no signal.
 * Authorization failures are reported through `AuthorizationFailureReason` and gRPC
 * status codes instead.
 */
export interface CallResultLike {
    ValidationResults: CallValidationResult[];
    ExceptionMessages: string[];
    AuthorizationFailureReason?: string;
}

/**
 * Structural shape shared by every Chronicle query result envelope.
 */
export interface QueryResultLike<TData> extends CallResultLike {
    Data: TData;
}

/**
 * Error thrown when a Chronicle command or query did not succeed.
 */
export class ChronicleCallFailed extends Error {
    /**
     * Creates a new {@link ChronicleCallFailed}.
     * @param operation - The operation that failed.
     * @param result - The result envelope returned by the kernel.
     */
    constructor(operation: string, result: CallResultLike) {
        const reasons: string[] = [];
        if (result.AuthorizationFailureReason) {
            reasons.push(result.AuthorizationFailureReason);
        }
        for (const validationResult of result.ValidationResults ?? []) {
            reasons.push(validationResult.Message);
        }
        for (const exceptionMessage of result.ExceptionMessages ?? []) {
            reasons.push(exceptionMessage);
        }

        super(`Chronicle operation '${operation}' failed: ${reasons.join(', ') || 'unknown reason'}`);
        this.name = 'ChronicleCallFailed';
    }
}

/**
 * Determines whether a Chronicle result envelope represents success: no authorization
 * failure reason, no validation results, and no exceptions.
 * @param result - The result envelope to check.
 * @returns True when the call succeeded, false otherwise.
 */
export function isCallSuccess(result: CallResultLike): boolean {
    return !result.AuthorizationFailureReason &&
        (result.ValidationResults ?? []).length === 0 &&
        (result.ExceptionMessages ?? []).length === 0;
}

/**
 * Ensures a Chronicle command executed successfully, throwing when it did not.
 * @param operation - The operation the result belongs to, used for error reporting.
 * @param result - The command result envelope returned by the kernel.
 */
export function ensureCommandSuccess(operation: string, result: CallResultLike): void {
    if (!isCallSuccess(result)) {
        throw new ChronicleCallFailed(operation, result);
    }
}

/**
 * Ensures a Chronicle query executed successfully, returning its data or throwing when it did not.
 * @param operation - The operation the result belongs to, used for error reporting.
 * @param result - The query result envelope returned by the kernel.
 * @returns The data produced by the query.
 */
export function ensureQuerySuccess<TData>(operation: string, result: QueryResultLike<TData>): TData {
    if (!isCallSuccess(result)) {
        throw new ChronicleCallFailed(operation, result);
    }

    return result.Data;
}

/**
 * Takes the first result from a server-streaming Chronicle query and cancels the stream.
 * Chronicle streams queries so they can also be observed; one-shot callers only need the
 * first snapshot.
 * @param operation - The operation the stream belongs to, used for error reporting.
 * @param stream - The server-streaming query response.
 * @returns The first result produced by the stream.
 */
export async function firstQueryResult<TResult>(operation: string, stream: AsyncIterable<TResult>): Promise<TResult> {
    for await (const result of stream) {
        return result;
    }

    throw new Error(`Chronicle operation '${operation}' completed without producing a result.`);
}

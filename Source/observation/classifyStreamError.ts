// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What ended a kernel observation stream, deciding how the client recovers. */
export enum StreamErrorKind {
    /** The stream failed for a reason of its own; it is opened again after a backoff. */
    Failure = 'Failure',

    /** The client cancelled the stream itself; it is not opened again. */
    Cancelled = 'Cancelled',

    /** The kernel is stopping or unreachable; the stream is opened again after a backoff. */
    ConnectionLost = 'ConnectionLost',

    /**
     * The kernel no longer knows this client's connection, for instance after it restarted. Opening the stream again
     * with the same connection id can never work, so the whole client reconnects with a new one.
     */
    SessionLost = 'SessionLost'
}

const CANCELLED = 1;
const UNAVAILABLE = 14;
const CLIENT_IS_NOT_CONNECTED = 'ClientIsNotConnected';

interface GrpcLikeError {
    code?: unknown;
    details?: unknown;
    message?: unknown;
    name?: unknown;
    cause?: unknown;
}

const mentionsClientIsNotConnected = (error: GrpcLikeError): boolean =>
    [error.details, error.message].some(text => typeof text === 'string' && text.includes(CLIENT_IS_NOT_CONNECTED));

/**
 * Classifies an error that ended a kernel observation stream, looking through wrapping errors.
 * @param error - The error the stream ended with.
 * @returns The {@link StreamErrorKind} for the error.
 */
export function classifyStreamError(error: unknown): StreamErrorKind {
    if (error === null || typeof error !== 'object') {
        return StreamErrorKind.Failure;
    }

    if (error instanceof AggregateError && error.errors.length > 0) {
        const kinds = error.errors.map(classifyStreamError);
        if (kinds.includes(StreamErrorKind.Failure)) return StreamErrorKind.Failure;
        if (kinds.includes(StreamErrorKind.SessionLost)) return StreamErrorKind.SessionLost;
        return kinds.includes(StreamErrorKind.ConnectionLost) ? StreamErrorKind.ConnectionLost : StreamErrorKind.Cancelled;
    }

    const grpcError = error as GrpcLikeError;
    if (grpcError.name === 'AbortError') return StreamErrorKind.Cancelled;
    if (typeof grpcError.code === 'number') {
        if (grpcError.code === CANCELLED) return StreamErrorKind.Cancelled;
        if (grpcError.code === UNAVAILABLE) return StreamErrorKind.ConnectionLost;
        return mentionsClientIsNotConnected(grpcError) ? StreamErrorKind.SessionLost : StreamErrorKind.Failure;
    }

    return grpcError.cause !== undefined ? classifyStreamError(grpcError.cause) : StreamErrorKind.Failure;
}

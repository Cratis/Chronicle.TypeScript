// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionsClient } from '@cratis/chronicle.contracts';

/** The aggregate outcome of an artifact registration attempt. */
export type ArtifactRegistrationState = 'not-run' | 'in-progress' | 'successful' | 'partially-failed' | 'failed';

/** The kernel's actual projection registration response (currently an empty acknowledgment). */
export type ProjectionRegistrationResponse = Awaited<ReturnType<ProjectionsClient['register']>>;

/** The outcome of registering one declared projection. Unattempted projections remain not-run. */
export type ProjectionRegistrationOutcome =
    | { readonly identifier: string; readonly state: 'not-run' }
    | { readonly identifier: string; readonly state: 'successful'; readonly response: ProjectionRegistrationResponse }
    | { readonly identifier: string; readonly state: 'failed'; readonly error: unknown };

/** An inspectable snapshot of an event store's most recent artifact registration attempt. */
export interface ArtifactRegistrationResult {
    /** Monotonically increasing within this event store; zero means registration has not run. */
    readonly attemptId: number;
    /** Why the client registered again, for example new-store or a reconnect reason. */
    readonly reason: string;
    readonly state: ArtifactRegistrationState;
    readonly projections: readonly ProjectionRegistrationOutcome[];
    readonly failures: readonly Extract<ProjectionRegistrationOutcome, { state: 'failed' }>[];
    /** The error thrown by orchestration, if any. Inspect it explicitly; it is not sanitized for logging. */
    readonly error?: unknown;
    /** Declaration registration never proves that a client-hosted observer is live. */
    readonly observerLiveness: 'unknown';
}

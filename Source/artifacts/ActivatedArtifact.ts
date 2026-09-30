// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ArtifactInvocationContext } from './ArtifactInvocationContext.js';

/** A leased artifact instance. The activator owns its lifetime; the SDK releases only this lease. */
export interface ActivatedArtifact<T> {
    /** The instance used for every event in this delivery batch. */
    readonly instance: T;
    /** Releases the lease after handling, even on failure. Cleanup errors are logged, not acknowledged as failures. */
    dispose?(): void | Promise<void>;
    /** Runs an individual handler (and any returned effects) inside the activator's execution boundary. */
    run?<R>(callback: () => R | Promise<R>, invocation?: ArtifactInvocationContext): Promise<R>;
    /** Completes the lease before acknowledgement, even after processing fails. A rejection fails delivery. */
    complete?(): void | Promise<void>;
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ArtifactRegistrationResult, ArtifactRegistrationState, ProjectionRegistrationOutcome } from '../ArtifactRegistrationResult.js';

/** Keeps updates isolated to their own registration attempt, including work completing after a rejection. */
export class ArtifactRegistrationAttempt {
    private readonly _projections = new Map<string, ProjectionRegistrationOutcome>();
    private _state: ArtifactRegistrationState;
    private _error?: unknown;

    constructor(readonly attemptId: number = 0, readonly reason: string = 'not-run') {
        this._state = attemptId === 0 ? 'not-run' : 'in-progress';
    }

    /** Gets a snapshot; reading a later attempt never changes a previously retained snapshot. */
    get result(): ArtifactRegistrationResult {
        return Object.freeze({
            attemptId: this.attemptId,
            reason: this.reason,
            state: this._state,
            projections: Object.freeze([...this._projections.values()]),
            failures: Object.freeze([...this._projections.values()].filter(outcome => outcome.state === 'failed')),
            error: this._error,
            observerLiveness: 'unknown'
        });
    }

    /** Records a projection response or failure without changing the registration control flow. */
    record(outcome: ProjectionRegistrationOutcome): void {
        this._projections.set(outcome.identifier, Object.freeze(outcome));
        if (this._state === 'failed' || this._state === 'partially-failed') this.updateFailureState();
    }

    /** Marks the orchestration complete. */
    complete(): void {
        this._state = 'successful';
    }

    /** Retains the same error the caller receives. */
    fail(error: unknown): void {
        this._error = error;
        this.updateFailureState();
    }

    private updateFailureState(): void {
        this._state = [...this._projections.values()].some(outcome => outcome.state === 'successful')
            ? 'partially-failed' : 'failed';
    }
}

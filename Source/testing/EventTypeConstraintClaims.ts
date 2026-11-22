// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConstraintViolation } from '@cratis/chronicle.contracts';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import { eventTypeScopeKey, scopeIndex } from './ConstraintScope.js';

const unavailable = '18446744073709551615';

/** Tracks unique event type cycles within one append over committed history. */
export class EventTypeConstraintClaims {
    private readonly _stagedCycles = new Map<string, Map<string, Map<string, 'open' | 'released'>>>();

    constructor(private readonly _definitions: ReadonlyMap<string, ConstraintCapture>,
        private readonly _history: readonly AppendedEvent[]) { }

    validate(name: string, definition: ConstraintCapture, event: AppendedEvent): ConstraintViolation[] {
        const uniqueType = definition.uniqueEventType;
        if (!uniqueType) return [];
        const type = event.eventType.id.value;
        if (!(uniqueType.eventTypeIds ?? [uniqueType.eventTypeId]).includes(type)) return [];
        const source = event.context.eventSourceId;
        const scope = eventTypeScopeKey(definition.scope, event.context);
        const first = this.firstCoveredEvent(definition, source, scope);
        const cycles = scopeIndex(this._stagedCycles, name, scope, () => new Map<string, 'open' | 'released'>());
        // A cycle state recorded earlier in this append overrides durable history.
        if (this.isClaimed(cycles.get(source), first)) {
            // Durable storage supplies the sequence even when a staged claim causes rejection.
            const sequence = first?.context.sequenceNumber.toString() ?? unavailable;
            return [{ EventTypeId: type, SequenceNumber: BigInt(sequence), ConstraintType: 2,
                ConstraintName: name,
                Message: `Event '${type}' violated a unique event type constraint on sequence number ${sequence}`,
                Details: {} }];
        }
        cycles.set(source, 'open');
        return [];
    }

    release(event: AppendedEvent): void {
        for (const [name, definition] of this._definitions) {
            if (definition.uniqueEventType?.removedWithEventTypeIds?.includes(event.eventType.id.value)) {
                const cycles = scopeIndex(this._stagedCycles, name, eventTypeScopeKey(definition.scope, event.context),
                    () => new Map<string, 'open' | 'released'>());
                cycles.set(event.context.eventSourceId, 'released');
            }
        }
    }

    private firstCoveredEvent(definition: ConstraintCapture, source: string, scope: string): AppendedEvent | undefined {
        const uniqueType = definition.uniqueEventType!;
        const covered = uniqueType.eventTypeIds ?? [uniqueType.eventTypeId];
        const removals = uniqueType.removedWithEventTypeIds ?? [];
        // Durable answer: the earliest covered event after the latest removal for this source.
        let first: AppendedEvent | undefined;
        for (const prior of this._history) {
            if (prior.context.eventSourceId !== source || eventTypeScopeKey(definition.scope, prior.context) !== scope) continue;
            const priorType = prior.eventType.id.value;
            if (removals.includes(priorType)) first = undefined;
            else if (!first && covered.includes(priorType)) first = prior;
        }
        return first;
    }

    private isClaimed(state: 'open' | 'released' | undefined, first: AppendedEvent | undefined): boolean {
        return state === 'open' || state === undefined && first !== undefined;
    }
}

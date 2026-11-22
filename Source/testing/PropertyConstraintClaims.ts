// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConstraintViolation } from '@cratis/chronicle.contracts';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import type { JsonSchema } from '../schemas/JsonSchema.js';
import { claimOf } from './ConstraintKey.js';
import { propertyScopeKey, scopeIndex } from './ConstraintScope.js';

const unavailable = '18446744073709551615';

/** Rebuilds durable property ownership and keeps append-local claims independent. */
export class PropertyConstraintClaims {
    private readonly _owners = new Map<string, Map<string, Map<string, { key: string; sequence: string }>>>();
    private readonly _stagedKeys = new Map<string, Map<string, Map<string, string>>>();

    constructor(private readonly _definitions: ReadonlyMap<string, ConstraintCapture>,
        private readonly _schemas: ReadonlyMap<string, JsonSchema>, history: readonly AppendedEvent[]) {
        // Durable ownership is one claim per source, not one entry per historical value.
        // Batch claims remain independent and are never released.
        for (const [name, definition] of _definitions) {
            if (definition.uniqueConstraint) this.replay(name, definition, history);
        }
    }

    validate(name: string, definition: ConstraintCapture, event: AppendedEvent): ConstraintViolation[] {
        const type = event.eventType.id.value;
        const source = event.context.eventSourceId;
        const claim = definition.uniqueConstraint && claimOf(name, definition, event, this.keyOptions(type));
        if (!claim) return [];
        const key = claim.key;
        const scope = propertyScopeKey(definition.scope, event.context);
        const durableClaims = this._owners.get(name)?.get(scope);
        const existing = [...(durableClaims?.entries() ?? [])].find(([, claim]) => claim.key === key);
        const batchClaims = scopeIndex(this._stagedKeys, name, scope, () => new Map<string, string>());
        if (this.isOtherOwner(existing?.[0], source) || this.isOtherOwner(batchClaims.get(key), source)) {
            // One violation per declared property, in declared order, each with its own original value.
            const sequence = existing?.[1].sequence ?? unavailable;
            return claim.parts.map(({ property, raw }) => ({ EventTypeId: type, SequenceNumber: BigInt(sequence), ConstraintType: 1,
                ConstraintName: name,
                Message: `Event '${type}' on member '${property}' violated a unique constraint on sequence number ${sequence}`,
                Details: { PropertyName: property, PropertyValue: raw } }));
        }
        batchClaims.set(key, source);
        return [];
    }

    private replay(name: string, definition: ConstraintCapture, history: readonly AppendedEvent[]): void {
        const unique = definition.uniqueConstraint!;
        const removals = new Set([unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])]);
        for (const prior of history) {
            const type = prior.eventType.id.value;
            const source = prior.context.eventSourceId;
            const claims = scopeIndex(this._owners, name, propertyScopeKey(definition.scope, prior.context),
                () => new Map<string, { key: string; sequence: string }>());
            if (removals.has(type)) {
                claims.delete(source);
                continue;
            }
            const properties = unique.eventDefinitions.find(entry => entry.eventTypeId === type)?.properties;
            if (properties === undefined) continue;
            claims.set(source, { key: claimOf(name, definition, prior, this.keyOptions(type))!.key,
                sequence: prior.context.sequenceNumber.toString() });
        }
    }

    private keyOptions(type: string) {
        return { schema: this._schemas.get(type), isolated: this._definitions.size === 1 };
    }

    private isOtherOwner(owner: string | undefined, source: string): boolean {
        return owner !== undefined && owner !== source;
    }
}

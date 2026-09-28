// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import type { ConstraintViolation as ContractsConstraintViolation } from '@cratis/chronicle.contracts';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import { resolveConstraintMessage } from '../events/constraints/Constraints.js';
import type { ConstraintViolation } from '../eventSequences/ConstraintViolation.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

export type WireConstraintViolation = ContractsConstraintViolation;

const unavailable = '18446744073709551615';
// Only the key characters captured by the packaged oracle, not every valid event-content character.
const provenString = /^[A-Za-z0-9 .@_:\-|{}$\u00e9]*$/;

function kernelKeyString(value: unknown, name: string): string {
    if (typeof value === 'string' && provenString.test(value)) return value;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
        'Only fixture-backed scalar string and boolean keys are supported.');
}

function keyHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

/** Narrow, fixture-backed unscoped constraint validation over serialized event snapshots. */
export class InProcessConstraints {
    private readonly _constrainedProperties = new Map<string, Set<string>>();
    private readonly _removalTypes = new Set<string>();

    constructor(private readonly _definitions: ReadonlyMap<string, ConstraintCapture>) {
        const coveredTypes = new Map<string, string>();
        for (const [name, capture] of _definitions) {
            if (capture.uniqueConstraint && capture.uniqueEventType) {
                throw this.unsupported(name, 'A definition with both constraint kinds is not fixture-backed.');
            }
            if (capture.scope.perEventSourceType || capture.scope.perEventStreamType || capture.scope.perEventStreamId) {
                throw this.unsupported(name, 'Scoped constraints are not fixture-backed.');
            }
            if (capture.uniqueConstraint) {
                const unique = capture.uniqueConstraint;
                if (unique.ignoreCasing || unique.eventDefinitions.length === 0 ||
                    unique.eventDefinitions.some(entry => entry.properties.length !== 1 ||
                        !/^[a-z][a-zA-Z0-9]*$/.test(entry.properties[0]))) {
                    throw this.unsupported(name, 'Case folding and composite or nested keys are not fixture-backed.');
                }
                for (const id of [unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])]) {
                    if (id !== undefined) this._removalTypes.add(id);
                }
                for (const entry of unique.eventDefinitions) {
                    const properties = this._constrainedProperties.get(entry.eventTypeId) ?? new Set<string>();
                    properties.add(entry.properties[0]);
                    this._constrainedProperties.set(entry.eventTypeId, properties);
                }
            } else if (capture.uniqueEventType) {
                const unique = capture.uniqueEventType;
                if (unique.removedWithEventTypeIds?.length || (unique.eventTypeIds?.length ?? 1) !== 1) {
                    throw this.unsupported(name, 'Removal and multi-type unique event cycles are not fixture-backed.');
                }
            } else {
                throw this.unsupported(name, 'Unknown constraint definition.');
            }
            const ids = capture.uniqueConstraint?.eventDefinitions.map(entry => entry.eventTypeId) ??
                capture.uniqueEventType?.eventTypeIds ?? [capture.uniqueEventType!.eventTypeId];
            for (const id of ids) {
                if (coveredTypes.has(id)) throw this.unsupported(name, 'Overlapping constraints are not fixture-backed.');
                coveredTypes.set(id, name);
            }
        }
        for (const [name, definition] of _definitions) {
            const unique = definition.uniqueConstraint;
            if (!unique) continue;
            for (const id of [unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])]) {
                if (id !== undefined && coveredTypes.has(id) && coveredTypes.get(id) !== name) {
                    throw this.unsupported(name, 'Removal overlapping another validating definition is not fixture-backed.');
                }
            }
        }
    }

    isRemovalOnlyType(eventTypeId: string): boolean {
        return this._removalTypes.has(eventTypeId) && !this._constrainedProperties.has(eventTypeId);
    }

    hasRemovalType(eventTypeId: string): boolean { return this._removalTypes.has(eventTypeId); }

    isConstrainedProperty(eventTypeId: string, property: string): boolean {
        return this._constrainedProperties.get(eventTypeId)?.has(property) ?? false;
    }

    /** Validate against committed history and all earlier entries of this append, without changing state. */
    validate(history: readonly AppendedEvent[], incoming: readonly AppendedEvent[]): WireConstraintViolation[] {
        const violations: WireConstraintViolation[] = [];
        // Durable ownership is one claim per source, not one entry per historical value.
        // Rebuild it from committed history; batch claims below remain independent and are never released.
        const owners = new Map<string, Map<string, { key: string; sequence: string }>>();
        for (const [name, definition] of this._definitions) {
            if (!definition.uniqueConstraint) continue;
            const claims = new Map<string, { key: string; sequence: string }>();
            const unique = definition.uniqueConstraint;
            const removals = new Set([unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])]);
            for (const prior of history) {
                const type = prior.eventType.id.value;
                const source = prior.context.eventSourceId;
                if (removals.has(type)) {
                    claims.delete(source);
                    continue;
                }
                const property = unique.eventDefinitions.find(entry => entry.eventTypeId === type)?.properties[0];
                if (property === undefined) continue;
                const value = prior.content[property];
                if (typeof value !== 'string' && typeof value !== 'boolean') throw this.unsupported(name, 'History has an unproven key.');
                claims.set(source, { key: keyHash(kernelKeyString(value, name)),
                    sequence: prior.context.sequenceNumber.toString() });
            }
            owners.set(name, claims);
        }
        const stagedKeys = new Map<string, Map<string, string>>();
        const stagedTypes = new Set<string>();
        for (const event of incoming) {
            const type = event.eventType.id.value;
            const source = event.context.eventSourceId;
            for (const [name, definition] of this._definitions) {
                const property = definition.uniqueConstraint?.eventDefinitions.find(entry => entry.eventTypeId === type)?.properties[0];
                if (property !== undefined) {
                    const raw = kernelKeyString(event.content[property], name);
                    const key = keyHash(raw);
                    const existing = [...owners.get(name)!.entries()].find(([, claim]) => claim.key === key);
                    const batchClaims = stagedKeys.get(name) ?? new Map<string, string>();
                    const batchOwner = batchClaims.get(key);
                    if (existing && existing[0] !== source || batchOwner !== undefined && batchOwner !== source) {
                        const details = { PropertyName: property, PropertyValue: raw };
                        violations.push({ EventTypeId: type, SequenceNumber: BigInt(existing?.[1].sequence ?? unavailable), ConstraintType: 1,
                            ConstraintName: name,
                            Message: `Event '${type}' on member '${property}' violated a unique constraint on sequence number ${existing?.[1].sequence ?? unavailable}`,
                            Details: details });
                    } else {
                        batchClaims.set(key, source);
                        stagedKeys.set(name, batchClaims);
                    }
                }
                const uniqueType = definition.uniqueEventType;
                if (uniqueType && (uniqueType.eventTypeIds ?? [uniqueType.eventTypeId]).includes(type)) {
                    const first = history.find(prior => prior.context.eventSourceId === source &&
                        (uniqueType.eventTypeIds ?? [uniqueType.eventTypeId]).includes(prior.eventType.id.value));
                    const staged = stagedTypes.has(`${name}\u0000${source}`);
                    if (first || staged) {
                        violations.push({ EventTypeId: type, SequenceNumber: first?.context.sequenceNumber ?? BigInt(unavailable), ConstraintType: 2,
                            ConstraintName: name,
                            Message: `Event '${type}' violated a unique event type constraint on sequence number ${first?.context.sequenceNumber.toString() ?? unavailable}`,
                            Details: {} });
                    } else stagedTypes.add(`${name}\u0000${source}`);
                }
            }
        }
        return violations;
    }

    resolveMessage(violation: ConstraintViolation): ConstraintViolation {
        return resolveConstraintMessage(this._definitions, violation);
    }

    private unsupported(name: string, reason: string): UnsupportedEventSequenceOperation {
        return new UnsupportedEventSequenceOperation('artifacts.constraints', name, reason);
    }
}

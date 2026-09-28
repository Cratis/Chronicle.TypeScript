// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import { resolveConstraintMessage } from '../events/constraints/Constraints.js';
import type { ConstraintViolation } from '../eventSequences/ConstraintViolation.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

export type WireConstraintViolation = { ConstraintId: string; Message: string; Details: Record<string, string> };
const unavailable = '18446744073709551615';

/** Narrow, fixture-backed unscoped constraint validation over serialized event snapshots. */
export class InProcessConstraints {
    constructor(private readonly _definitions: ReadonlyMap<string, ConstraintCapture>) {
        for (const [name, capture] of _definitions) {
            if (capture.uniqueConstraint && capture.uniqueEventType) {
                throw this.unsupported(name, 'A definition with both constraint kinds is not fixture-backed.');
            }
            if (capture.scope.perEventSourceType || capture.scope.perEventStreamType || capture.scope.perEventStreamId) {
                throw this.unsupported(name, 'Scoped constraints are not fixture-backed.');
            }
            if (capture.uniqueConstraint) {
                const unique = capture.uniqueConstraint;
                if (unique.ignoreCasing || unique.removedWithEventTypeId || unique.removedWithEventTypeIds?.length ||
                    unique.eventDefinitions.length === 0 || unique.eventDefinitions.some(entry => entry.properties.length !== 1 ||
                        !/^[a-z][a-zA-Z0-9]*$/.test(entry.properties[0]))) {
                    throw this.unsupported(name, 'Case folding, removal and composite or nested keys are not fixture-backed.');
                }
            } else if (capture.uniqueEventType) {
                const unique = capture.uniqueEventType;
                if (unique.removedWithEventTypeIds?.length || (unique.eventTypeIds?.length ?? 1) !== 1) {
                    throw this.unsupported(name, 'Removal and multi-type unique event cycles are not fixture-backed.');
                }
            } else {
                throw this.unsupported(name, 'Unknown constraint definition.');
            }
        }
    }

    /** Validate against committed history and all earlier entries of this append, without changing state. */
    validate(history: readonly AppendedEvent[], incoming: readonly AppendedEvent[]): WireConstraintViolation[] {
        const violations: WireConstraintViolation[] = [];
        const stagedKeys = new Map<string, string>();
        const stagedTypes = new Set<string>();
        for (const event of incoming) {
            const type = event.eventType.id.value;
            const source = event.context.eventSourceId;
            for (const [name, definition] of this._definitions) {
                const property = definition.uniqueConstraint?.eventDefinitions.find(entry => entry.eventTypeId === type)?.properties[0];
                if (property !== undefined) {
                    const raw = event.content[property];
                    // The oracle proves ordinal ASCII casing and significant spaces; no .NET Unicode folding or conversion is inferred.
                    if (typeof raw !== 'string' || !/^[A-Za-z ]+$/.test(raw)) {
                        throw this.unsupported(name, 'Only nonempty ASCII letter and space string keys are fixture-backed.');
                    }
                    const key = createHash('sha256').update(raw).digest('hex');
                    const claims = new Map<string, { source: string; sequence: string }>();
                    const owners = new Map<string, string>();
                    for (const prior of history) {
                        const priorProperty = definition.uniqueConstraint!.eventDefinitions.find(entry =>
                            entry.eventTypeId === prior.eventType.id.value)?.properties[0];
                        if (priorProperty !== undefined) {
                            const priorValue = prior.content[priorProperty];
                            if (typeof priorValue !== 'string') throw this.unsupported(name, 'History has an unproven key.');
                            owners.set(prior.context.eventSourceId, createHash('sha256').update(priorValue).digest('hex'));
                            claims.set(createHash('sha256').update(priorValue).digest('hex'), {
                                source: prior.context.eventSourceId, sequence: prior.context.sequenceNumber.toString()
                            });
                        }
                    }
                    const ownerKey = owners.get(source);
                    if (ownerKey !== undefined && ownerKey !== key) {
                        throw this.unsupported(name, 'Replacing a unique key is not fixture-backed.');
                    }
                    const stagedOwner = stagedKeys.get(`${name}\u0000${source}`);
                    if (stagedOwner !== undefined && stagedOwner !== key) {
                        throw this.unsupported(name, 'Replacing a key within one batch is not fixture-backed.');
                    }
                    const existing = claims.get(key);
                    const batchOwner = stagedKeys.get(`${name}\u0001${key}`);
                    if (existing && existing.source !== source || batchOwner && batchOwner !== source) {
                        const details = { PropertyName: property, PropertyValue: raw };
                        violations.push({ ConstraintId: name,
                            Message: `Event '${type}' on member '${property}' violated a unique constraint on sequence number ${existing?.sequence ?? unavailable}`,
                            Details: details });
                    } else {
                        stagedKeys.set(`${name}\u0000${source}`, key);
                        stagedKeys.set(`${name}\u0001${key}`, source);
                    }
                }
                const uniqueType = definition.uniqueEventType;
                if (uniqueType && (uniqueType.eventTypeIds ?? [uniqueType.eventTypeId]).includes(type)) {
                    const first = history.find(prior => prior.context.eventSourceId === source &&
                        (uniqueType.eventTypeIds ?? [uniqueType.eventTypeId]).includes(prior.eventType.id.value));
                    const staged = stagedTypes.has(`${name}\u0000${source}`);
                    if (first || staged) {
                        violations.push({ ConstraintId: name,
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

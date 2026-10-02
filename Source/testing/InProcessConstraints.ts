// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import type { ConstraintViolation as ContractsConstraintViolation } from '@cratis/chronicle.contracts';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import { resolveConstraintMessage } from '../events/constraints/Constraints.js';
import type { ConstraintViolation } from '../eventSequences/ConstraintViolation.js';
import type { JsonSchema } from '../schemas/JsonSchema.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';
import { eventTypeScopeKey, propertyScopeKey, scopeIndex } from './ConstraintScope.js';

export type WireConstraintViolation = ContractsConstraintViolation;

const unavailable = '18446744073709551615';
// Only the key characters captured by the packaged oracle, not every valid event-content character.
const provenString = /^[A-Za-z0-9 .@_:\-|{}$\u00e9]*$/;

function kernelKeyString(value: unknown, name: string, schema?: JsonSchema): string {
    // constraints-field-types.json: the kernel converts Guid keys before comparing or reporting them.
    if (schema?.format === 'guid' || schema?.format === 'uuid') {
        if (typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) return value.toLowerCase();
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name, 'Only dashed Guid keys are fixture-backed.');
    }
    // Avoid .NET floating-point formatting, exponent spelling and JavaScript precision loss.
    if (schema?.type === 'number') {
        if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Only safe-integer numeric keys are fixture-backed; fractional, exponential and unsafe-integer comparisons require a kernel-backed test.');
    }
    if (typeof value === 'string' && provenString.test(value)) return value;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
        'Only fixture-backed scalar string and boolean keys are supported.');
}

function keyHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

type UniqueCapture = NonNullable<ConstraintCapture['uniqueConstraint']>;
type Claim = { key: string; parts: Array<{ property: string; raw: string }> };

/**
 * The kernel key: each declared property's string in declared order, joined with a literal '-'
 * (UniqueConstraintDefinitionExtensions.GetPropertiesAndValues/GetValue at Chronicle 8fe5d30). Not a tuple:
 * ['a-b', 'c'] and ['a', 'b-c'] claim the same key, as constraints-composite.json captures.
 */
function claimOf(name: string, unique: UniqueCapture, eventTypeId: string, content: Record<string, unknown>, schema?: JsonSchema): Claim | undefined {
    const properties = unique.eventDefinitions.find(entry => entry.eventTypeId === eventTypeId)?.properties;
    if (properties === undefined) return undefined;
    const parts = properties.map(property => ({ property, raw: kernelKeyString(content[property], name, schema?.properties?.[property]) }));
    const joined = parts.map(part => part.raw).join('-');
    if (!unique.ignoreCasing) return { key: keyHash(joined), parts };
    // The kernel applies .NET ToLowerInvariant to the joined value. constraints-ignore-casing.json proves
    // only the ASCII key domain, where that is exactly A-Z to a-z; host Unicode case tables are not used.
    if (!/^[\x20-\x7e]*$/.test(joined)) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Case-insensitive keys outside the ASCII key domain are not fixture-backed.');
    }
    return { key: keyHash(joined.replace(/[A-Z]/g, letter => String.fromCharCode(letter.charCodeAt(0) + 32))), parts };
}

/** Narrow, fixture-backed constraint validation over serialized event snapshots. */
export class InProcessConstraints {
    private readonly _constrainedProperties = new Map<string, Set<string>>();
    private readonly _removalTypes = new Set<string>();
    private readonly _propertyRemovalTypes = new Set<string>();

    constructor(private readonly _definitions: ReadonlyMap<string, ConstraintCapture>,
        private readonly _schemas: ReadonlyMap<string, JsonSchema> = new Map()) {
        const coveredTypes = new Map<string, string>();
        const removalOwners = new Map<string, string>();
        for (const [name, capture] of _definitions) {
            if (capture.uniqueConstraint && capture.uniqueEventType) {
                throw this.unsupported(name, 'A definition with both constraint kinds is not fixture-backed.');
            }
            const scoped = Object.values(capture.scope).some(Boolean);
            if (scoped && _definitions.size !== 1) {
                throw this.unsupported(name, 'Scoped constraints alongside other definitions are not fixture-backed.');
            }
            if (capture.uniqueConstraint) {
                const unique = capture.uniqueConstraint;
                if (scoped && (unique.ignoreCasing || unique.eventDefinitions.some(entry => entry.properties.length !== 1))) {
                    throw this.unsupported(name, 'Scoped composite or case-insensitive property keys are not fixture-backed.');
                }
                // constraints-composite.json installs one, two and three flat properties per event type.
                // The kernel keys properties by path with ToDictionary, so duplicate paths are not a key shape.
                if (unique.eventDefinitions.length === 0 || unique.eventDefinitions.some(entry =>
                    entry.properties.length < 1 || entry.properties.length > 3 ||
                    new Set(entry.properties).size !== entry.properties.length ||
                    entry.properties.some(property => !/^[a-z][a-zA-Z0-9]*$/.test(property)))) {
                    throw this.unsupported(name, 'Only one to three distinct flat properties per event type are fixture-backed; nested, indexed or repeated key paths are not.');
                }
                for (const id of [unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])]) {
                    if (id === undefined) continue;
                    const owner = removalOwners.get(id);
                    if (owner !== undefined && owner !== name) {
                        throw this.unsupported(name, 'Removal type shared by several definitions is not fixture-backed.');
                    }
                    removalOwners.set(id, name);
                    this._removalTypes.add(id);
                    this._propertyRemovalTypes.add(id);
                }
                if (scoped && unique.eventDefinitions.some(entry =>
                    entry.eventTypeId === unique.removedWithEventTypeId || unique.removedWithEventTypeIds?.includes(entry.eventTypeId))) {
                    throw this.unsupported(name, 'Scoped covered-and-removal property events are not fixture-backed.');
                }
                for (const entry of unique.eventDefinitions) {
                    const properties = this._constrainedProperties.get(entry.eventTypeId) ?? new Set<string>();
                    entry.properties.forEach(property => properties.add(property));
                    this._constrainedProperties.set(entry.eventTypeId, properties);
                }
            } else if (capture.uniqueEventType) {
                const unique = capture.uniqueEventType;
                const ids = unique.eventTypeIds ?? [unique.eventTypeId];
                const removals = unique.removedWithEventTypeIds ?? [];
                const shared = ids.filter(id => removals.includes(id)).length;
                // Exactly the shapes installed by the pinned fixtures: one covered type without removal
                // (constraints.json), two covered types with two separate removers
                // (constraints-event-type-siblings.json), and three covered types with three removers of
                // which one is also covered (constraints-event-type-cycles.json).
                if (!(ids.length === 1 && removals.length === 0) &&
                    !(ids.length === 2 && removals.length === 2 && shared === 0) &&
                    !(ids.length === 3 && removals.length === 3 && shared === 1)) {
                    throw this.unsupported(name, 'This unique event type set and removal combination is not fixture-backed.');
                }
                if (scoped && shared !== 0) {
                    throw this.unsupported(name, 'Scoped covered-and-removal event cycles are not fixture-backed.');
                }
                // Each cycle fixture installs its definition alone; interaction with other definitions is unproven.
                if (removals.length && _definitions.size !== 1) {
                    throw this.unsupported(name, 'Unique event cycles alongside other definitions are not fixture-backed.');
                }
                removals.forEach(id => this._removalTypes.add(id));
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
        return this._propertyRemovalTypes.has(eventTypeId) && !this._constrainedProperties.has(eventTypeId);
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
        const owners = new Map<string, Map<string, Map<string, { key: string; sequence: string }>>>();
        for (const [name, definition] of this._definitions) {
            if (!definition.uniqueConstraint) continue;
            const unique = definition.uniqueConstraint;
            const removals = new Set([unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])]);
            for (const prior of history) {
                const type = prior.eventType.id.value;
                const source = prior.context.eventSourceId;
                const claims = scopeIndex(owners, name, propertyScopeKey(definition.scope, prior.context),
                    () => new Map<string, { key: string; sequence: string }>());
                if (removals.has(type)) {
                    claims.delete(source);
                    continue;
                }
                const properties = unique.eventDefinitions.find(entry => entry.eventTypeId === type)?.properties;
                if (properties === undefined) continue;
                claims.set(source, { key: claimOf(name, unique, type, prior.content, this._schemas.get(type))!.key,
                    sequence: prior.context.sequenceNumber.toString() });
            }
        }
        const stagedKeys = new Map<string, Map<string, Map<string, string>>>();
        const stagedCycles = new Map<string, Map<string, Map<string, 'open' | 'released'>>>();
        for (const event of incoming) {
            const type = event.eventType.id.value;
            const source = event.context.eventSourceId;
            const violationCount = violations.length;
            for (const [name, definition] of this._definitions) {
                const claim = definition.uniqueConstraint && claimOf(name, definition.uniqueConstraint, type, event.content, this._schemas.get(type));
                if (claim) {
                    const key = claim.key;
                    const scope = propertyScopeKey(definition.scope, event.context);
                    const durableClaims = owners.get(name)?.get(scope);
                    const existing = [...(durableClaims?.entries() ?? [])].find(([, claim]) => claim.key === key);
                    const batchClaims = scopeIndex(stagedKeys, name, scope, () => new Map<string, string>());
                    const batchOwner = batchClaims.get(key);
                    if (existing && existing[0] !== source || batchOwner !== undefined && batchOwner !== source) {
                        // One violation per declared property, in declared order, each with its own original value.
                        const sequence = existing?.[1].sequence ?? unavailable;
                        for (const { property, raw } of claim.parts) {
                            violations.push({ EventTypeId: type, SequenceNumber: BigInt(sequence), ConstraintType: 1,
                                ConstraintName: name,
                                Message: `Event '${type}' on member '${property}' violated a unique constraint on sequence number ${sequence}`,
                                Details: { PropertyName: property, PropertyValue: raw } });
                        }
                    } else {
                        batchClaims.set(key, source);
                    }
                }
                const uniqueType = definition.uniqueEventType;
                if (uniqueType && (uniqueType.eventTypeIds ?? [uniqueType.eventTypeId]).includes(type)) {
                    const covered = uniqueType.eventTypeIds ?? [uniqueType.eventTypeId];
                    const removals = uniqueType.removedWithEventTypeIds ?? [];
                    // Durable answer: the earliest covered event after the latest removal for this source.
                    const scope = eventTypeScopeKey(definition.scope, event.context);
                    let first: AppendedEvent | undefined;
                    for (const prior of history) {
                        if (prior.context.eventSourceId !== source || eventTypeScopeKey(definition.scope, prior.context) !== scope) continue;
                        const priorType = prior.eventType.id.value;
                        if (removals.includes(priorType)) first = undefined;
                        else if (!first && covered.includes(priorType)) first = prior;
                    }
                    const cycles = scopeIndex(stagedCycles, name, scope, () => new Map<string, 'open' | 'released'>());
                    const state = cycles.get(source);
                    // A cycle state recorded earlier in this append overrides durable history.
                    if (state === 'open' || state === undefined && first) {
                        // Durable storage supplies the sequence even when a staged claim causes rejection.
                        const sequence = first?.context.sequenceNumber.toString() ?? unavailable;
                        violations.push({ EventTypeId: type, SequenceNumber: BigInt(sequence), ConstraintType: 2,
                            ConstraintName: name,
                            Message: `Event '${type}' violated a unique event type constraint on sequence number ${sequence}`,
                            Details: {} });
                    } else {
                        cycles.set(source, 'open');
                    }
                }
            }
            // Kernel batch observers release a cycle only after the entire event validates.
            // A covered-and-removal event first attempts its claim, then releases it.
            if (violations.length === violationCount) {
                for (const [name, definition] of this._definitions) {
                    if (definition.uniqueEventType?.removedWithEventTypeIds?.includes(type)) {
                        const cycles = scopeIndex(stagedCycles, name, eventTypeScopeKey(definition.scope, event.context),
                            () => new Map<string, 'open' | 'released'>());
                        cycles.set(source, 'released');
                    }
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

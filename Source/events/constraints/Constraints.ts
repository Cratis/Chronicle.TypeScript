// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConstraintType } from '@cratis/chronicle.contracts';
import type { ConstraintViolation } from '../../eventSequences/ConstraintViolation.js';
import { IClientArtifactsProvider } from '../../artifacts/index.js';
import { ChronicleConnection } from '../../connection/index.js';
import { ConstraintId } from './ConstraintId.js';
import { IConstraint } from './IConstraint.js';
import { IConstraints } from './IConstraints.js';
import { ConstraintBuilder, ConstraintCapture } from './ConstraintBuilder.js';
import { UniqueConstraintBuilder } from './UniqueConstraintBuilder.js';
import { getConstraintMetadata } from './constraint.js';
import { getUniqueEventMetadata, getUniquePropertyMetadata } from './unique.js';
import { getRemovedConstraintNames } from './removeConstraint.js';
import { TypeIntrospector } from '../../types/TypeIntrospector.js';
import { getEventTypeFor } from '../eventTypeDecorator.js';

/** Resolves the name registered with the Chronicle Kernel. */
function wireNameOf(capture: ConstraintCapture): string {
    return capture.uniqueEventType?.name ?? capture.name;
}

/** Manages discovery and registration of constraints with the Chronicle Kernel. */
export class Constraints implements IConstraints {
    private readonly _captures = new Map<string, ConstraintCapture>();

    /**
     * Creates a new {@link Constraints} instance.
     * @param _eventStore - The name of the event store these constraints belong to.
     * @param _connection - The connection used to communicate with the Kernel.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._captures.clear();
        for (const type of this._clientArtifacts.constraints) {
            const metadata = getConstraintMetadata(type);
            if (!metadata) continue;

            const builder = new ConstraintBuilder(metadata.id.value);
            const instance = new (type as new () => IConstraint)();
            instance.define(builder);
            const capture = builder.capture;
            const name = wireNameOf(capture);
            const existing = this._captures.get(name);
            if (existing?.uniqueEventType && capture.uniqueEventType) {
                const merged = existing.uniqueEventType;
                const ids = merged.eventTypeIds ??= [merged.eventTypeId];
                for (const id of capture.uniqueEventType.eventTypeIds ?? [capture.uniqueEventType.eventTypeId]) {
                    if (!ids.includes(id)) ids.push(id);
                }
                const removedWith = merged.removedWithEventTypeIds ??= [];
                for (const id of capture.uniqueEventType.removedWithEventTypeIds ?? []) {
                    if (!removedWith.includes(id)) removedWith.push(id);
                }
            } else if (existing) {
                throw new Error(`Duplicate constraint name '${name}'.`);
            } else {
                this._captures.set(name, capture);
            }
        }

        const removalEvents = new Map<string, Function[]>();
        for (const eventType of this._clientArtifacts.eventTypes) {
            for (const name of getRemovedConstraintNames(eventType)) {
                const events = removalEvents.get(name) ?? [];
                events.push(eventType);
                removalEvents.set(name, events);
            }
        }

        for (const eventType of this._clientArtifacts.eventTypes) {
            const eventMetadata = getUniqueEventMetadata(eventType);
            if (eventMetadata) {
                const name = eventMetadata.name ?? eventType.name;
                let capture = this._captures.get(name);
                if (!capture) {
                    const builder = new ConstraintBuilder(name);
                    builder.uniqueFor(eventType, eventMetadata.message, name);
                    capture = builder.capture;
                    this._captures.set(name, capture);
                } else if (!capture.uniqueEventType) {
                    throw new Error(`Constraint '${name}' is not a unique event type constraint.`);
                } else {
                    capture.uniqueEventType.eventTypeIds ??= [capture.uniqueEventType.eventTypeId];
                    const id = getEventTypeFor(eventType).id.value;
                    if (!capture.uniqueEventType.eventTypeIds.includes(id)) capture.uniqueEventType.eventTypeIds.push(id);
                }
            }

            for (const property of TypeIntrospector.getTrackedProperties(eventType)) {
                const metadata = getUniquePropertyMetadata(eventType, property);
                if (!metadata) continue;
                const name = metadata.name ?? property;
                let capture = this._captures.get(name);
                if (!capture) {
                    const builder = new ConstraintBuilder(name);
                    builder.unique(() => {});
                    capture = builder.capture;
                    this._captures.set(name, capture);
                }
                if (!capture.uniqueConstraint) throw new Error(`Constraint '${name}' is not a unique property constraint.`);
                const unique = new UniqueConstraintBuilder(capture.uniqueConstraint);
                const id = getEventTypeFor(eventType).id.value;
                const existing = capture.uniqueConstraint.eventDefinitions.find(definition => definition.eventTypeId === id);
                if (existing && !existing.properties.includes(property)) {
                    throw new Error(`Event type '${id}' already added to unique constraint '${name}' with properties '${existing.properties.join(', ')}'.`);
                }
                if (!existing) unique.on(eventType, event => (event as Record<string, unknown>)[property]);
                if (metadata.message && !capture.uniqueConstraint.message) unique.withMessage(metadata.message);
            }
        }

        for (const [name, eventTypes] of removalEvents) {
            const capture = this._captures.get(name);
            if (capture) {
                if (capture.uniqueConstraint) {
                    const unique = new UniqueConstraintBuilder(capture.uniqueConstraint);
                    eventTypes.forEach(eventType => unique.removedWith(eventType));
                } else if (capture.uniqueEventType) {
                    const removedWith = capture.uniqueEventType.removedWithEventTypeIds ??= [];
                    for (const eventType of eventTypes) {
                        const id = getEventTypeFor(eventType).id.value;
                        if (!removedWith.includes(id)) removedWith.push(id);
                    }
                }
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._captures.size === 0) {
            await this.discover();
        }

        const constraints = [...this._captures.values()].map(capture => {
            const scope = {
                EventSourceType: capture.scope.perEventSourceType ? '*' : '',
                EventStreamType: capture.scope.perEventStreamType ? '*' : '',
                EventStreamId: capture.scope.perEventStreamId ? '*' : ''
            };

            if (capture.uniqueConstraint) {
                const uc = capture.uniqueConstraint;
                const removalEventTypeIds = uc.removedWithEventTypeIds ?? [];
                const legacyEventTypeId = uc.removedWithEventTypeId;
                return {
                    Name: capture.name,
                    Type: ConstraintType.Unique,
                    RemovedWith: [...new Set([
                        ...(legacyEventTypeId && !removalEventTypeIds.includes(legacyEventTypeId) ? [legacyEventTypeId] : []),
                        ...removalEventTypeIds
                    ])],
                    Definition: {
                        Value0: {
                            EventDefinitions: uc.eventDefinitions.map(ed => ({
                                EventTypeId: ed.eventTypeId,
                                Properties: ed.properties
                            })),
                            IgnoreCasing: uc.ignoreCasing
                        },
                        Value1: undefined
                    },
                    Scope: scope
                };
            }

            if (capture.uniqueEventType) {
                const uet = capture.uniqueEventType;
                return {
                    Name: uet.name ?? capture.name,
                    Type: ConstraintType.UniqueEventType,
                    RemovedWith: uet.removedWithEventTypeIds ?? [],
                    Definition: {
                        Value0: undefined,
                        Value1: {
                            EventTypeIds: uet.eventTypeIds ?? [uet.eventTypeId]
                        }
                    },
                    Scope: scope
                };
            }

            return {
                Name: capture.name,
                Type: ConstraintType.Unknown,
                RemovedWith: [],
                Definition: undefined,
                Scope: scope
            };
        });

        if (constraints.length === 0) {
            return;
        }

        await this._connection.constraints.register({
            EventStore: this._eventStore,
            Constraints: constraints
        });
    }

    /** @inheritdoc */
    hasFor(id: ConstraintId): boolean {
        return this._captures.has(id.value);
    }

    /**
     * Resolves a configured violation message, preserving the Kernel message when none was supplied.
     * @param violation - Violation returned by the Kernel.
     * @returns The violation with its configured message and substituted details, if available.
     */
    resolveMessageFor(violation: ConstraintViolation): ConstraintViolation {
        const capture = this._captures.get(violation.constraintId);
        const message = capture?.uniqueConstraint?.message ?? capture?.uniqueEventType?.message;
        if (!message) return violation;

        let resolved = message;
        for (const [key, value] of Object.entries(violation.details)) {
            resolved = resolved.replaceAll(`{${key}}`, () => value);
        }
        return { ...violation, message: resolved };
    }
}

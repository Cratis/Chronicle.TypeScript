// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ChronicleConnection, ConstraintType } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../../artifacts';
import { getEventTypeFor } from '../eventTypeDecorator';
import { Grpc } from '../../Grpc';
import { ConstraintId } from './ConstraintId';
import { IConstraint } from './IConstraint';
import { IConstraintBuilder } from './IConstraintBuilder';
import { IConstraints } from './IConstraints';
import { IUniqueConstraintBuilder } from './IUniqueConstraintBuilder';
import { getConstraintMetadata } from './constraint';

/** Resolves a property path string from a {@link PropertyAccessor}. */
function resolvePropertyPath<T>(accessor: PropertyAccessor<T>): string {
    const handler = new PropertyPathResolverProxyHandler();
    const proxy = new Proxy({}, handler);
    accessor(proxy as T);
    return handler.path;
}

/** Captured definition of a unique constraint event entry. */
interface UniqueConstraintEventEntry {
    eventTypeId: string;
    properties: string[];
}

/** Captured definition of a unique constraint. */
interface UniqueConstraintCapture {
    name?: string;
    eventDefinitions: UniqueConstraintEventEntry[];
    ignoreCasing: boolean;
    removedWithEventTypeId?: string;
    message?: string;
}

/** Represents the captured definition of a unique event type constraint. */
interface UniqueEventTypeCapture {
    eventTypeId: string;
    message?: string;
    name?: string;
}

/** Represents the captured scope for a constraint. */
interface ConstraintScopeCapture {
    perEventSourceType: boolean;
    perEventStreamType: boolean;
    perEventStreamId: boolean;
}

/** Represents the full captured definition of a constraint. */
interface ConstraintCapture {
    name: string;
    scope: ConstraintScopeCapture;
    uniqueConstraint?: UniqueConstraintCapture;
    uniqueEventType?: UniqueEventTypeCapture;
}

/** Implementation of {@link IUniqueConstraintBuilder} that captures the unique constraint definition. */
class UniqueConstraintBuilderImpl implements IUniqueConstraintBuilder {
    private readonly _capture: UniqueConstraintCapture;
    private _currentEventTypeId?: string;

    constructor(capture: UniqueConstraintCapture) {
        this._capture = capture;
    }

    /** @inheritdoc */
    withName(name: string): IUniqueConstraintBuilder {
        this._capture.name = name;
        return this;
    }

    /** @inheritdoc */
    on<TEvent>(...properties: PropertyAccessor<TEvent>[]): IUniqueConstraintBuilder {
        if (!this._currentEventTypeId) {
            return this;
        }
        const paths = properties.map(p => resolvePropertyPath(p));
        const existing = this._capture.eventDefinitions.find(d => d.eventTypeId === this._currentEventTypeId);
        if (existing) {
            existing.properties.push(...paths);
        } else {
            this._capture.eventDefinitions.push({ eventTypeId: this._currentEventTypeId, properties: paths });
        }
        return this;
    }

    /** @inheritdoc */
    ignoreCasing(): IUniqueConstraintBuilder {
        this._capture.ignoreCasing = true;
        return this;
    }

    /** @inheritdoc */
    removedWith(eventType: Function): IUniqueConstraintBuilder {
        const et = getEventTypeFor(eventType);
        this._capture.removedWithEventTypeId = et.id.value;
        return this;
    }

    /** @inheritdoc */
    withMessage(message: string): IUniqueConstraintBuilder {
        this._capture.message = message;
        return this;
    }

    /** @inheritdoc */
    withMessageFrom(messageProvider: () => string): IUniqueConstraintBuilder {
        this._capture.message = messageProvider();
        return this;
    }

    /**
     * Sets the current event type context for subsequent {@link on} calls.
     * @param eventTypeId - The event type identifier string.
     */
    withEventType(eventTypeId: string): UniqueConstraintBuilderImpl {
        this._currentEventTypeId = eventTypeId;
        return this;
    }
}

/** Implementation of {@link IConstraintBuilder} that captures the constraint definition. */
class ConstraintBuilderImpl implements IConstraintBuilder {
    readonly capture: ConstraintCapture;
    private _uniqueBuilder?: UniqueConstraintBuilderImpl;

    constructor(name: string) {
        this.capture = {
            name,
            scope: { perEventSourceType: false, perEventStreamType: false, perEventStreamId: false }
        };
    }

    /** @inheritdoc */
    perEventSourceType(): IConstraintBuilder {
        this.capture.scope.perEventSourceType = true;
        return this;
    }

    /** @inheritdoc */
    perEventStreamType(): IConstraintBuilder {
        this.capture.scope.perEventStreamType = true;
        return this;
    }

    /** @inheritdoc */
    perEventStreamId(): IConstraintBuilder {
        this.capture.scope.perEventStreamId = true;
        return this;
    }

    /** @inheritdoc */
    unique(callback: (builder: IUniqueConstraintBuilder) => void): IConstraintBuilder {
        const uniqueCapture: UniqueConstraintCapture = {
            eventDefinitions: [],
            ignoreCasing: false
        };
        this.capture.uniqueConstraint = uniqueCapture;
        this._uniqueBuilder = new UniqueConstraintBuilderImpl(uniqueCapture);
        callback(this._uniqueBuilder);
        return this;
    }

    /** @inheritdoc */
    uniqueFor(eventType: Function, message?: string, name?: string): IConstraintBuilder {
        const et = getEventTypeFor(eventType);
        this.capture.uniqueEventType = {
            eventTypeId: et.id.value,
            message,
            name
        };
        return this;
    }
}

/**
 * Implements {@link IConstraints}, managing discovery and registration of constraints
 * with the Chronicle Kernel.
 */
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

            const builder = new ConstraintBuilderImpl(metadata.id.value);
            const instance = new (type as new () => IConstraint)();
            instance.define(builder);
            this._captures.set(metadata.id.value, builder.capture);
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
                return {
                    Name: capture.name,
                    Type: ConstraintType.Unique,
                    RemovedWith: uc.removedWithEventTypeId ?? '',
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
                    RemovedWith: '',
                    Definition: {
                        Value0: undefined,
                        Value1: {
                            EventTypeId: uet.eventTypeId
                        }
                    },
                    Scope: scope
                };
            }

            return {
                Name: capture.name,
                Type: ConstraintType.Unknown,
                RemovedWith: '',
                Definition: undefined,
                Scope: scope
            };
        });

        if (constraints.length === 0) {
            return;
        }

        await Grpc.call(callback =>
            this._connection.constraints.register(
                {
                    EventStore: this._eventStore,
                    Constraints: constraints
                },
                callback
            )
        );
    }

    /** @inheritdoc */
    hasFor(id: ConstraintId): boolean {
        return this._captures.has(id.value);
    }
}

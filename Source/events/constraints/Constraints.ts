// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConstraintType } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../../artifacts';
import { ChronicleConnection } from '../../connection';
import { ConstraintId } from './ConstraintId';
import { IConstraint } from './IConstraint';
import { IConstraints } from './IConstraints';
import { ConstraintBuilder, ConstraintCapture } from './ConstraintBuilder';
import { getConstraintMetadata } from './constraint';

/**
 * Manages discovery and registration of constraints with the Chronicle Kernel.
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

            const builder = new ConstraintBuilder(metadata.id.value);
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

        await this._connection.constraints.register({
            EventStore: this._eventStore,
            Constraints: constraints
        });
    }

    /** @inheritdoc */
    hasFor(id: ConstraintId): boolean {
        return this._captures.has(id.value);
    }
}

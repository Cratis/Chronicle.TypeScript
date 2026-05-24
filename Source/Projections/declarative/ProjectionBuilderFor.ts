// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { getEventTypeFor } from '../../Events/eventTypeDecorator';
import { EventSequenceId } from '../../EventSequences/EventSequenceId';
import { IChildrenBuilder } from './IChildrenBuilder';
import { IFromBuilder } from './IFromBuilder';
import { IFromEveryBuilder } from './IFromEveryBuilder';
import { IJoinBuilder } from './IJoinBuilder';
import { INestedBuilder } from './INestedBuilder';
import { IProjectionBuilderFor } from './IProjectionBuilderFor';
import { IRemovedWithBuilder } from './IRemovedWithBuilder';
import { IRemovedWithJoinBuilder } from './IRemovedWithJoinBuilder';
import { JoinBuilder } from './JoinBuilder';
import { FromEveryBuilder } from './FromEveryBuilder';
import { FromBuilder } from './FromBuilder';
import { RemovedWithBuilder } from './RemovedWithBuilder';
import { RemovedWithJoinBuilder } from './RemovedWithJoinBuilder';

type ContractEventType = { Id: string; Generation: number; Tombstone: boolean };

interface FromRecord {
    Key: ContractEventType;
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

interface RemovedWithRecord {
    Key: ContractEventType;
    Value: { Key: string; ParentKey: string };
}

interface JoinRecord {
    Key: ContractEventType;
    Value: { On: string; Properties: Record<string, string>; Key: string };
}

interface RemovedWithJoinRecord {
    Key: ContractEventType;
    Value: { Key: string };
}

/**
 * Concrete implementation of {@link IProjectionBuilderFor} that accumulates projection
 * configuration and produces a Chronicle-compatible projection definition payload.
 * @template TReadModel - The read model type this projection produces.
 */
export class ProjectionBuilderFor<TReadModel> implements IProjectionBuilderFor<TReadModel> {
    private _eventSequenceId: string = EventSequenceId.eventLog.value;
    private _containerName: string | undefined;
    private _rewindable: boolean = true;
    private _active: boolean = true;
    private _autoMap: AutoMap = AutoMap.Enabled;
    private _initialState: string = '{}';
    private readonly _from: FromRecord[] = [];
    private readonly _join: JoinRecord[] = [];
    private readonly _removedWith: RemovedWithRecord[] = [];
    private readonly _removedWithJoin: RemovedWithJoinRecord[] = [];
    private _all: { Properties: Record<string, string>; IncludeChildren: boolean; AutoMap: AutoMap } = {
        Properties: {},
        IncludeChildren: false,
        AutoMap: AutoMap.Inherit
    };

    /** @inheritdoc */
    fromEventSequence(eventSequenceId: string): this {
        this._eventSequenceId = eventSequenceId;
        return this;
    }

    /** @inheritdoc */
    containerName(name: string): this {
        this._containerName = name;
        return this;
    }

    /** @inheritdoc */
    notRewindable(): this {
        this._rewindable = false;
        return this;
    }

    /** @inheritdoc */
    passive(): this {
        this._active = false;
        return this;
    }

    /** @inheritdoc */
    autoMap(): this {
        this._autoMap = AutoMap.Enabled;
        return this;
    }

    /** @inheritdoc */
    noAutoMap(): this {
        this._autoMap = AutoMap.Disabled;
        return this;
    }

    /** @inheritdoc */
    withInitialValues(initialValueProvider: () => TReadModel): this {
        this._initialState = JSON.stringify(initialValueProvider());
        return this;
    }

    /** @inheritdoc */
    from<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IFromBuilder<TReadModel, TEvent>) => void
    ): this {
        const contractType = this.toContractEventType(eventType);
        const fromBuilder = new FromBuilder<TReadModel, TEvent>();
        builderCallback?.(fromBuilder);
        this._from.push({
            Key: contractType,
            Value: {
                Properties: fromBuilder.entry.properties,
                Key: fromBuilder.entry.key,
                ParentKey: fromBuilder.entry.parentKey
            }
        });
        return this;
    }

    /** @inheritdoc */
    join<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IJoinBuilder<TReadModel, TEvent>) => void
    ): this {
        const contractType = this.toContractEventType(eventType);
        const joinBuilder = new JoinBuilder<TReadModel, TEvent>();
        builderCallback?.(joinBuilder);
        this._join.push({
            Key: contractType,
            Value: {
                On: joinBuilder.entry.on,
                Properties: joinBuilder.entry.properties,
                Key: joinBuilder.entry.key
            }
        });
        return this;
    }

    /** @inheritdoc */
    fromEvery(builderCallback: (builder: IFromEveryBuilder<TReadModel>) => void): this {
        const builder = new FromEveryBuilder<TReadModel>();
        builderCallback(builder);
        this._all = {
            Properties: {
                ...this._all.Properties,
                ...builder.entry.properties
            },
            IncludeChildren: builder.entry.includeChildren,
            AutoMap: AutoMap.Inherit
        };
        return this;
    }

    /** @inheritdoc */
    removedWith<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IRemovedWithBuilder<TReadModel, TEvent>) => void
    ): this {
        const contractType = this.toContractEventType(eventType);
        const removedWithBuilder = new RemovedWithBuilder<TReadModel, TEvent>();
        builderCallback?.(removedWithBuilder);
        this._removedWith.push({
            Key: contractType,
            Value: {
                Key: removedWithBuilder.entry.key,
                ParentKey: removedWithBuilder.entry.parentKey
            }
        });
        return this;
    }

    /** @inheritdoc */
    removedWithJoin<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IRemovedWithJoinBuilder<TReadModel, TEvent>) => void
    ): this {
        const contractType = this.toContractEventType(eventType);
        const removedWithJoinBuilder = new RemovedWithJoinBuilder<TReadModel, TEvent>();
        builderCallback?.(removedWithJoinBuilder);
        this._removedWithJoin.push({
            Key: contractType,
            Value: {
                Key: removedWithJoinBuilder.entry.key
            }
        });
        return this;
    }

    /** @inheritdoc */
    children<TChildModel>(
        _targetPropertyAccessor: any,
        _builderCallback: (builder: IChildrenBuilder<TReadModel, TChildModel>) => void
    ): this {
        throw new Error('children is not implemented yet.');
    }

    /** @inheritdoc */
    nested<TNestedModel>(
        _targetPropertyAccessor: any,
        _builderCallback: (builder: INestedBuilder<TReadModel, TNestedModel>) => void
    ): this {
        throw new Error('nested is not implemented yet.');
    }

    /**
     * Builds the contract-compatible projection definition payload.
     * @param identifier - The projection identifier.
     * @param readModelName - The read model container name.
     * @returns The projection definition object ready to send to the kernel.
     */
    build(identifier: string, readModelName: string): Record<string, unknown> {
        const definition: Record<string, unknown> = {
            EventSequenceId: this._eventSequenceId,
            Identifier: identifier,
            ReadModel: this._containerName ?? readModelName,
            IsActive: this._active,
            IsRewindable: this._rewindable,
            InitialModelState: this._initialState,
            From: this._from,
            Join: this._join,
            Children: {},
            FromEvery: [],
            All: this._all,
            FromEventProperty: undefined,
            RemovedWith: this._removedWith,
            RemovedWithJoin: this._removedWithJoin,
            LastUpdated: { Value: '' },
            Tags: [],
            AutoMap: this._autoMap,
            Nested: {}
        };
        definition.LastUpdated = { Value: this.computeStableLastUpdated(definition) };
        return definition;
    }

    /**
     * Gets the set of read model properties referenced by configured mappings.
     * @returns Unique read model property names used by from/join/fromEvery mappings.
     */
    getMappedReadModelProperties(): string[] {
        const mappedProperties = new Set<string>();

        for (const from of this._from) {
            for (const property of Object.keys(from.Value.Properties)) {
                mappedProperties.add(property);
            }
        }

        for (const join of this._join) {
            for (const property of Object.keys(join.Value.Properties)) {
                mappedProperties.add(property);
            }
        }

        for (const property of Object.keys(this._all.Properties)) {
            mappedProperties.add(property);
        }

        return Array.from(mappedProperties.values());
    }

    private toContractEventType(eventTypeConstructor: Function): ContractEventType {
        const eventType = getEventTypeFor(eventTypeConstructor);
        if (eventType.id.value === '') {
            throw new Error(`Event type '${eventTypeConstructor.name}' is not decorated with @eventType().`);
        }
        return {
            Id: eventType.id.value,
            Generation: eventType.generation.value,
            Tombstone: false
        };
    }

    /**
     * Computes a stable, deterministic ISO timestamp from the projection definition content,
     * excluding the LastUpdated field itself. This ensures the server does not interpret
     * a repeated registration of an unchanged definition as a definition change.
     */
    private computeStableLastUpdated(definition: Record<string, unknown>): string {
        const { LastUpdated: _omit, ...rest } = definition;
        const content = JSON.stringify(rest, Object.keys(rest).sort());
        let hash = 5381;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) + hash + content.charCodeAt(i)) >>> 0;
        }
        return new Date(hash * 1000).toISOString();
    }
}

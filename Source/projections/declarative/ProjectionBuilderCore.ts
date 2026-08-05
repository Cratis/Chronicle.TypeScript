// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { getEventTypeFor } from '../../events/eventTypeDecorator';
import { FromBuilder } from './FromBuilder';
import { IFromBuilder } from './IFromBuilder';
import { IFromEveryBuilder } from './IFromEveryBuilder';
import { IJoinBuilder } from './IJoinBuilder';
import { IRemovedWithBuilder } from './IRemovedWithBuilder';
import { IRemovedWithJoinBuilder } from './IRemovedWithJoinBuilder';
import { JoinBuilder } from './JoinBuilder';
import { FromEveryBuilder } from './FromEveryBuilder';
import { RemovedWithBuilder } from './RemovedWithBuilder';
import { RemovedWithJoinBuilder } from './RemovedWithJoinBuilder';
import { ChildAdditionEntry } from './AddChildBuilder';

/** The contract-level event type identifier shape used across projection definitions. */
export type ContractEventType = { Id: string; Generation: number; Tombstone: boolean };

/** Accumulated property mapping for a from clause. */
export interface FromRecord {
    Key: ContractEventType;
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

/** Accumulated property mapping for a join clause. */
export interface JoinRecord {
    Key: ContractEventType;
    Value: { On: string; Properties: Record<string, string>; Key: string };
}

/** Accumulated removal mapping for a removedWith clause. */
export interface RemovedWithRecord {
    Key: ContractEventType;
    Value: { Key: string; ParentKey: string };
}

/** Accumulated removal mapping for a removedWithJoin clause. */
export interface RemovedWithJoinRecord {
    Key: ContractEventType;
    Value: { Key: string };
}

/**
 * Plain object shape matching the wire-level `ChildrenDefinition` used for both children
 * collections and nested single-object projections.
 */
export interface ChildrenDefinitionLike {
    IdentifiedBy: string;
    From: FromRecord[];
    Join: JoinRecord[];
    Children: Record<string, ChildrenDefinitionLike>;
    All: { Properties: Record<string, string>; IncludeChildren: boolean; AutoMap: AutoMap };
    FromEventProperty?: { Event: ContractEventType | undefined; PropertyExpression: string };
    RemovedWith: RemovedWithRecord[];
    RemovedWithJoin: RemovedWithJoinRecord[];
    AutoMap: AutoMap;
    Nested: Record<string, ChildrenDefinitionLike>;
}

/**
 * Base accumulator shared by every projection-shaped builder (the top-level
 * {@link ProjectionBuilderFor}, and the child/nested builders reached through
 * `.children()`/`.nested()`). Holds the from/join/fromEvery/removedWith/removedWithJoin/
 * children/nested state and the mapping operations common to all of them, mirroring the
 * shared `ProjectionBuilder<TReadModel, TBuilder>` base class on the C# client.
 * @template TReadModel - The read model type this builder produces.
 * @template TBuilder - The concrete builder type returned for fluent chaining.
 */
export abstract class ProjectionBuilderCore<TReadModel, TBuilder> {
    protected _autoMap: AutoMap = AutoMap.Inherit;
    protected _initialState: string = '{}';
    protected readonly _from: FromRecord[] = [];
    protected readonly _join: JoinRecord[] = [];
    protected readonly _removedWith: RemovedWithRecord[] = [];
    protected readonly _removedWithJoin: RemovedWithJoinRecord[] = [];
    protected readonly _children: Record<string, ChildrenDefinitionLike> = {};
    protected readonly _nested: Record<string, ChildrenDefinitionLike> = {};
    protected _all: { Properties: Record<string, string>; IncludeChildren: boolean; AutoMap: AutoMap } = {
        Properties: {},
        IncludeChildren: false,
        AutoMap: AutoMap.Inherit
    };

    /** @inheritdoc */
    autoMap(): TBuilder {
        this._autoMap = AutoMap.Enabled;
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    noAutoMap(): TBuilder {
        this._autoMap = AutoMap.Disabled;
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    withInitialValues(initialValueProvider: () => TReadModel): TBuilder {
        this._initialState = JSON.stringify(initialValueProvider());
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    from<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IFromBuilder<TReadModel, TEvent>) => void
    ): TBuilder {
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
        this.mergeChildAdditions(contractType, fromBuilder.entry.children);
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    join<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IJoinBuilder<TReadModel, TEvent>) => void
    ): TBuilder {
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
        this.mergeChildAdditions(contractType, joinBuilder.entry.children);
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    fromEvery(builderCallback: (builder: IFromEveryBuilder<TReadModel>) => void): TBuilder {
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
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    removedWith<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IRemovedWithBuilder<TReadModel, TEvent>) => void
    ): TBuilder {
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
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    removedWithJoin<TEvent>(
        eventType: new (...args: any[]) => TEvent,
        builderCallback?: (builder: IRemovedWithJoinBuilder<TReadModel, TEvent>) => void
    ): TBuilder {
        const contractType = this.toContractEventType(eventType);
        const removedWithJoinBuilder = new RemovedWithJoinBuilder<TReadModel, TEvent>();
        builderCallback?.(removedWithJoinBuilder);
        this._removedWithJoin.push({
            Key: contractType,
            Value: {
                Key: removedWithJoinBuilder.entry.key
            }
        });
        return this as unknown as TBuilder;
    }

    /**
     * Creates an empty {@link ChildrenDefinitionLike} accumulator for a children/nested entry.
     * @returns A fresh, empty children definition.
     */
    protected createEmptyChildrenDefinition(): ChildrenDefinitionLike {
        return {
            IdentifiedBy: '$eventSourceId',
            From: [],
            Join: [],
            Children: {},
            All: { Properties: {}, IncludeChildren: false, AutoMap: AutoMap.Inherit },
            RemovedWith: [],
            RemovedWithJoin: [],
            AutoMap: AutoMap.Inherit,
            Nested: {}
        };
    }

    /**
     * Merges `.addChild()` accumulations captured on a from/join builder into this builder's
     * children definitions, creating the target child entry on first use.
     * @param eventType - The contract event type the child additions were captured for.
     * @param children - The accumulated child additions.
     */
    private mergeChildAdditions(eventType: ContractEventType, children: ChildAdditionEntry[]): void {
        for (const child of children) {
            const childDefinition = this._children[child.targetProperty] ??= this.createEmptyChildrenDefinition();

            if (child.identifiedBy) {
                childDefinition.IdentifiedBy = child.identifiedBy;
            }

            if (child.fromEventProperty) {
                childDefinition.FromEventProperty = { Event: eventType, PropertyExpression: child.fromEventProperty };
            }

            childDefinition.From.push({
                Key: eventType,
                Value: {
                    Key: child.usingKey ?? '$eventSourceId',
                    ParentKey: '$eventSourceId',
                    Properties: {}
                }
            });
        }
    }

    /**
     * Resolves the contract event type for a decorated event constructor.
     * @param eventTypeConstructor - The event class constructor.
     * @returns The contract-level event type identifier.
     */
    protected toContractEventType(eventTypeConstructor: Function): ContractEventType {
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
}

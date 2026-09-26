// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { getEventTypeFor } from '../../events/eventTypeDecorator.js';
import { FromBuilder } from './FromBuilder.js';
import { IFromBuilder } from './IFromBuilder.js';
import { IFromEveryBuilder } from './IFromEveryBuilder.js';
import { IJoinBuilder } from './IJoinBuilder.js';
import { IRemovedWithBuilder } from './IRemovedWithBuilder.js';
import { IRemovedWithJoinBuilder } from './IRemovedWithJoinBuilder.js';
import { JoinBuilder } from './JoinBuilder.js';
import { FromEveryBuilder } from './FromEveryBuilder.js';
import { RemovedWithBuilder } from './RemovedWithBuilder.js';
import { RemovedWithJoinBuilder } from './RemovedWithJoinBuilder.js';
import { ChildAdditionEntry } from './AddChildBuilder.js';
import { eventContractPath } from '../captureProjectionProvenance.js';

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
    private readonly _keyDeclarations = new Map<string, string>();
    private readonly _childDeclarations = new Map<string, string>();
    private _fromEveryDeclared = false;
    protected readonly _join: JoinRecord[] = [];
    private readonly _joinEventNames = new Map<JoinRecord, string>();
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
        if (fromBuilder.entry.keyDeclaration) this._keyDeclarations.set(`${eventContractPath('From', contractType)}.Key`, fromBuilder.entry.keyDeclaration);
        if (fromBuilder.entry.parentKeyDeclaration) this._keyDeclarations.set(`${eventContractPath('From', contractType)}.ParentKey`, fromBuilder.entry.parentKeyDeclaration);
        for (const child of fromBuilder.entry.children) this._childDeclarations.set(`Children.${child.targetProperty}`, '.from().addChild');
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
        const record: JoinRecord = {
            Key: contractType,
            Value: {
                On: joinBuilder.entry.on,
                Properties: joinBuilder.entry.properties,
                Key: joinBuilder.entry.key
            }
        };
        this._join.push(record);
        this._joinEventNames.set(record, eventType.name);
        this.mergeChildAdditions(contractType, joinBuilder.entry.children);
        return this as unknown as TBuilder;
    }

    /** @inheritdoc */
    fromEvery(builderCallback: (builder: IFromEveryBuilder<TReadModel>) => void): TBuilder {
        this._fromEveryDeclared = true;
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

    /** Whether a subscribe-to-all declaration was made even if it emitted no properties. */
    get hasFromEveryDeclaration(): boolean {
        return this._fromEveryDeclared;
    }

    /** Origins of children introduced by a From handler rather than a children declaration. */
    getChildDeclarations(): ReadonlyMap<string, string> {
        return this._childDeclarations;
    }

    /** Declaration origins for key expressions not recoverable from the wire contract. */
    getKeyDeclarations(): ReadonlyMap<string, string> {
        return this._keyDeclarations;
    }

    /** Resolves join defaults once the entire projection (including identifiedBy) is configured. */
    protected resolveJoins(): void {
        for (const record of this._join) {
            record.Value.On ||= this.defaultJoinOn() ?? '';
            if (!record.Value.On) {
                throw new Error(`A join with event '${this._joinEventNames.get(record)}' requires an on property.`);
            }
        }
    }

    /** Returns a default join-on path for children, if one is available. */
    protected defaultJoinOn(): string | undefined {
        return undefined;
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

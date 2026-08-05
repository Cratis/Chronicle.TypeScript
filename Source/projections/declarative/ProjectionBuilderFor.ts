// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { EventSequenceId } from '../../eventSequences/EventSequenceId';
import { ChildrenBuilder } from './ChildrenBuilder';
import { IChildrenBuilder } from './IChildrenBuilder';
import { INestedBuilder } from './INestedBuilder';
import { IProjectionBuilderFor } from './IProjectionBuilderFor';
import { NestedBuilder } from './NestedBuilder';
import { ProjectionBuilderCore } from './ProjectionBuilderCore';

/**
 * Concrete implementation of {@link IProjectionBuilderFor} that accumulates projection
 * configuration and produces a Chronicle-compatible projection definition payload.
 * @template TReadModel - The read model type this projection produces.
 */
export class ProjectionBuilderFor<TReadModel> extends ProjectionBuilderCore<TReadModel, ProjectionBuilderFor<TReadModel>> implements IProjectionBuilderFor<TReadModel> {
    private _eventSequenceId: string = EventSequenceId.eventLog.value;
    private _containerName: string | undefined;
    private _rewindable: boolean = true;
    private _active: boolean = true;

    constructor() {
        super();
        this._autoMap = AutoMap.Enabled;
    }

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
    children<TChildModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        builderCallback: (builder: IChildrenBuilder<TReadModel, TChildModel>) => void
    ): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        targetPropertyAccessor(proxy as TReadModel);

        const builder = new ChildrenBuilder<TReadModel, TChildModel>();
        builderCallback(builder);
        this._children[handler.property] = builder.buildDefinition();
        return this;
    }

    /** @inheritdoc */
    nested<TNestedModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        builderCallback: (builder: INestedBuilder<TReadModel, TNestedModel>) => void
    ): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        targetPropertyAccessor(proxy as TReadModel);

        const builder = new NestedBuilder<TReadModel, TNestedModel>();
        builderCallback(builder);
        this._nested[handler.property] = builder.buildDefinition();
        return this;
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
            Children: this._children,
            FromEvery: [],
            All: this._all,
            FromEventProperty: undefined,
            RemovedWith: this._removedWith,
            RemovedWithJoin: this._removedWithJoin,
            LastUpdated: { Value: '' },
            Tags: [],
            AutoMap: this._autoMap,
            Nested: this._nested
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

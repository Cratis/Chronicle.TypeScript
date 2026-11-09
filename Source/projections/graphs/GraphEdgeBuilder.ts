// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor, PropertyAccessor } from '@cratis/fundamentals';
import { TypeIntrospector } from '../../types/index.js';
import { EdgeCanHaveOnlyOneIdentifyingKey } from './EdgeCanHaveOnlyOneIdentifyingKey.js';
import { EdgeMustHaveOneSourceAndOneTarget } from './EdgeMustHaveOneSourceAndOneTarget.js';
import { getEdgeMetadata } from './edge.js';
import { getEdgeSourceMetadata } from './edgeSource.js';
import { getEdgeTargetMetadata } from './edgeTarget.js';
import { GraphEdgeFromBuilder } from './GraphEdgeFromBuilder.js';
import type { GraphEdgeFromModel } from './GraphEdgeFromModel.js';
import type { GraphEdgeModel } from './GraphEdgeModel.js';
import { GraphEdgeRemovedWithBuilder } from './GraphEdgeRemovedWithBuilder.js';
import type { GraphEdgeRemovedWithModel } from './GraphEdgeRemovedWithModel.js';
import { isGraphKey } from './graphKey.js';
import type { IGraphEdgeBuilder } from './IGraphEdgeBuilder.js';
import type { IGraphEdgeFromBuilder } from './IGraphEdgeFromBuilder.js';
import type { IGraphEdgeRemovedWithBuilder } from './IGraphEdgeRemovedWithBuilder.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements {@link IGraphEdgeBuilder}.
 * @template TEdge - The type of edge.
 */
export class GraphEdgeBuilder<TEdge> implements IGraphEdgeBuilder<TEdge> {
    private readonly _from: GraphEdgeFromModel[] = [];
    private readonly _removedWith: GraphEdgeRemovedWithModel[] = [];
    private _type?: string;
    private _identifyingProperty?: string;

    /**
     * Creates a new {@link GraphEdgeBuilder}.
     * @param _edge - The type of the edge.
     * @param _source - The type of the node the edge starts at.
     * @param _target - The type of the node the edge ends at.
     */
    constructor(
        private readonly _edge: Constructor<TEdge>,
        private readonly _source: Function,
        private readonly _target: Function
    ) {}

    /** @inheritdoc */
    named(type: string): IGraphEdgeBuilder<TEdge> {
        this._type = type;
        return this;
    }

    /** @inheritdoc */
    identifiedBy(identityAccessor: PropertyAccessor<TEdge>): IGraphEdgeBuilder<TEdge> {
        this._identifyingProperty = propertyPathOf(identityAccessor);
        return this;
    }

    /** @inheritdoc */
    from<TEvent>(eventType: Constructor<TEvent>, configure: (builder: IGraphEdgeFromBuilder<TEdge, TEvent>) => void): IGraphEdgeBuilder<TEdge> {
        const builder = new GraphEdgeFromBuilder<TEdge, TEvent>();
        configure(builder);
        this._from.push({
            eventType,
            sourceKey: builder.sourceKey,
            targetKey: builder.targetKey,
            identity: builder.identity,
            properties: builder.properties
        });
        return this;
    }

    /** @inheritdoc */
    removedWith<TEvent>(eventType: Constructor<TEvent>, configure: (builder: IGraphEdgeRemovedWithBuilder<TEvent>) => void): IGraphEdgeBuilder<TEdge> {
        const builder = new GraphEdgeRemovedWithBuilder<TEvent>();
        configure(builder);
        this._removedWith.push({ eventType, sourceKey: builder.sourceKey, targetKey: builder.targetKey, identity: builder.identity });
        return this;
    }

    /**
     * Builds the {@link GraphEdgeModel}.
     * @returns The model.
     * @throws {EdgeMustHaveOneSourceAndOneTarget} When the end nodes are not types.
     * @throws {EdgeCanHaveOnlyOneIdentifyingKey} When the type has more than one member with the graphKey decorator.
     */
    build(): GraphEdgeModel {
        if (typeof this._source !== 'function' || typeof this._target !== 'function') {
            throw new EdgeMustHaveOneSourceAndOneTarget(this._edge);
        }

        const members = TypeIntrospector.getTrackedProperties(this._edge);
        const keys = members.filter(member => isGraphKey(this._edge.prototype, member));
        if (keys.length > 1) throw new EdgeCanHaveOnlyOneIdentifyingKey(this._edge);

        return {
            type: this._edge,
            edgeType: this._type ?? getEdgeMetadata(this._edge)?.type ?? this._edge.name,
            sourceNode: this._source,
            targetNode: this._target,
            identifyingProperty: this._identifyingProperty ?? keys[0],
            // The members that hold the keys of the end nodes are not properties of the edge.
            excludedProperties: members.filter(member =>
                getEdgeSourceMetadata(this._edge.prototype, member) !== undefined ||
                getEdgeTargetMetadata(this._edge.prototype, member) !== undefined),
            from: this._from,
            removedWith: this._removedWith
        };
    }
}

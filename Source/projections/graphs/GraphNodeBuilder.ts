// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor, PropertyAccessor } from '@cratis/fundamentals';
import { TypeIntrospector } from '../../types/index.js';
import { getNodeMetadata } from './node.js';
import { GraphNodeFromBuilder } from './GraphNodeFromBuilder.js';
import { GraphNodeRemovedWithBuilder } from './GraphNodeRemovedWithBuilder.js';
import type { GraphNodeFromModel } from './GraphNodeFromModel.js';
import type { GraphNodeModel } from './GraphNodeModel.js';
import type { GraphNodeRemovedWithModel } from './GraphNodeRemovedWithModel.js';
import { isGraphKey } from './graphKey.js';
import type { IGraphNodeBuilder } from './IGraphNodeBuilder.js';
import type { IGraphNodeFromBuilder } from './IGraphNodeFromBuilder.js';
import type { IGraphNodeRemovedWithBuilder } from './IGraphNodeRemovedWithBuilder.js';
import { NodeMustHaveExactlyOneKey } from './NodeMustHaveExactlyOneKey.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements {@link IGraphNodeBuilder}.
 * @template TNode - The type of node.
 */
export class GraphNodeBuilder<TNode> implements IGraphNodeBuilder<TNode> {
    private readonly _from: GraphNodeFromModel[] = [];
    private readonly _removedWith: GraphNodeRemovedWithModel[] = [];
    private _keyProperty?: string;

    /**
     * Creates a new {@link GraphNodeBuilder}.
     * @param _type - The type of the node.
     */
    constructor(private readonly _type: Constructor<TNode>) {}

    /** @inheritdoc */
    identifiedBy(keyAccessor: PropertyAccessor<TNode>): IGraphNodeBuilder<TNode> {
        this._keyProperty = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    from<TEvent>(eventType: Constructor<TEvent>, configure?: (builder: IGraphNodeFromBuilder<TNode, TEvent>) => void): IGraphNodeBuilder<TNode> {
        const builder = new GraphNodeFromBuilder<TNode, TEvent>();
        configure?.(builder);
        this._from.push({ eventType, key: builder.key, properties: builder.properties, updateOnly: builder.updateOnly });
        return this;
    }

    /** @inheritdoc */
    removedWith<TEvent>(eventType: Constructor<TEvent>, configure?: (builder: IGraphNodeRemovedWithBuilder<TEvent>) => void): IGraphNodeBuilder<TNode> {
        const builder = new GraphNodeRemovedWithBuilder<TEvent>();
        configure?.(builder);
        this._removedWith.push({ eventType, key: builder.key, detach: builder.detachEdges });
        return this;
    }

    /**
     * Builds the {@link GraphNodeModel}.
     * @returns The model.
     * @throws {NodeMustHaveExactlyOneKey} When no key is declared and the type does not have exactly one member with the graphKey decorator.
     */
    build(): GraphNodeModel {
        return {
            type: this._type,
            label: getNodeMetadata(this._type)?.label ?? this._type.name,
            keyProperty: this._keyProperty ?? GraphNodeBuilder.keyOf(this._type),
            from: this._from,
            removedWith: this._removedWith
        };
    }

    private static keyOf(type: Function): string {
        const keys = TypeIntrospector.getTrackedProperties(type).filter(member => isGraphKey(type.prototype, member));
        if (keys.length !== 1) throw new NodeMustHaveExactlyOneKey(type, keys.length);
        return keys[0];
    }
}

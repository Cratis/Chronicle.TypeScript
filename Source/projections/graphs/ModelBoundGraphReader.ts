// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { TypeIntrospector } from '../../types/index.js';
import { constantValueExpression } from '../constantValueExpression.js';
import { EdgeCanHaveOnlyOneIdentifyingKey } from './EdgeCanHaveOnlyOneIdentifyingKey.js';
import { EdgeMustHaveOneSourceAndOneTarget } from './EdgeMustHaveOneSourceAndOneTarget.js';
import { getEdgeMetadata } from './edge.js';
import { getEdgeFromMetadata } from './edgeFrom.js';
import { getEdgeRemovedWithMetadata } from './edgeRemovedWith.js';
import { getEdgeSourceMetadata } from './edgeSource.js';
import { getEdgeTargetMetadata } from './edgeTarget.js';
import { getGraphName } from './graph.js';
import { isGraphKey } from './graphKey.js';
import { GraphNameRequired } from './GraphNameRequired.js';
import type { GraphEdgeModel } from './GraphEdgeModel.js';
import type { GraphNodeFromModel } from './GraphNodeFromModel.js';
import type { GraphNodeModel } from './GraphNodeModel.js';
import { readGraphMemberMappings } from './GraphMemberMappings.js';
import { getNodeMetadata } from './node.js';
import { getNodeFromMetadata } from './nodeFrom.js';
import { getNodeRemovedWithMetadata } from './nodeRemovedWith.js';
import { NodeMustHaveExactlyOneKey } from './NodeMustHaveExactlyOneKey.js';

/**
 * Reads nodes and edges from the decorators on their types.
 */
export class ModelBoundGraphReader {
    /**
     * Gets the name of the graph a node or an edge belongs to.
     * @param type - The node or edge type.
     * @returns The name of the graph.
     * @throws {GraphNameRequired} When the type does not name its graph.
     */
    static graphNameOf(type: Function): string {
        const name = getGraphName(type);
        if (name === undefined || name === '') throw new GraphNameRequired(type);
        return name;
    }

    /**
     * Read a node.
     * @param type - The node type.
     * @returns The {@link GraphNodeModel}.
     * @throws {NodeMustHaveExactlyOneKey} When the type does not have exactly one member with the graphKey decorator.
     */
    readNode(type: Function): GraphNodeModel {
        const members = TypeIntrospector.getTrackedProperties(type);
        const keys = members.filter(member => isGraphKey(type.prototype, member));
        if (keys.length !== 1) throw new NodeMustHaveExactlyOneKey(type, keys.length);

        const byEvent = readGraphMemberMappings(type.prototype, members);
        const from: GraphNodeFromModel[] = getNodeFromMetadata(type).map(attribute => ({
            eventType: attribute.eventType,
            key: attribute.constantKey !== undefined ? constantValueExpression(attribute.constantKey) : attribute.key,
            properties: byEvent.get(attribute.eventType) ?? {},
            updateOnly: attribute.updateOnly === true
        }));

        // An event that only a property refers to still projects the node, keyed by the event source id.
        for (const [eventType, properties] of byEvent) {
            if (from.every(declared => declared.eventType !== eventType)) {
                from.push({ eventType, properties, updateOnly: false });
            }
        }

        return {
            type,
            label: getNodeMetadata(type)?.label ?? type.name,
            keyProperty: keys[0],
            from,
            removedWith: getNodeRemovedWithMetadata(type).map(attribute => ({
                eventType: attribute.eventType,
                key: attribute.key,
                detach: attribute.detach === true
            }))
        };
    }

    /**
     * Read an edge.
     * @param type - The edge type.
     * @returns The {@link GraphEdgeModel}.
     * @throws {EdgeMustHaveOneSourceAndOneTarget} When the type does not name exactly one source and one target.
     * @throws {EdgeCanHaveOnlyOneIdentifyingKey} When the type has more than one member with the graphKey decorator.
     */
    readEdge(type: Function): GraphEdgeModel {
        const members = TypeIntrospector.getTrackedProperties(type);
        const sources = members.filter(member => getEdgeSourceMetadata(type.prototype, member) !== undefined);
        const targets = members.filter(member => getEdgeTargetMetadata(type.prototype, member) !== undefined);
        if (sources.length !== 1 || targets.length !== 1) throw new EdgeMustHaveOneSourceAndOneTarget(type);

        const keys = members.filter(member => isGraphKey(type.prototype, member));
        if (keys.length > 1) throw new EdgeCanHaveOnlyOneIdentifyingKey(type);

        const byEvent = readGraphMemberMappings(type.prototype, members.filter(member => member !== sources[0] && member !== targets[0]));
        return {
            type,
            edgeType: getEdgeMetadata(type)?.type ?? type.name,
            sourceNode: getEdgeSourceMetadata(type.prototype, sources[0])!.nodeType,
            targetNode: getEdgeTargetMetadata(type.prototype, targets[0])!.nodeType,
            identifyingProperty: keys.length === 1 ? keys[0] : undefined,
            excludedProperties: [sources[0], targets[0]],
            from: getEdgeFromMetadata(type).map(attribute => ({
                eventType: attribute.eventType,
                sourceKey: attribute.sourceKey,
                targetKey: attribute.targetKey,
                identity: attribute.identity,
                properties: byEvent.get(attribute.eventType) ?? {}
            })),
            removedWith: getEdgeRemovedWithMetadata(type).map(attribute => ({
                eventType: attribute.eventType,
                sourceKey: attribute.sourceKey,
                targetKey: attribute.targetKey,
                identity: attribute.identity
            }))
        };
    }
}

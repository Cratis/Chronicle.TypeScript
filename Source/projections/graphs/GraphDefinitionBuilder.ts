// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, EventGenerationDelivery, ReadModelObserverType } from '@cratis/chronicle.contracts';
import type {
    GraphEdgeProjectionDefinition,
    GraphNodeProjectionDefinition,
    ProjectionDefinition
} from '@cratis/chronicle.contracts';
import { EventSequenceId } from '../../eventSequences/EventSequenceId.js';
import { getEventTypeJsonSchemaFor } from '../../events/eventTypeDecorator.js';
import { buildReadModelDefinition } from '../../readModels/buildReadModelDefinition.js';
import type { JsonSchema } from '../../schemas/index.js';
import { TypeIntrospector } from '../../types/index.js';
import { toContractEventType } from '../modelBound/childrenAndNestedBuilder.js';
import type { GraphEdgeModel } from './GraphEdgeModel.js';
import { GraphHasDuplicateElement } from './GraphHasDuplicateElement.js';
import type { GraphModel } from './GraphModel.js';
import type { GraphNodeModel } from './GraphNodeModel.js';
import type { GraphRegistration } from './GraphRegistration.js';
import { GraphSchemaWriter } from './GraphSchemaWriter.js';
import { UnknownGraphEventProperty } from './UnknownGraphEventProperty.js';

const eventSourceId = '$eventSourceId';

/**
 * Turns a {@link GraphModel} into the definitions that are registered with the kernel. The shape follows the
 * .NET client's GraphDefinitionBuilder, so the same graph declared with either client registers the same definition.
 */
export class GraphDefinitionBuilder {
    private readonly _schemaWriter = new GraphSchemaWriter();

    /**
     * Builds the registration of a graph.
     * @param model - The {@link GraphModel}.
     * @param projectionId - The identifier of the projection that fills the graph.
     * @param sinkTypeId - The identifier of the sink type that stores the graph.
     * @returns The {@link GraphRegistration}.
     */
    build(model: GraphModel, projectionId: string, sinkTypeId: string): GraphRegistration {
        const nodes: Record<string, GraphNodeProjectionDefinition> = {};
        for (const node of model.nodes) {
            if (Object.hasOwn(nodes, node.label)) throw new GraphHasDuplicateElement(model.name, 'node', node.label);
            nodes[node.label] = this.node(node);
        }

        const edges: Record<string, GraphEdgeProjectionDefinition> = {};
        for (const edge of model.edges) {
            if (Object.hasOwn(edges, edge.edgeType)) throw new GraphHasDuplicateElement(model.name, 'edge', edge.edgeType);
            edges[edge.edgeType] = this.edge(edge);
        }

        const projection: ProjectionDefinition = {
            EventSequenceId: EventSequenceId.eventLog.value,
            Identifier: projectionId,
            ReadModel: model.name,
            IsActive: true,
            IsRewindable: true,
            InitialModelState: '{}',
            From: [],
            Join: [],
            Children: {},
            FromEvery: [],
            All: { Properties: {}, IncludeChildren: false, AutoMap: AutoMap.Inherit, Key: '' },
            FromEventProperty: undefined,
            RemovedWith: [],
            RemovedWithJoin: [],
            LastUpdated: undefined,
            Tags: [],
            AutoMap: AutoMap.Inherit,
            Nested: {},
            SubscribesToAllEvents: false,
            NoAutoMapProperties: [],
            GenerationDelivery: EventGenerationDelivery.Compatibility,
            Graph: { Nodes: nodes, Edges: edges }
        };

        return {
            graphName: model.name,
            readModel: buildReadModelDefinition({
                identifier: model.name,
                schema: this._schemaWriter.write(model),
                sinkTypeId,
                observerType: ReadModelObserverType.Projection,
                observerIdentifier: projectionId
            }),
            projection
        };
    }

    private node(node: GraphNodeModel): GraphNodeProjectionDefinition {
        const properties = Object.keys(this._schemaWriter.propertiesOf(node.type, []));
        const result: GraphNodeProjectionDefinition = { From: {}, RemovedWith: {} };
        for (const from of node.from) {
            result.From[this.eventTypeOf(from.eventType)] = {
                Key: from.key ?? eventSourceId,
                Properties: this.properties(from.eventType, properties.filter(name => name !== node.keyProperty), from.properties),
                UpdateOnly: from.updateOnly,
                ForEach: ''
            };
        }

        for (const removal of node.removedWith) {
            result.RemovedWith[this.eventTypeOf(removal.eventType)] = { Key: removal.key ?? eventSourceId, Detach: removal.detach, ForEach: '' };
        }

        return result;
    }

    private edge(edge: GraphEdgeModel): GraphEdgeProjectionDefinition {
        const properties = Object.keys(this._schemaWriter.propertiesOf(edge.type, edge.excludedProperties));
        const result: GraphEdgeProjectionDefinition = { From: {}, RemovedWith: {} };
        for (const from of edge.from) {
            result.From[this.eventTypeOf(from.eventType)] = {
                SourceKey: from.sourceKey ?? eventSourceId,
                TargetKey: from.targetKey ?? eventSourceId,
                Identity: this.identity(edge, from.eventType, from.identity),
                Properties: this.properties(from.eventType, properties.filter(name => name !== edge.identifyingProperty), from.properties),
                ForEach: ''
            };
        }

        for (const removal of edge.removedWith) {
            result.RemovedWith[this.eventTypeOf(removal.eventType)] = {
                SourceKey: removal.sourceKey ?? eventSourceId,
                TargetKey: removal.targetKey ?? eventSourceId,
                Identity: this.identity(edge, removal.eventType, removal.identity),
                ForEach: ''
            };
        }

        return result;
    }

    // The kernel keys the event mappings of a graph by the string form of the event type: id+generation.
    private eventTypeOf(eventType: Function): string {
        const contract = toContractEventType(eventType);
        return `${contract.Id}+${contract.Generation}`;
    }

    private identity(edge: GraphEdgeModel, eventType: Function, identity: string | undefined): string {
        if (edge.identifyingProperty === undefined) return '';
        const resolved = identity ?? this.eventPropertyNamed(eventType, edge.identifyingProperty);
        if (resolved === undefined) throw new UnknownGraphEventProperty(edge.type, eventType, edge.identifyingProperty);
        return resolved;
    }

    private properties(eventType: Function, candidates: readonly string[], explicit: Readonly<Record<string, string>>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const name of candidates) {
            const expression = explicit[name] ?? this.eventPropertyNamed(eventType, name);
            if (expression !== undefined) result[name] = expression;
        }

        for (const [name, expression] of Object.entries(explicit)) {
            if (!Object.hasOwn(result, name)) result[name] = expression;
        }

        return result;
    }

    // A graph property is mapped from the event property of the same name, unless that one is an object.
    private eventPropertyNamed(eventType: Function, graphPropertyName: string): string | undefined {
        const schema = getEventTypeJsonSchemaFor(eventType).properties ?? {};
        if (!TypeIntrospector.getMembers(eventType).has(graphPropertyName) && !Object.hasOwn(schema, graphPropertyName)) return undefined;
        const property: JsonSchema | undefined = schema[graphPropertyName];
        return property !== undefined && (property.type === 'object' || property.items?.type === 'object') ? undefined : graphPropertyName;
    }
}

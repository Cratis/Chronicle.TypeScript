// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { JsonSchema, JsonSchemaGenerator } from '../../schemas/index.js';
import { GraphKeyPropertyNotFound } from './GraphKeyPropertyNotFound.js';
import type { GraphModel } from './GraphModel.js';
import { NestedObjectInGraph } from './NestedObjectInGraph.js';
import { UnknownGraphNode } from './UnknownGraphNode.js';

/**
 * Writes the schema form of a graph: an object schema whose properties are the node labels and edge types.
 * This is the form the kernel reads a graph from. The annotations are the ones of the kernel's graph definition.
 */
export class GraphSchemaWriter {
    /**
     * Writes the schema of a graph.
     * @param model - The {@link GraphModel}.
     * @returns The schema as JSON.
     * @throws {NestedObjectInGraph} When a node or an edge has an object property.
     * @throws {UnknownGraphNode} When an edge connects a type that is not a node of the graph.
     */
    write(model: GraphModel): string {
        const properties: Record<string, unknown> = {};
        for (const node of model.nodes) {
            this.assertProperty(node.type, node.keyProperty, this.propertiesOf(node.type, []));
            properties[node.label] = {
                ...this.element(node.type, []),
                'x-graph-kind': 'Node',
                'x-graph-key': node.keyProperty
            };
        }

        for (const edge of model.edges) {
            const identity = edge.identifyingProperty;
            if (identity !== undefined) this.assertProperty(edge.type, identity, this.propertiesOf(edge.type, edge.excludedProperties));
            properties[edge.edgeType] = {
                ...this.element(edge.type, edge.excludedProperties),
                'x-graph-kind': 'Edge',
                'x-graph-source': this.labelOf(model, edge.edgeType, edge.sourceNode),
                'x-graph-target': this.labelOf(model, edge.edgeType, edge.targetNode),
                ...(identity === undefined ? {} : { 'x-graph-identity': identity })
            };
        }

        return JSON.stringify({ type: 'object', title: model.name, 'x-graph': true, properties });
    }

    /**
     * Gets the properties of a node or edge type, as they are named in the graph.
     * @param type - The node or edge type.
     * @param excluded - Names of members that are not properties.
     * @returns The property names with their schemas.
     * @throws {NestedObjectInGraph} When a property is an object.
     */
    propertiesOf(type: Function, excluded: readonly string[]): Record<string, JsonSchema> {
        const skip = new Set(excluded.map(name => name.toLowerCase()));
        const result: Record<string, JsonSchema> = {};
        for (const [name, property] of Object.entries(JsonSchemaGenerator.generate(type).properties ?? {})) {
            if (skip.has(name.toLowerCase())) continue;
            if (property.type === 'object' || property.items?.type === 'object') throw new NestedObjectInGraph(type, name);
            result[name] = property;
        }

        return result;
    }

    private element(type: Function, excluded: readonly string[]): Record<string, unknown> {
        return { type: 'object', properties: this.propertiesOf(type, excluded) };
    }

    private assertProperty(type: Function, property: string, properties: Record<string, JsonSchema>): void {
        if (!Object.hasOwn(properties, property)) throw new GraphKeyPropertyNotFound(type, property);
    }

    private labelOf(model: GraphModel, edgeType: string, nodeType: Function): string {
        const node = model.nodes.find(candidate => candidate.type === nodeType);
        if (!node) throw new UnknownGraphNode(edgeType, nodeType);
        return node.label;
    }
}

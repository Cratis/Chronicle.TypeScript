// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { TypeIntrospector } from '../../../types/index.js';
import { getEdgeMetadata } from '../edge.js';
import type { GraphEdgeModel } from '../GraphEdgeModel.js';
import type { GraphModel } from '../GraphModel.js';
import { GraphSchemaWriter } from '../GraphSchemaWriter.js';
import { isGraphElement } from '../isGraphElement.js';
import { AmbiguousDirection } from './AmbiguousDirection.js';
import { DuplicateViewName } from './DuplicateViewName.js';
import { EdgeNotIncidentOnRoot } from './EdgeNotIncidentOnRoot.js';
import { EdgePropertyViewNotUsedAsTarget } from './EdgePropertyViewNotUsedAsTarget.js';
import { EdgePropertyViewSharedAcrossEdges } from './EdgePropertyViewSharedAcrossEdges.js';
import { GraphEdgeDirection } from './GraphEdgeDirection.js';
import { GraphViewCardinality } from './GraphViewCardinality.js';
import type { GraphViewBuildResult } from './GraphViewBuildResult.js';
import type { GraphViewDefinition } from './GraphViewDefinition.js';
import type { GraphViewEdgeReference } from './GraphViewEdgeReference.js';
import type { GraphViewMember } from './GraphViewMember.js';
import { getGraphViewMemberMetadata } from './declareGraphViewMember.js';
import { GraphViewMemberKind } from './GraphViewMemberKind.js';
import { RecursiveView } from './RecursiveView.js';
import { RelationTargetNotAView } from './RelationTargetNotAView.js';
import { TargetLabelMismatch } from './TargetLabelMismatch.js';
import { UnknownEdge } from './UnknownEdge.js';
import { UnknownEdgeProperty } from './UnknownEdgeProperty.js';
import { UnknownNodeProperty } from './UnknownNodeProperty.js';
import { ViewIsAlsoSchema } from './ViewIsAlsoSchema.js';
import { getViewOfMetadata } from './viewOf.js';
import { ViewRootNotANode } from './ViewRootNotANode.js';

interface NodeInfo {
    readonly label: string;
    readonly keyProperty: string;
    readonly properties: readonly string[];
}

interface EdgeInfo {
    readonly edgeType: string;
    readonly identifiedBy?: string;
    readonly sourceLabel: string;
    readonly targetLabel: string;
    readonly properties: readonly string[];
}

interface PropertyMemberInfo {
    readonly kind: GraphViewMemberKind.Property;
    readonly name: string;
    readonly source: string;
}

interface EdgePropertyMemberInfo {
    readonly kind: GraphViewMemberKind.EdgeProperty;
    readonly name: string;
    readonly requested: string;
    source?: string;
}

interface RelationMemberInfo {
    readonly kind: GraphViewMemberKind.Relation;
    readonly name: string;
    readonly edge: EdgeInfo;
    readonly direction: GraphEdgeDirection;
    readonly cardinality: GraphViewCardinality;
    readonly target: Function;
    readonly targetName: string;
}

type MemberInfo = PropertyMemberInfo | EdgePropertyMemberInfo | RelationMemberInfo;

interface ViewInfo {
    readonly type: Constructor;
    readonly name: string;
    readonly node: NodeInfo;
    readonly members: readonly MemberInfo[];
}

/**
 * Validates the views declared over a graph and builds their {@link GraphViewDefinition}. Every rule of a view has a
 * reason code, carried by the error that reports it. One invalid view never stops the discovery of anything else; it
 * is reported, and the views of its graph are then withheld as a whole, because a view is read together with the views
 * it nests.
 */
export class GraphViewDefinitionBuilder {
    private readonly _schemaWriter = new GraphSchemaWriter();

    /**
     * Builds the definition of the views of one graph.
     * @param model - The {@link GraphModel} the views read.
     * @param views - The view types that name the graph.
     * @returns The {@link GraphViewBuildResult}.
     */
    build(model: GraphModel, views: readonly Constructor[]): GraphViewBuildResult {
        const failures = new Map<Constructor, Error>();
        const nodes = new Map<Function, NodeInfo>(model.nodes.map(node => [node.type, {
            label: node.label,
            keyProperty: node.keyProperty,
            properties: Object.keys(this._schemaWriter.propertiesOf(node.type, []))
        }]));
        const edgesByClass = new Map<Function, EdgeInfo>();
        const edgesByType = new Map<string, EdgeInfo>();
        for (const edge of model.edges) {
            const info = this.edgeInfo(edge, nodes);
            edgesByClass.set(edge.type, info);
            edgesByType.set(edge.edgeType, info);
        }

        const declared = new Set<Function>(views);
        const names = new Set<string>();
        const resolved = new Map<Constructor, ViewInfo>();
        for (const type of views) {
            try {
                resolved.set(type, this.resolve(model.name, type, declared, names, nodes, edgesByClass, edgesByType));
            } catch (error) {
                failures.set(type, error instanceof Error ? error : new Error(String(error)));
            }
        }

        this.validateAcrossViews(resolved, edgesByType, failures);
        if (failures.size > 0) return { failures };

        const definition: GraphViewDefinition = {
            graph: model.name,
            schema: {
                nodes: [...nodes.values()].map(node => ({ label: node.label, key: node.keyProperty, properties: node.properties })),
                edges: [...edgesByType.values()].map(edge => ({
                    type: edge.edgeType,
                    source: edge.sourceLabel,
                    target: edge.targetLabel,
                    ...(edge.identifiedBy === undefined ? {} : { identifiedBy: edge.identifiedBy }),
                    properties: edge.properties
                }))
            },
            views: [...resolved.values()]
                .map(view => ({ name: view.name, root: view.node.label, members: view.members.map(member => this.member(member)) }))
                .sort((left, right) => (left.name === right.name ? 0 : left.name < right.name ? -1 : 1))
        };
        return { definition, failures };
    }

    private edgeInfo(edge: GraphEdgeModel, nodes: ReadonlyMap<Function, NodeInfo>): EdgeInfo {
        return {
            edgeType: edge.edgeType,
            identifiedBy: edge.identifyingProperty,
            sourceLabel: nodes.get(edge.sourceNode)?.label ?? '',
            targetLabel: nodes.get(edge.targetNode)?.label ?? '',
            properties: Object.keys(this._schemaWriter.propertiesOf(edge.type, edge.excludedProperties))
        };
    }

    private resolve(
        graph: string,
        type: Constructor,
        declared: ReadonlySet<Function>,
        names: Set<string>,
        nodes: ReadonlyMap<Function, NodeInfo>,
        edgesByClass: ReadonlyMap<Function, EdgeInfo>,
        edgesByType: ReadonlyMap<string, EdgeInfo>
    ): ViewInfo {
        const metadata = getViewOfMetadata(type)!;
        const name = metadata.name;
        const duplicate = names.has(name);
        names.add(name);
        if (isGraphElement(type)) throw new ViewIsAlsoSchema(type);
        if (duplicate) throw new DuplicateViewName(type, graph, name);

        const rootType = metadata.root();
        const node = nodes.get(rootType);
        if (node === undefined) throw new ViewRootNotANode(type, graph, rootType);

        const members: MemberInfo[] = [];
        for (const property of TypeIntrospector.getTrackedProperties(type)) {
            const member = getGraphViewMemberMetadata(type.prototype, property);
            if (member === undefined) continue;

            const requested = member.source ?? property;
            switch (member.kind) {
                case GraphViewMemberKind.Property: {
                    const source = member.isKey ? node.keyProperty : this.find(node.properties, requested);
                    if (source === undefined) throw new UnknownNodeProperty(type, property, node.label, requested);
                    members.push({ kind: GraphViewMemberKind.Property, name: property, source });
                    break;
                }
                case GraphViewMemberKind.EdgeProperty:
                    members.push({ kind: GraphViewMemberKind.EdgeProperty, name: property, requested });
                    break;
                case GraphViewMemberKind.Relation: {
                    const edge = this.edgeOf(member.edge!, edgesByClass, edgesByType);
                    if (edge === undefined) throw new UnknownEdge(type, property, this.edgeName(member.edge!));
                    const direction = this.directionOf(type, property, edge, node, member.direction);
                    const target = member.view!();
                    if (!declared.has(target)) throw new RelationTargetNotAView(type, property, target);
                    const expected = direction === GraphEdgeDirection.Outgoing ? edge.targetLabel : edge.sourceLabel;
                    const actual = nodes.get(getViewOfMetadata(target)!.root())?.label;
                    if (actual !== undefined && actual !== expected) throw new TargetLabelMismatch(type, property, target, expected, actual);
                    members.push({
                        kind: GraphViewMemberKind.Relation,
                        name: property,
                        edge,
                        direction,
                        cardinality: member.cardinality ?? GraphViewCardinality.Many,
                        target,
                        targetName: getViewOfMetadata(target)!.name
                    });
                    break;
                }
            }
        }

        return { type, name, node, members };
    }

    private directionOf(type: Function, member: string, edge: EdgeInfo, node: NodeInfo, explicit: GraphEdgeDirection | undefined): GraphEdgeDirection {
        const outgoing = edge.sourceLabel === node.label;
        const incoming = edge.targetLabel === node.label;
        if (!outgoing && !incoming) throw new EdgeNotIncidentOnRoot(type, member, edge.edgeType, node.label);
        if (outgoing && incoming) {
            if (explicit === undefined) throw new AmbiguousDirection(type, member, edge.edgeType);
            return explicit;
        }

        const derived = outgoing ? GraphEdgeDirection.Outgoing : GraphEdgeDirection.Incoming;
        // An explicit direction the edge cannot be followed in does not start at the root of the view.
        if (explicit !== undefined && explicit !== derived) throw new EdgeNotIncidentOnRoot(type, member, edge.edgeType, node.label);
        return derived;
    }

    private validateAcrossViews(resolved: ReadonlyMap<Constructor, ViewInfo>, edgesByType: ReadonlyMap<string, EdgeInfo>, failures: Map<Constructor, Error>): void {
        const used = new Map<Function, Set<string>>();
        for (const view of resolved.values()) {
            for (const member of view.members) {
                if (member.kind !== GraphViewMemberKind.Relation) continue;
                const edges = used.get(member.target) ?? new Set<string>();
                edges.add(member.edge.edgeType);
                used.set(member.target, edges);
            }
        }

        for (const view of resolved.values()) {
            try {
                const cycle = this.cycleThrough(view, resolved);
                if (cycle !== undefined) throw new RecursiveView(view.type, cycle);
                this.validateEdgeProperties(view, used.get(view.type), edgesByType);
            } catch (error) {
                failures.set(view.type, error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    private validateEdgeProperties(view: ViewInfo, edges: ReadonlySet<string> | undefined, edgesByType: ReadonlyMap<string, EdgeInfo>): void {
        const members = view.members.filter((member): member is EdgePropertyMemberInfo => member.kind === GraphViewMemberKind.EdgeProperty);
        if (members.length === 0) return;
        if (edges === undefined || edges.size === 0) throw new EdgePropertyViewNotUsedAsTarget(view.type);
        if (edges.size > 1) throw new EdgePropertyViewSharedAcrossEdges(view.type, [...edges]);

        const edge = edgesByType.get([...edges][0])!;
        for (const member of members) {
            member.source = this.find(edge.properties, member.requested);
            if (member.source === undefined) throw new UnknownEdgeProperty(view.type, member.name, edge.edgeType, member.requested);
        }
    }

    private cycleThrough(start: ViewInfo, resolved: ReadonlyMap<Constructor, ViewInfo>): string[] | undefined {
        const visited = new Set<Function>();
        const walk = (current: ViewInfo, path: string[]): string[] | undefined => {
            for (const member of current.members) {
                if (member.kind !== GraphViewMemberKind.Relation) continue;
                const next = resolved.get(member.target as Constructor);
                if (next === undefined) continue;
                if (next === start) return [...path, next.name];
                if (visited.has(next.type)) continue;
                visited.add(next.type);
                const found = walk(next, [...path, next.name]);
                if (found !== undefined) return found;
            }

            return undefined;
        };

        return walk(start, [start.name]);
    }

    private member(member: MemberInfo): GraphViewMember {
        switch (member.kind) {
            case GraphViewMemberKind.Relation:
                return {
                    name: member.name,
                    kind: member.kind,
                    edge: member.edge.edgeType,
                    direction: member.direction,
                    cardinality: member.cardinality,
                    view: member.targetName
                };
            case GraphViewMemberKind.EdgeProperty:
                return { name: member.name, kind: member.kind, source: member.source! };
            default:
                return { name: member.name, kind: member.kind, source: member.source };
        }
    }

    private edgeOf(
        reference: GraphViewEdgeReference,
        edgesByClass: ReadonlyMap<Function, EdgeInfo>,
        edgesByType: ReadonlyMap<string, EdgeInfo>
    ): EdgeInfo | undefined {
        return typeof reference === 'string' ? edgesByType.get(reference) : edgesByClass.get(reference());
    }

    private edgeName(reference: GraphViewEdgeReference): string {
        if (typeof reference === 'string') return reference;
        const type = reference();
        return getEdgeMetadata(type)?.type ?? type.name;
    }

    // Names are matched without regard to case, and an exact match wins.
    private find(names: readonly string[], wanted: string): string | undefined {
        const lowered = wanted.toLowerCase();
        return names.find(name => name === wanted) ?? names.find(name => name.toLowerCase() === lowered);
    }
}

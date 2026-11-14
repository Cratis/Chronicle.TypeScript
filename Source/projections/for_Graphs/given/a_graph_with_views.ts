// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import type { ChroniclePropertyDecorator } from '../../../types/propertyDecoratorMetadata.js';
import { edge } from '../../graphs/edge.js';
import { edgeSource } from '../../graphs/edgeSource.js';
import { edgeTarget } from '../../graphs/edgeTarget.js';
import { graph } from '../../graphs/graph.js';
import { graphKey } from '../../graphs/graphKey.js';
import { node } from '../../graphs/node.js';
import { viewOf } from '../../graphs/views/viewOf.js';
import { discoverGraphs } from './a_discovered_graph.js';

// Decorators are applied as plain function calls so the fixtures do not depend on decorator-syntax support.

/** A graph of people and groups, declared fresh so each specification owns its classes. */
export interface Organization {
    readonly graphName: string;
    readonly Person: Constructor;
    readonly Group: Constructor;
    /** Person to Group, with the property since. */
    readonly MemberOf: Constructor;
    /** Person to Person, a self edge, with the property since. */
    readonly Knows: Constructor;
    /** The nodes and edges, to hand to discovery. */
    readonly elements: Constructor[];
}

/**
 * Declares a graph of people and groups.
 * @param graphName - The name of the graph.
 * @returns The classes of the graph.
 */
export function anOrganization(graphName: string): Organization {
    class Person { personId = ''; name = ''; }
    graph(graphName)(Person);
    node()(Person);
    graphKey()(Person.prototype, 'personId');

    class Group { groupId = ''; name = ''; }
    graph(graphName)(Group);
    node()(Group);
    graphKey()(Group.prototype, 'groupId');

    class MemberOf { personId = ''; groupId = ''; since = ''; }
    graph(graphName)(MemberOf);
    edge('MEMBER_OF')(MemberOf);
    edgeSource(Person)(MemberOf.prototype, 'personId');
    edgeTarget(Group)(MemberOf.prototype, 'groupId');

    class Knows { fromId = ''; toId = ''; since = ''; }
    graph(graphName)(Knows);
    edge('KNOWS')(Knows);
    edgeSource(Person)(Knows.prototype, 'fromId');
    edgeTarget(Person)(Knows.prototype, 'toId');

    return { graphName, Person, Group, MemberOf, Knows, elements: [Person, Group, MemberOf, Knows] };
}

/** A member of a view: the name of the property and the decorator that declares it. */
export type ViewMember = readonly [property: string, decorator: ChroniclePropertyDecorator];

/**
 * Declares a view over a graph.
 * @param graphName - The name of the graph.
 * @param name - The name of the view, which is also the name of the class.
 * @param root - A function returning the class of the node the view is anchored at.
 * @param members - The members of the view, in declaration order.
 * @returns The class of the view.
 */
export function aView(graphName: string, name: string, root: () => Function, ...members: ViewMember[]): Constructor {
    class View {}
    Object.defineProperty(View, 'name', { value: name });
    graph(graphName)(View);
    viewOf(root)(View);
    for (const [property, decorator] of members) decorator(View.prototype, property);
    return View;
}

/**
 * Discovers a graph with views, once.
 * @param organization - The graph.
 * @param views - The views.
 * @returns The discovered graphs.
 */
export async function discoverViews(organization: Organization, ...views: Constructor[]) {
    const result = await discoverGraphs(organization.elements, [], 'Neo4j', views);
    return result.graphs;
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { Graphs } from '../../graphs/Graphs.js';
import { aFakeConnection } from './a_fake_connection.js';
import { artifactsWith } from './organization.js';

/**
 * Discovers the graphs of the given nodes, edges and fluent graph projections.
 * @param graphElements - The nodes and edges.
 * @param graphProjections - The fluent graph projections.
 * @param sinkTypeId - The sink type of the graphs.
 * @param graphViews - The views over graphs.
 * @returns The graphs, once discovered, and what is needed to look at what they registered.
 */
export async function discoverGraphs(graphElements: Constructor[], graphProjections: Constructor[] = [], sinkTypeId = 'Neo4j', graphViews: Constructor[] = []) {
    const fake = aFakeConnection();
    const graphs = new Graphs('the-store', fake.connection, artifactsWith(graphElements, graphProjections, graphViews), sinkTypeId);
    await graphs.discover();
    return { graphs, ...fake };
}

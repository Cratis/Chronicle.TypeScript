// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { DefaultClientArtifactsProvider } from '../../artifacts/DefaultClientArtifactsProvider.js';
import { rootReadModelTypes } from '../../readModels/rootReadModelTypes.js';
import { TypeDiscoverer } from '../../types/index.js';
import { isGraphElement } from '../graphs/isGraphElement.js';
import { discoverGraphs } from './given/a_discovered_graph.js';
import { Group, MemberOf, Person } from './given/organization.js';

chai.should();

describe('when discovering the artifacts of an application with a graph', () => {
    const provider = new DefaultClientArtifactsProvider(TypeDiscoverer.default);

    it('should find the nodes and edges', () => {
        provider.graphElements.should.include.members([Person, Group, MemberOf]);
    });
    it('should recognize them as graph elements', () => {
        [Person, Group, MemberOf].every(isGraphElement).should.be.true;
    });
    it('should not treat them as read models, even though they map properties like read models do', () => {
        provider.readModels.should.not.include.members([MemberOf]);
        rootReadModelTypes(provider).should.not.include.members([Person, Group, MemberOf]);
    });
    it('should build the graph from what it finds', async () => {
        const result = await discoverGraphs(provider.graphElements);
        result.graphs.registrations.map(_ => _.graphName).should.include('Organization');
    });
});

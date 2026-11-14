// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { DefaultClientArtifactsProvider } from '../../artifacts/DefaultClientArtifactsProvider.js';
import { rootReadModelTypes } from '../../readModels/rootReadModelTypes.js';
import { TypeDiscoverer } from '../../types/index.js';
import { graph } from '../graphs/graph.js';
import { viewKey } from '../graphs/views/viewKey.js';
import { viewOf } from '../graphs/views/viewOf.js';
import { discoverGraphs } from './given/a_discovered_graph.js';
import { aView, anOrganization } from './given/a_graph_with_views.js';
import { GroupSummary, MemberSummary, organizationViews, Person } from './given/organization_with_views.fixture.js';

chai.should();

describe('when discovering the artifacts of an application with graph views', () => {
    const provider = new DefaultClientArtifactsProvider(TypeDiscoverer.default);

    it('should find the views', () => {
        provider.graphViews.should.include.members(organizationViews);
    });
    it('should not find a view among the nodes and edges', () => {
        provider.graphElements.should.not.include.members(organizationViews);
    });
    it('should not treat a view as a read model', () => {
        provider.readModels.should.not.include.members(organizationViews);
        rootReadModelTypes(provider).should.not.include.members(organizationViews);
        provider.graphElements.should.include.members([Person]);
    });
    it('should build the definition from what it finds', async () => {
        const result = await discoverGraphs(provider.graphElements, [], 'Neo4j', provider.graphViews);
        result.graphs.failures.size.should.equal(0);
        result.graphs.viewDefinitions.map(_ => _.graph).should.deep.equal(['Organization']);
        result.graphs.viewDefinitions[0].views.map(view => view.name).should.include.members([GroupSummary.name, MemberSummary.name]);
    });
});

describe('when views of different graphs have the same class name', () => {
    it('should discover both', () => {
        const first = anOrganization('FirstGraph');
        const second = anOrganization('SecondGraph');
        const one = aView(first.graphName, 'SharedName', () => first.Person, ['id', viewKey()]);
        const other = aView(second.graphName, 'SharedName', () => second.Person, ['id', viewKey()]);
        const found = new DefaultClientArtifactsProvider(TypeDiscoverer.default).graphViews;
        found.should.include.members([one, other]);
    });

    it('should discover a class once however often it is decorated', () => {
        const organization = anOrganization('Redecorated');
        class Once { id = ''; }
        graph(organization.graphName)(Once);
        viewOf(() => organization.Person)(Once);
        viewOf(() => organization.Person)(Once);
        new DefaultClientArtifactsProvider(TypeDiscoverer.default).graphViews.filter(type => type === Once).should.have.lengthOf(1);
    });
});

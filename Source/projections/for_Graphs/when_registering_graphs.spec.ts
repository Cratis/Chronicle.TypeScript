// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ProjectionOwner } from '@cratis/chronicle.contracts';
import { beforeAll, chai, describe, it } from 'vitest';
import { discoverGraphs } from './given/a_discovered_graph.js';
import { Group, MemberOf, Person } from './given/organization.js';

chai.should();

describe('when registering a graph', () => {
    let result: Awaited<ReturnType<typeof discoverGraphs>>;

    beforeAll(async () => {
        result = await discoverGraphs([Person, Group, MemberOf]);
        await result.graphs.register();
    });

    it('should register the graph as a read model of the event store', () => {
        result.readModelRequests.length.should.equal(1);
        const request = result.readModelRequests[0];
        request.EventStore.should.equal('the-store');
        request.ReadModels.map(readModel => readModel.Type.Identifier).should.deep.equal(['Organization']);
    });
    it('should register the projection that fills the graph, with the graph definition on the wire', () => {
        result.projectionRequests.length.should.equal(1);
        const request = result.projectionRequests[0];
        request.EventStore.should.equal('the-store');
        request.Owner.should.equal(ProjectionOwner.PROJECTION_OWNER_Client);
        request.Projections[0].Identifier.should.equal('Organization');
        Object.keys(request.Projections[0].Graph.Nodes).should.deep.equal(['Person', 'Group']);
        Object.keys(request.Projections[0].Graph.Edges).should.deep.equal(['MEMBER_OF']);
    });
});

describe('when registering without graphs', () => {
    it('should not call the kernel', async () => {
        const result = await discoverGraphs([]);
        await result.graphs.register();
        result.readModelRequests.length.should.equal(0);
        result.projectionRequests.length.should.equal(0);
    });
});

describe('when the graph definition has to be encoded for the wire', () => {
    it('should encode as a projection definition', async () => {
        const { ProjectionDefinition } = await import('@cratis/chronicle.contracts');
        const result = await discoverGraphs([Person, Group, MemberOf]);
        const bytes = ProjectionDefinition.encode(result.graphs.registrations[0].projection).finish();
        const decoded = ProjectionDefinition.decode(bytes);
        decoded.Graph!.Nodes.Person.From['PersonRegistered+1'].Key.should.equal('personId');
        decoded.Graph!.Edges.MEMBER_OF.From['MemberAdded+1'].Properties.since.should.equal('$eventContext(Occurred)');
        decoded.Graph!.Nodes.Person.RemovedWith['PersonRemoved+1'].Detach.should.be.true;
    });
});

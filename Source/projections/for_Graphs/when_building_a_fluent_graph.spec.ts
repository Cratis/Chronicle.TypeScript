// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { beforeAll, chai, describe, it } from 'vitest';
import { graph } from '../graphs/graph.js';
import { graphProjection } from '../graphs/graphProjection.js';
import type { IGraphProjection } from '../graphs/IGraphProjection.js';
import type { IGraphProjectionBuilder } from '../graphs/IGraphProjectionBuilder.js';
import { discoverGraphs } from './given/a_discovered_graph.js';
import {
    Group, GroupCreated, MemberAdded, MemberOf, MemberRemoved, Person, PersonRegistered, PersonRemoved
} from './given/organization.js';

chai.should();

// The nodes and edges of the fluent graph are the plain types; the fluent builder says what the decorators say elsewhere.
class PlainPerson { personId = ''; name = ''; }
class PlainGroup { groupId = ''; name = ''; }
class PlainMemberOf { times = 0; }

class OrganizationGraph implements IGraphProjection {
    define(builder: IGraphProjectionBuilder): void {
        builder
            .node(Person, node => node
                .from(PersonRegistered, from => from.usingKey(event => event.personId))
                .removedWith(PersonRemoved, removed => removed.usingKey(event => event.personId).detach()))
            .node(Group, node => node
                .from(GroupCreated, from => from.usingKey(event => event.groupId)))
            .edge(MemberOf, Person, Group, edge => edge
                .from(MemberAdded, from => from
                    .usingSourceKey(event => event.personId)
                    .usingTargetKey(event => event.groupId)
                    .set(member => member.since).toEventContextProperty('occurred'))
                .removedWith(MemberRemoved, removed => removed
                    .usingSourceKey(event => event.personId)
                    .usingTargetKey(event => event.groupId)));
    }
}
graphProjection('Organization')(OrganizationGraph);

describe('when building the same graph with the fluent builder as with the decorators', () => {
    let fluent: Awaited<ReturnType<typeof discoverGraphs>>;
    let decorated: Awaited<ReturnType<typeof discoverGraphs>>;

    beforeAll(async () => {
        fluent = await discoverGraphs([], [OrganizationGraph]);
        decorated = await discoverGraphs([Person, Group, MemberOf]);
    });

    it('should not fail', () => fluent.graphs.failures.size.should.equal(0));
    it('should describe the graph with the same schema', () => {
        fluent.graphs.registrations[0].readModel.Schema.should.equal(decorated.graphs.registrations[0].readModel.Schema);
    });
    it('should map the graph from the same events', () => {
        fluent.graphs.registrations[0].projection.Graph!.should.deep.equal(decorated.graphs.registrations[0].projection.Graph!);
    });
    it('should be the projection that fills the read model of the graph', () => {
        fluent.graphs.registrations[0].projection.ReadModel.should.equal('Organization');
        fluent.graphs.registrations[0].projection.Identifier.should.equal('OrganizationGraph');
    });
});

describe('when declaring a fluent graph without a name', () => {
    it('should name the graph after the class', async () => {
        class Anonymous implements IGraphProjection {
            define(builder: IGraphProjectionBuilder): void {
                builder.node(PlainPerson, node => node.identifiedBy(person => person.personId).from(PersonRegistered));
            }
        }
        graphProjection()(Anonymous);
        const result = await discoverGraphs([], [Anonymous]);
        result.graphs.registrations[0].graphName.should.equal('Anonymous');
    });
});

describe('when declaring a fluent graph without decorators on its nodes and edges', () => {
    let projection: Awaited<ReturnType<typeof discoverGraphs>>['graphs']['registrations'][0]['projection'];

    beforeAll(async () => {
        class PlainGraph implements IGraphProjection {
            define(builder: IGraphProjectionBuilder): void {
                builder
                    .node(PlainPerson, node => node.identifiedBy(person => person.personId).from(PersonRegistered))
                    .node(PlainGroup, node => node.identifiedBy(group => group.groupId).from(GroupCreated))
                    .edge(PlainMemberOf, PlainPerson, PlainGroup, edge => edge
                        .named('MEMBER_OF')
                        .from(MemberAdded, from => from
                            .usingSourceKey(event => event.personId)
                            .usingTargetKey(event => event.groupId)
                            .increment(member => member.times)));
            }
        }
        graph('Plain')(PlainGraph);
        graphProjection('Plain')(PlainGraph);
        const result = await discoverGraphs([], [PlainGraph]);
        projection = result.graphs.registrations[0].projection;
    });

    it('should label the nodes with the name of the class and take the key from identifiedBy', () => {
        Object.keys(projection.Graph!.Nodes).should.deep.equal(['PlainPerson', 'PlainGroup']);
        projection.Graph!.Nodes.PlainPerson.From['PersonRegistered+1'].Key.should.equal('$eventSourceId');
    });
    it('should name the edge', () => {
        Object.keys(projection.Graph!.Edges).should.deep.equal(['MEMBER_OF']);
    });
    it('should take the end node keys from the event and map the properties of the edge', () => {
        projection.Graph!.Edges.MEMBER_OF.From['MemberAdded+1'].should.deep.equal({
            SourceKey: 'personId', TargetKey: 'groupId', Identity: '', Properties: { times: '$increment' }
        });
    });
});

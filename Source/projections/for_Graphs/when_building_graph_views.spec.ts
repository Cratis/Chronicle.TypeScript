// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { graph } from '../graphs/graph.js';
import { GraphNameRequired } from '../graphs/GraphNameRequired.js';
import { follows } from '../graphs/views/follows.js';
import { fromEdge } from '../graphs/views/fromEdge.js';
import { GraphEdgeDirection } from '../graphs/views/GraphEdgeDirection.js';
import { GraphViewCardinality } from '../graphs/views/GraphViewCardinality.js';
import { GraphViewDefinitionSerializer } from '../graphs/views/GraphViewDefinitionSerializer.js';
import { GraphViewMemberKind } from '../graphs/views/GraphViewMemberKind.js';
import type { GraphViewRelationMember } from '../graphs/views/GraphViewRelationMember.js';
import { GraphViewReason } from '../graphs/views/GraphViewReason.js';
import { viewKey } from '../graphs/views/viewKey.js';
import { viewOf } from '../graphs/views/viewOf.js';
import { viewProperty } from '../graphs/views/viewProperty.js';
import { ViewRootNotANode } from '../graphs/views/ViewRootNotANode.js';
import { discoverGraphs } from './given/a_discovered_graph.js';
import { aView, anOrganization, discoverViews } from './given/a_graph_with_views.js';
import { Group, MemberOf, Person } from './given/organization.js';

chai.should();

describe('when a view reads properties of its root node', () => {
    it('should read the key from the key of the node and the others by name without regard to case', async () => {
        const organization = anOrganization('Properties');
        const view = aView(organization.graphName, 'Person', () => organization.Person,
            ['id', viewKey()], ['Name', viewProperty()], ['fullName', viewProperty('NAME')]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.size.should.equal(0);
        graphs.viewDefinitions[0].views[0].members.should.deep.equal([
            { name: 'id', kind: GraphViewMemberKind.Property, source: 'personId' },
            { name: 'Name', kind: GraphViewMemberKind.Property, source: 'name' },
            { name: 'fullName', kind: GraphViewMemberKind.Property, source: 'name' }
        ]);
    });

    it('should keep the members in the order they are declared', async () => {
        const organization = anOrganization('Order');
        const view = aView(organization.graphName, 'Person', () => organization.Person,
            ['name', viewProperty()], ['id', viewKey()]);
        const graphs = await discoverViews(organization, view);
        graphs.viewDefinitions[0].views[0].members.map(member => member.name).should.deep.equal(['name', 'id']);
    });
});

describe('when a relation follows an edge', () => {
    it('should derive the outgoing direction and a many cardinality when the root is the source of the edge', async () => {
        const organization = anOrganization('Outgoing');
        const group = aView(organization.graphName, 'GroupSummary', () => organization.Group, ['id', viewKey()]);
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => group)]);
        const graphs = await discoverViews(organization, group, view);
        graphs.failures.size.should.equal(0);
        const relation = graphs.viewDefinitions[0].views.find(candidate => candidate.name === 'PersonWithGroups')!.members[0] as GraphViewRelationMember;
        relation.should.deep.equal({
            name: 'groups', kind: GraphViewMemberKind.Relation, edge: 'MEMBER_OF',
            direction: GraphEdgeDirection.Outgoing, cardinality: GraphViewCardinality.Many, view: 'GroupSummary'
        });
    });

    it('should derive the incoming direction when the root is the target of the edge', async () => {
        const organization = anOrganization('Incoming');
        const person = aView(organization.graphName, 'PersonSummary', () => organization.Person, ['id', viewKey()]);
        const view = aView(organization.graphName, 'GroupWithMembers', () => organization.Group, ['members', follows('MEMBER_OF', () => person)]);
        const graphs = await discoverViews(organization, person, view);
        graphs.failures.size.should.equal(0);
        const relation = graphs.viewDefinitions[0].views.find(candidate => candidate.name === 'GroupWithMembers')!.members[0] as GraphViewRelationMember;
        relation.direction.should.equal(GraphEdgeDirection.Incoming);
    });

    it('should take the explicit direction of a self edge and the declared single cardinality', async () => {
        const organization = anOrganization('SelfEdge');
        const person = aView(organization.graphName, 'PersonSummary', () => organization.Person, ['id', viewKey()]);
        const view = aView(organization.graphName, 'PersonWithKnownBy', () => organization.Person,
            ['knownBy', follows(() => organization.Knows, () => person, { direction: GraphEdgeDirection.Incoming, cardinality: GraphViewCardinality.One })]);
        const graphs = await discoverViews(organization, person, view);
        graphs.failures.size.should.equal(0);
        const relation = graphs.viewDefinitions[0].views.find(candidate => candidate.name === 'PersonWithKnownBy')!.members[0] as GraphViewRelationMember;
        relation.direction.should.equal(GraphEdgeDirection.Incoming);
        relation.cardinality.should.equal(GraphViewCardinality.One);
    });

    it('should name the view of the relation by its view name, which may differ from its class name', async () => {
        const organization = anOrganization('NamedTarget');
        class Summary { id = ''; }
        viewOf(() => organization.Group, { name: 'GroupCard' })(Summary);
        viewKey()(Summary.prototype, 'id');
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => Summary)]);
        graph(organization.graphName)(Summary);
        const graphs = await discoverViews(organization, Summary, view);
        graphs.failures.size.should.equal(0);
        (graphs.viewDefinitions[0].views.find(candidate => candidate.name === 'PersonWithGroups')!.members[0] as GraphViewRelationMember).view.should.equal('GroupCard');
    });

    it('should read the property of the edge it follows into the view', async () => {
        const organization = anOrganization('EdgeProperties');
        const membership = aView(organization.graphName, 'Membership', () => organization.Group, ['id', viewKey()], ['joined', fromEdge('SINCE')]);
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => membership)]);
        const graphs = await discoverViews(organization, membership, view);
        graphs.failures.size.should.equal(0);
        graphs.viewDefinitions[0].views.find(candidate => candidate.name === 'Membership')!.members[1].should.deep.equal(
            { name: 'joined', kind: GraphViewMemberKind.EdgeProperty, source: 'since' });
    });
});

describe('when members are declared more than once', () => {
    it('should refuse to declare one member as two kinds', () => {
        class Confused { id = ''; }
        (() => {
            viewKey()(Confused.prototype, 'id');
            viewProperty()(Confused.prototype, 'id');
        }).should.throw(TypeError, /one kind of member/);
    });
});

describe('when a graph has an invalid view', () => {
    it('should withhold the definition of that graph only and register every graph', async () => {
        const good = anOrganization('Good');
        const goodView = aView(good.graphName, 'Person', () => good.Person, ['id', viewKey()]);
        const bad = anOrganization('Bad');
        const badView = aView(bad.graphName, 'Broken', () => bad.Person, ['nickname', viewProperty()]);
        const siblingOfBad = aView(bad.graphName, 'Fine', () => bad.Person, ['id', viewKey()]);
        const result = await discoverGraphs([...good.elements, ...bad.elements], [], 'Neo4j', [goodView, badView, siblingOfBad]);
        result.graphs.registrations.map(_ => _.graphName).should.have.members(['Good', 'Bad']);
        result.graphs.viewDefinitions.map(_ => _.graph).should.deep.equal(['Good']);
        result.graphs.failures.has(badView).should.be.true;
        result.graphs.failures.has(siblingOfBad).should.be.false;
        result.graphs.failures.has(goodView).should.be.false;
        result.readModelRequests.length.should.equal(0);
    });

    it('should register the graphs when they are registered', async () => {
        const bad = anOrganization('BadRegistered');
        const badView = aView(bad.graphName, 'Broken', () => bad.Person, ['nickname', viewProperty()]);
        const result = await discoverGraphs(bad.elements, [], 'Neo4j', [badView]);
        await result.graphs.register();
        result.readModelRequests[0].ReadModels.map(readModel => readModel.Type.Identifier).should.deep.equal(['BadRegistered']);
    });
});

describe('when a view names a graph that is not registered', () => {
    it('should fail with ViewRootNotANode', async () => {
        const organization = anOrganization('Registered');
        const stray = anOrganization('Unregistered');
        const view = aView(stray.graphName, 'Person', () => stray.Person, ['id', viewKey()]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(ViewRootNotANode).and.have.property('reason', GraphViewReason.ViewRootNotANode);
        graphs.viewDefinitions.should.have.lengthOf(0);
    });
});

describe('when a view does not say which graph it belongs to', () => {
    it('should fail with GraphNameRequired', async () => {
        const organization = anOrganization('Homeless');
        class Homeless { id = ''; }
        viewOf(() => organization.Person)(Homeless);
        viewKey()(Homeless.prototype, 'id');
        const graphs = await discoverViews(organization, Homeless);
        graphs.failures.get(Homeless)!.should.be.instanceOf(GraphNameRequired);
    });
});

describe('when discovering a graph that has no views', () => {
    it('should register exactly what it registered without views, and emit no view definition', async () => {
        const alone = await discoverGraphs([Person, Group, MemberOf]);
        const organization = anOrganization('Elsewhere');
        const view = aView(organization.graphName, 'Person', () => organization.Person, ['id', viewKey()]);
        const beside = await discoverGraphs([Person, Group, MemberOf, ...organization.elements], [], 'Neo4j', [view]);

        alone.graphs.viewDefinitions.should.have.lengthOf(0);
        alone.graphs.failures.size.should.equal(0);
        const registrationOf = (graphs: typeof alone.graphs) => graphs.registrations.find(_ => _.graphName === 'Organization');
        registrationOf(beside.graphs)!.should.deep.equal(registrationOf(alone.graphs));
        beside.graphs.viewDefinitions.map(_ => _.graph).should.deep.equal(['Elsewhere']);
    });
});

describe('when serializing a definition', () => {
    const serializer = new GraphViewDefinitionSerializer();

    it('should sort the views by name in ordinal order and keep the members in declaration order', () => {
        const member = (name: string) => ({ name, kind: GraphViewMemberKind.Property as const, source: name });
        const text = serializer.serialize({
            graph: 'G',
            views: [
                { name: 'alpha', root: 'N', members: [member('b'), member('a')] },
                { name: 'Zulu', root: 'N', members: [] }
            ]
        });
        text.should.equal([
            '{',
            '  "graph": "G",',
            '  "views": [',
            '    {',
            '      "name": "Zulu",',
            '      "root": "N",',
            '      "members": []',
            '    },',
            '    {',
            '      "name": "alpha",',
            '      "root": "N",',
            '      "members": [',
            '        { "name": "b", "kind": "property", "source": "b" },',
            '        { "name": "a", "kind": "property", "source": "a" }',
            '      ]',
            '    }',
            '  ]',
            '}',
            ''
        ].join('\n'));
    });

    it('should write a definition without views', () => {
        serializer.serialize({ graph: 'G', views: [] }).should.equal('{\n  "graph": "G",\n  "views": []\n}\n');
    });
});

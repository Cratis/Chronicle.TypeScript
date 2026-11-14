// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { graph } from '../graphs/graph.js';
import { graphKey } from '../graphs/graphKey.js';
import { node } from '../graphs/node.js';
import { AmbiguousDirection } from '../graphs/views/AmbiguousDirection.js';
import { DuplicateViewName } from '../graphs/views/DuplicateViewName.js';
import { EdgeNotIncidentOnRoot } from '../graphs/views/EdgeNotIncidentOnRoot.js';
import { EdgePropertyViewNotUsedAsTarget } from '../graphs/views/EdgePropertyViewNotUsedAsTarget.js';
import { EdgePropertyViewSharedAcrossEdges } from '../graphs/views/EdgePropertyViewSharedAcrossEdges.js';
import { follows } from '../graphs/views/follows.js';
import { fromEdge } from '../graphs/views/fromEdge.js';
import { GraphEdgeDirection } from '../graphs/views/GraphEdgeDirection.js';
import { GraphViewReason } from '../graphs/views/GraphViewReason.js';
import { RecursiveView } from '../graphs/views/RecursiveView.js';
import { RelationTargetNotAView } from '../graphs/views/RelationTargetNotAView.js';
import { TargetLabelMismatch } from '../graphs/views/TargetLabelMismatch.js';
import { UnknownEdge } from '../graphs/views/UnknownEdge.js';
import { UnknownEdgeProperty } from '../graphs/views/UnknownEdgeProperty.js';
import { UnknownNodeProperty } from '../graphs/views/UnknownNodeProperty.js';
import { viewKey } from '../graphs/views/viewKey.js';
import { viewOf } from '../graphs/views/viewOf.js';
import { ViewIsAlsoSchema } from '../graphs/views/ViewIsAlsoSchema.js';
import { viewProperty } from '../graphs/views/viewProperty.js';
import { ViewRootNotANode } from '../graphs/views/ViewRootNotANode.js';
import { aView, anOrganization, discoverViews } from './given/a_graph_with_views.js';

chai.should();

describe('when a view is anchored at a type that is not a node of the graph', () => {
    it('should fail with ViewRootNotANode', async () => {
        const organization = anOrganization('RootNotANode');
        class Stranger { strangerId = ''; }
        const view = aView(organization.graphName, 'Stranger', () => Stranger, ['id', viewKey()]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(ViewRootNotANode).and.have.property('reason', GraphViewReason.ViewRootNotANode);
        graphs.viewDefinitions.should.have.lengthOf(0);
    });
});

describe('when a view is also a node', () => {
    it('should fail with ViewIsAlsoSchema and still register the graph', async () => {
        const organization = anOrganization('AlsoSchema');
        class Both { bothId = ''; }
        graph(organization.graphName)(Both);
        node()(Both);
        graphKey()(Both.prototype, 'bothId');
        viewOf(() => Both)(Both);
        viewKey()(Both.prototype, 'bothId');
        const graphs = await discoverViews({ ...organization, elements: [...organization.elements, Both] }, Both);
        graphs.failures.get(Both)!.should.be.instanceOf(ViewIsAlsoSchema).and.have.property('reason', GraphViewReason.ViewIsAlsoSchema);
        graphs.registrations.map(_ => _.graphName).should.deep.equal([organization.graphName]);
    });
});

describe('when two views of a graph have the same name', () => {
    it('should fail the second with DuplicateViewName', async () => {
        const organization = anOrganization('Duplicates');
        const first = aView(organization.graphName, 'Summary', () => organization.Person, ['id', viewKey()]);
        const second = aView(organization.graphName, 'Summary', () => organization.Group, ['id', viewKey()]);
        const graphs = await discoverViews(organization, first, second);
        graphs.failures.has(first).should.be.false;
        graphs.failures.get(second)!.should.be.instanceOf(DuplicateViewName).and.have.property('reason', GraphViewReason.DuplicateViewName);
    });

    it('should accept the same class name once a view is given another name', async () => {
        const organization = anOrganization('Renamed');
        class Summary { id = ''; }
        graph(organization.graphName)(Summary);
        viewOf(() => organization.Person, { name: 'PersonSummary' })(Summary);
        viewKey()(Summary.prototype, 'id');
        const other = aView(organization.graphName, 'Summary', () => organization.Group, ['id', viewKey()]);
        const graphs = await discoverViews(organization, Summary, other);
        graphs.failures.size.should.equal(0);
        graphs.viewDefinitions[0].views.map(view => view.name).should.deep.equal(['PersonSummary', 'Summary']);
    });
});

describe('when a view reads a property the node does not declare', () => {
    it('should fail with UnknownNodeProperty', async () => {
        const organization = anOrganization('UnknownNodeProperty');
        const view = aView(organization.graphName, 'Nicknamed', () => organization.Person, ['nickname', viewProperty()]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(UnknownNodeProperty).and.have.property('reason', GraphViewReason.UnknownNodeProperty);
    });

    it('should fail when the explicit source is not a property of the node', async () => {
        const organization = anOrganization('UnknownSource');
        const view = aView(organization.graphName, 'Titled', () => organization.Person, ['title', viewProperty('fullName')]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(UnknownNodeProperty).and.have.property('message').that.includes("'fullName'");
    });
});

describe('when a relation follows an edge the graph does not declare', () => {
    it('should fail with UnknownEdge for an edge type string', async () => {
        const organization = anOrganization('UnknownEdgeString');
        const target = aView(organization.graphName, 'GroupSummary', () => organization.Group, ['id', viewKey()]);
        const view = aView(organization.graphName, 'Lonely', () => organization.Person, ['groups', follows('LIKES', () => target)]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(view)!.should.be.instanceOf(UnknownEdge).and.have.property('reason', GraphViewReason.UnknownEdge);
    });

    it('should fail with UnknownEdge for a class that is not an edge of the graph', async () => {
        const organization = anOrganization('UnknownEdgeClass');
        class Elsewhere { fromId = ''; toId = ''; }
        const target = aView(organization.graphName, 'GroupSummary', () => organization.Group, ['id', viewKey()]);
        const view = aView(organization.graphName, 'Lonely', () => organization.Person, ['groups', follows(() => Elsewhere, () => target)]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(view)!.should.be.instanceOf(UnknownEdge);
    });
});

describe('when a view reads a property the edge does not declare', () => {
    it('should fail with UnknownEdgeProperty', async () => {
        const organization = anOrganization('UnknownEdgeProperty');
        const target = aView(organization.graphName, 'Membership', () => organization.Group, ['id', viewKey()], ['weight', fromEdge()]);
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => target)]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(target)!.should.be.instanceOf(UnknownEdgeProperty).and.have.property('reason', GraphViewReason.UnknownEdgeProperty);
        graphs.failures.has(view).should.be.false;
    });
});

describe('when a relation follows an edge that does not start or end at the root of the view', () => {
    it('should fail with EdgeNotIncidentOnRoot', async () => {
        const organization = anOrganization('NotIncident');
        const target = aView(organization.graphName, 'PersonSummary', () => organization.Person, ['id', viewKey()]);
        const view = aView(organization.graphName, 'GroupWithFriends', () => organization.Group, ['friends', follows(() => organization.Knows, () => target)]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(view)!.should.be.instanceOf(EdgeNotIncidentOnRoot).and.have.property('reason', GraphViewReason.EdgeNotIncidentOnRoot);
    });

    it('should fail when the explicit direction is one the edge cannot be followed in from the root', async () => {
        const organization = anOrganization('WrongDirection');
        const target = aView(organization.graphName, 'GroupSummary', () => organization.Group, ['id', viewKey()]);
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person,
            ['groups', follows(() => organization.MemberOf, () => target, { direction: GraphEdgeDirection.Incoming })]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(view)!.should.be.instanceOf(EdgeNotIncidentOnRoot);
    });
});

describe('when a relation follows a self edge without a direction', () => {
    it('should fail with AmbiguousDirection', async () => {
        const organization = anOrganization('Ambiguous');
        const target = aView(organization.graphName, 'Friend', () => organization.Person, ['id', viewKey()]);
        const view = aView(organization.graphName, 'PersonWithFriends', () => organization.Person, ['friends', follows(() => organization.Knows, () => target)]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(view)!.should.be.instanceOf(AmbiguousDirection).and.have.property('reason', GraphViewReason.AmbiguousDirection);
    });
});

describe('when the target view is anchored at a label that is not at the far end of the edge', () => {
    it('should fail with TargetLabelMismatch', async () => {
        const organization = anOrganization('Mismatch');
        const target = aView(organization.graphName, 'PersonSummary', () => organization.Person, ['id', viewKey()]);
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => target)]);
        const graphs = await discoverViews(organization, target, view);
        graphs.failures.get(view)!.should.be.instanceOf(TargetLabelMismatch).and.have.property('reason', GraphViewReason.TargetLabelMismatch);
        graphs.failures.has(target).should.be.false;
    });
});

describe('when a relation yields a type that is not a view', () => {
    it('should fail with RelationTargetNotAView', async () => {
        const organization = anOrganization('NotAView');
        class Plain { id = ''; }
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => Plain)]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(RelationTargetNotAView).and.have.property('reason', GraphViewReason.RelationTargetNotAView);
    });

    it('should fail when the view belongs to another graph', async () => {
        const organization = anOrganization('Here');
        const elsewhere = anOrganization('There');
        const foreign = aView(elsewhere.graphName, 'GroupSummary', () => elsewhere.Group, ['id', viewKey()]);
        const view = aView(organization.graphName, 'PersonWithGroups', () => organization.Person, ['groups', follows(() => organization.MemberOf, () => foreign)]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(RelationTargetNotAView);
    });
});

describe('when a view contains itself', () => {
    it('should fail directly with RecursiveView', async () => {
        const organization = anOrganization('DirectRecursion');
        const view = aView(organization.graphName, 'Friends', () => organization.Person,
            ['friends', follows(() => organization.Knows, () => view, { direction: GraphEdgeDirection.Outgoing })]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(RecursiveView).and.have.property('reason', GraphViewReason.RecursiveView);
    });

    it('should fail transitively with RecursiveView, naming the cycle', async () => {
        const organization = anOrganization('TransitiveRecursion');
        const person = aView(organization.graphName, 'PersonWithGroups', () => organization.Person,
            ['groups', follows(() => organization.MemberOf, () => group)]);
        const group = aView(organization.graphName, 'GroupWithMembers', () => organization.Group,
            ['members', follows(() => organization.MemberOf, () => person)]);
        const graphs = await discoverViews(organization, person, group);
        graphs.failures.get(person)!.should.be.instanceOf(RecursiveView).and.have.property('message').that.includes('PersonWithGroups -> GroupWithMembers -> PersonWithGroups');
        graphs.failures.get(group)!.should.be.instanceOf(RecursiveView);
    });
});

describe('when a view reads edge properties but no relation yields it', () => {
    it('should fail with EdgePropertyViewNotUsedAsTarget', async () => {
        const organization = anOrganization('NotUsed');
        const view = aView(organization.graphName, 'Membership', () => organization.Group, ['id', viewKey()], ['since', fromEdge()]);
        const graphs = await discoverViews(organization, view);
        graphs.failures.get(view)!.should.be.instanceOf(EdgePropertyViewNotUsedAsTarget).and.have.property('reason', GraphViewReason.EdgePropertyViewNotUsedAsTarget);
    });
});

describe('when a view reads edge properties and relations of more than one edge type yield it', () => {
    it('should fail with EdgePropertyViewSharedAcrossEdges', async () => {
        const organization = anOrganization('Shared');
        const friend = aView(organization.graphName, 'Friend', () => organization.Person, ['id', viewKey()], ['since', fromEdge()]);
        const group = aView(organization.graphName, 'GroupWithMembers', () => organization.Group, ['members', follows(() => organization.MemberOf, () => friend)]);
        const person = aView(organization.graphName, 'PersonWithFriends', () => organization.Person,
            ['friends', follows(() => organization.Knows, () => friend, { direction: GraphEdgeDirection.Outgoing })]);
        const graphs = await discoverViews(organization, friend, group, person);
        graphs.failures.get(friend)!.should.be.instanceOf(EdgePropertyViewSharedAcrossEdges).and.have.property('reason', GraphViewReason.EdgePropertyViewSharedAcrossEdges);
        graphs.failures.has(group).should.be.false;
        graphs.failures.has(person).should.be.false;
    });
});

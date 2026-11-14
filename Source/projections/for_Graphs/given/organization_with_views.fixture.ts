// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { edge } from '../../graphs/edge.js';
import { edgeSource } from '../../graphs/edgeSource.js';
import { edgeTarget } from '../../graphs/edgeTarget.js';
import { graph } from '../../graphs/graph.js';
import { graphKey } from '../../graphs/graphKey.js';
import { node } from '../../graphs/node.js';
import { fromEdge } from '../../graphs/views/fromEdge.js';
import { follows } from '../../graphs/views/follows.js';
import { GraphEdgeDirection } from '../../graphs/views/GraphEdgeDirection.js';
import { GraphViewCardinality } from '../../graphs/views/GraphViewCardinality.js';
import { viewKey } from '../../graphs/views/viewKey.js';
import { viewOf } from '../../graphs/views/viewOf.js';
import { viewProperty } from '../../graphs/views/viewProperty.js';

// The Organization graph and its views of the shared conformance fixture (graph-views-organization.json), declared
// with decorator syntax. Which events fill the graph is not part of what a view reads, so it is left out.

@graph('Organization')
@node()
export class Person {
    @graphKey() @field(String) personId = '';
    @field(String) name = '';
}

@graph('Organization')
@node()
export class Group {
    @graphKey() @field(String) groupId = '';
    @field(String) name = '';
}

@graph('Organization')
@edge('MEMBER_OF')
export class MemberOf {
    @edgeSource(Person) @field(String) personId = '';
    @edgeTarget(Group) @field(String) groupId = '';
    @field(Date) since = new Date();
}

@graph('Organization')
@edge('PART_OF')
export class PartOf {
    @edgeSource(Group) @field(String) childId = '';
    @edgeTarget(Group) @field(String) parentId = '';
}

@graph('Organization')
@edge('HAS_ROLE')
export class HasRole {
    @edgeSource(Person) @field(String) personId = '';
    @edgeTarget(Group) @field(String) groupId = '';
    @graphKey() @field(String) assignmentId = '';
    @field(String) role = '';
    @field(Date) since = new Date();
}

@graph('Organization')
@viewOf(() => Group)
export class GroupSummary {
    @viewKey() id = '';
    @viewProperty() name = '';
}

@graph('Organization')
@viewOf(() => Group)
export class GroupMembership {
    @viewKey() id = '';
    @viewProperty() name = '';
    @fromEdge() since = new Date();
}

@graph('Organization')
@viewOf(() => Person)
export class MemberSummary {
    @viewKey() id = '';
    @viewProperty() name = '';
    @fromEdge() since = new Date();
}

@graph('Organization')
@viewOf(() => Group)
export class RoleAssignment {
    @viewKey() id = '';
    @fromEdge() assignmentId = '';
    @fromEdge() role = '';
}

@graph('Organization')
@viewOf(() => Person)
export class PersonWithGroups {
    @viewKey() id = '';
    @viewProperty() name = '';
    @follows(() => MemberOf, () => GroupMembership) groups: GroupMembership[] = [];
}

@graph('Organization')
@viewOf(() => Group)
export class GroupWithMembers {
    @viewKey() id = '';
    @viewProperty() name = '';
    @follows(() => MemberOf, () => MemberSummary) members: MemberSummary[] = [];
}

@graph('Organization')
@viewOf(() => Group)
export class GroupWithParent {
    @viewKey() id = '';
    @viewProperty() name = '';
    @follows(() => PartOf, () => GroupSummary, { cardinality: GraphViewCardinality.One, direction: GraphEdgeDirection.Outgoing }) parent: GroupSummary | null = null;
}

@graph('Organization')
@viewOf(() => Person)
export class PersonRoles {
    @viewKey() id = '';
    @follows(() => HasRole, () => RoleAssignment) roles: RoleAssignment[] = [];
}

/** The nodes and edges of the Organization graph. */
export const organizationElements = [Person, Group, MemberOf, PartOf, HasRole];

/** The views of the Organization graph, in the order they are declared. */
export const organizationViews = [
    PersonWithGroups, GroupMembership, GroupWithMembers, MemberSummary, GroupWithParent, GroupSummary, PersonRoles, RoleAssignment
];

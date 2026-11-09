// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { edge } from '../../graphs/edge.js';
import { edgeFrom } from '../../graphs/edgeFrom.js';
import { edgeRemovedWith } from '../../graphs/edgeRemovedWith.js';
import { edgeSource } from '../../graphs/edgeSource.js';
import { edgeTarget } from '../../graphs/edgeTarget.js';
import { graph } from '../../graphs/graph.js';
import { graphKey } from '../../graphs/graphKey.js';
import { node } from '../../graphs/node.js';
import { nodeFrom } from '../../graphs/nodeFrom.js';
import { nodeRemovedWith } from '../../graphs/nodeRemovedWith.js';
import { setFromContext } from '../../modelBound/setFromContext.js';
import type { Constructor } from '@cratis/fundamentals';

// Decorators are applied as plain function calls so the fixtures do not depend on decorator-syntax support.

export class PersonRegistered {
    personId = '';
    name = '';
}
eventType()(PersonRegistered);

export class PersonRemoved {
    personId = '';
}
eventType()(PersonRemoved);

export class GroupCreated {
    groupId = '';
    name = '';
}
eventType()(GroupCreated);

export class MemberAdded {
    personId = '';
    groupId = '';
}
eventType()(MemberAdded);

export class MemberRemoved {
    personId = '';
    groupId = '';
}
eventType()(MemberRemoved);

export class Person {
    personId = '';
    name = '';
}
graph('Organization')(Person);
node()(Person);
graphKey()(Person.prototype, 'personId');
nodeFrom(PersonRegistered, { key: 'personId' })(Person);
nodeRemovedWith(PersonRemoved, { key: 'personId', detach: true })(Person);

export class Group {
    groupId = '';
    name = '';
}
graph('Organization')(Group);
node()(Group);
graphKey()(Group.prototype, 'groupId');
nodeFrom(GroupCreated, { key: 'groupId' })(Group);

export class MemberOf {
    personId = '';
    groupId = '';
    since = new Date();
}
field(Date)(MemberOf.prototype, 'since');
graph('Organization')(MemberOf);
edge('MEMBER_OF')(MemberOf);
edgeSource(Person)(MemberOf.prototype, 'personId');
edgeTarget(Group)(MemberOf.prototype, 'groupId');
setFromContext(MemberAdded, 'occurred')(MemberOf.prototype, 'since');
edgeFrom(MemberAdded, { sourceKey: 'personId', targetKey: 'groupId' })(MemberOf);
edgeRemovedWith(MemberRemoved, { sourceKey: 'personId', targetKey: 'groupId' })(MemberOf);

/**
 * Creates a provider that finds only the given graph artifacts.
 * @param graphElements - The nodes and edges.
 * @param graphProjections - The fluent graph projections.
 * @returns The provider.
 */
export function artifactsWith(graphElements: Constructor[], graphProjections: Constructor[] = []): IClientArtifactsProvider {
    return {
        eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [], constraints: [], projections: [],
        webhooks: [], eventTypeMigrations: [], globalForHandlers: [], graphElements, graphProjections
    };
}

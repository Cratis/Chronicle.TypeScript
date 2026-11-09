// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { beforeAll, chai, describe, it } from 'vitest';
import type { GraphNodeProjectionDefinition } from '@cratis/chronicle.contracts';
import { eventType } from '../../events/eventTypeDecorator.js';
import { addFrom } from '../modelBound/addFrom.js';
import { count } from '../modelBound/count.js';
import { decrement } from '../modelBound/decrement.js';
import { increment } from '../modelBound/increment.js';
import { setFrom } from '../modelBound/setFrom.js';
import { setFromContext } from '../modelBound/setFromContext.js';
import { setValue } from '../modelBound/setValue.js';
import { subtractFrom } from '../modelBound/subtractFrom.js';
import { graph } from '../graphs/graph.js';
import { graphKey } from '../graphs/graphKey.js';
import { graphProjection } from '../graphs/graphProjection.js';
import type { IGraphProjection } from '../graphs/IGraphProjection.js';
import type { IGraphProjectionBuilder } from '../graphs/IGraphProjectionBuilder.js';
import { node } from '../graphs/node.js';
import { nodeFrom } from '../graphs/nodeFrom.js';
import { discoverGraphs } from './given/a_discovered_graph.js';

chai.should();

class TeamFormed { teamId = ''; title = ''; }
eventType()(TeamFormed);
class MemberJoined { teamId = ''; points = 0; }
eventType()(MemberJoined);
class MemberLeft { teamId = ''; points = 0; }
eventType()(MemberLeft);
class TeamRenamed { teamId = ''; newTitle = ''; }
eventType()(TeamRenamed);
class TeamArchived { teamId = ''; }
eventType()(TeamArchived);

class Team {
    teamId = '';
    title = '';
    memberCount = 0;
    totalPoints = 0;
    archived = false;
    renamedAt = '';
    visits = 0;
    status = '';
}
graph('Teams')(Team);
node()(Team);
graphKey()(Team.prototype, 'teamId');
nodeFrom(TeamFormed, { key: 'teamId' })(Team);
nodeFrom(MemberJoined, { key: 'teamId' })(Team);
nodeFrom(MemberLeft, { key: 'teamId' })(Team);
increment(MemberJoined)(Team.prototype, 'memberCount');
decrement(MemberLeft)(Team.prototype, 'memberCount');
addFrom(MemberJoined, 'points')(Team.prototype, 'totalPoints');
subtractFrom(MemberLeft, 'points')(Team.prototype, 'totalPoints');
count(MemberJoined)(Team.prototype, 'visits');
setFromContext(TeamRenamed, 'occurred')(Team.prototype, 'renamedAt');
setFrom(TeamRenamed, 'newTitle')(Team.prototype, 'title');
setValue(TeamArchived, true)(Team.prototype, 'archived');
setValue(TeamArchived, 'archived')(Team.prototype, 'status');

describe('when mapping the properties of a node with decorators', () => {
    let nodeDefinition: GraphNodeProjectionDefinition;

    beforeAll(async () => {
        const result = await discoverGraphs([Team]);
        result.graphs.failures.size.should.equal(0);
        nodeDefinition = result.graphs.registrations[0].projection.Graph!.Nodes.Team;
    });

    it('should map a property by name from the event that has a property of that name', () => {
        nodeDefinition.From['TeamFormed+1'].Properties.should.deep.equal({ title: 'title' });
    });
    it('should add, increment and count', () => {
        nodeDefinition.From['MemberJoined+1'].Properties.should.deep.equal({
            memberCount: '$increment', totalPoints: '$add(points)', visits: '$count'
        });
    });
    it('should subtract and decrement', () => {
        nodeDefinition.From['MemberLeft+1'].Properties.should.deep.equal({ memberCount: '$decrement', totalPoints: '$subtract(points)' });
    });
    it('should map an event property of another name and the event context', () => {
        nodeDefinition.From['TeamRenamed+1'].Properties.should.deep.equal({ title: 'newTitle', renamedAt: '$eventContext(Occurred)' });
    });
    it('should project the node from an event only a property refers to, keyed by the event source id', () => {
        nodeDefinition.From['TeamRenamed+1'].Key.should.equal('$eventSourceId');
        nodeDefinition.From['TeamRenamed+1'].UpdateOnly.should.be.false;
    });
    it('should set constant values', () => {
        nodeDefinition.From['TeamArchived+1'].Properties.should.deep.equal({ archived: '$value(true)', status: '$value(archived)' });
    });
});

describe('when declaring how an event projects a node', () => {
    class Counter { counterId = ''; total = 0; }
    graph('Counters')(Counter);
    node()(Counter);
    graphKey()(Counter.prototype, 'counterId');
    nodeFrom(MemberJoined, { constantKey: 'all', updateOnly: true })(Counter);
    count(MemberJoined)(Counter.prototype, 'total');

    it('should key the node with the constant and only change a node that exists', async () => {
        const result = await discoverGraphs([Counter]);
        result.graphs.registrations[0].projection.Graph!.Nodes.Counter.From['MemberJoined+1'].should.deep.equal({
            Key: '$value(all)', Properties: { total: '$count' }, UpdateOnly: true
        });
    });
});

describe('when mapping the properties of a node with the fluent builder', () => {
    let nodeDefinition: GraphNodeProjectionDefinition;

    beforeAll(async () => {
        class TeamsGraph implements IGraphProjection {
            define(builder: IGraphProjectionBuilder): void {
                builder.node(Team, node => node
                    .from(TeamFormed, from => from.usingKey(event => event.teamId))
                    .from(MemberJoined, from => from
                        .usingKey(event => event.teamId)
                        .increment(team => team.memberCount)
                        .add(team => team.totalPoints).with(event => event.points)
                        .count(team => team.visits))
                    .from(MemberLeft, from => from
                        .decrement(team => team.memberCount)
                        .subtract(team => team.totalPoints).with(event => event.points))
                    .from(TeamRenamed, from => from
                        .set(team => team.title).to(event => event.newTitle)
                        .set(team => team.renamedAt).toEventContextProperty('occurred')
                        .set(team => team.status).toValue('renamed')
                        .set(team => team.archived).toValue(false)
                        .set(team => team.teamId).toEventSourceId()
                        .onlyWhenExisting()));
            }
        }
        graphProjection('FluentTeams')(TeamsGraph);
        const result = await discoverGraphs([], [TeamsGraph]);
        result.graphs.failures.size.should.equal(0);
        nodeDefinition = result.graphs.registrations[0].projection.Graph!.Nodes.Team;
    });

    it('should map by name, add, increment and count', () => {
        nodeDefinition.From['MemberJoined+1'].Properties.should.deep.equal({
            memberCount: '$increment', totalPoints: '$add(points)', visits: '$count'
        });
    });
    it('should subtract and decrement', () => {
        nodeDefinition.From['MemberLeft+1'].Properties.should.deep.equal({ memberCount: '$decrement', totalPoints: '$subtract(points)' });
    });
    it('should set from the event, the event context, a constant and the event source id', () => {
        nodeDefinition.From['TeamRenamed+1'].Properties.should.deep.include({
            title: 'newTitle', renamedAt: '$eventContext(Occurred)', status: '$value(renamed)', archived: '$value(false)', teamId: '$eventSourceId'
        });
    });
    it('should only change a node that exists', () => {
        nodeDefinition.From['TeamRenamed+1'].UpdateOnly.should.be.true;
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { beforeAll, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { count } from '../modelBound/count.js';
import { edge } from '../graphs/edge.js';
import { edgeFrom } from '../graphs/edgeFrom.js';
import { edgeRemovedWith } from '../graphs/edgeRemovedWith.js';
import { edgeSource } from '../graphs/edgeSource.js';
import { edgeTarget } from '../graphs/edgeTarget.js';
import { graph } from '../graphs/graph.js';
import { graphKey } from '../graphs/graphKey.js';
import { graphProjection } from '../graphs/graphProjection.js';
import type { IGraphProjection } from '../graphs/IGraphProjection.js';
import type { IGraphProjectionBuilder } from '../graphs/IGraphProjectionBuilder.js';
import { node } from '../graphs/node.js';
import { nodeFrom } from '../graphs/nodeFrom.js';
import { UnknownGraphEventProperty } from '../graphs/UnknownGraphEventProperty.js';
import { discoverGraphs } from './given/a_discovered_graph.js';

chai.should();

class PlaceVisited { personId = ''; placeId = ''; visitId = ''; }
eventType()(PlaceVisited);
class VisitCancelled { personId = ''; placeId = ''; visitId = ''; }
eventType()(VisitCancelled);
class NoteWritten { personId = ''; placeId = ''; }
eventType()(NoteWritten);

class Visitor { personId = ''; }
graph('Places')(Visitor);
node()(Visitor);
graphKey()(Visitor.prototype, 'personId');
nodeFrom(PlaceVisited, { key: 'personId' })(Visitor);

class Place { placeId = ''; }
graph('Places')(Place);
node()(Place);
graphKey()(Place.prototype, 'placeId');
nodeFrom(PlaceVisited, { key: 'placeId' })(Place);

class Visited {
    personId = '';
    placeId = '';
    visitId = '';
    times = 0;
}
graph('Places')(Visited);
edge('VISITED')(Visited);
edgeSource(Visitor)(Visited.prototype, 'personId');
edgeTarget(Place)(Visited.prototype, 'placeId');
graphKey()(Visited.prototype, 'visitId');
count(PlaceVisited)(Visited.prototype, 'times');
edgeFrom(PlaceVisited, { sourceKey: 'personId', targetKey: 'placeId', identity: 'visitId' })(Visited);
edgeRemovedWith(VisitCancelled, { sourceKey: 'personId', targetKey: 'placeId' })(Visited);

describe('when declaring an edge with an identifying key', () => {
    let result: Awaited<ReturnType<typeof discoverGraphs>>;

    beforeAll(async () => {
        result = await discoverGraphs([Visitor, Place, Visited]);
    });

    it('should annotate the edge with the identifying property', () => {
        JSON.parse(result.graphs.registrations[0].readModel.Schema).properties.VISITED['x-graph-identity'].should.equal('visitId');
    });
    it('should keep the identifying property out of the properties the events map', () => {
        result.graphs.registrations[0].projection.Graph!.Edges.VISITED.From['PlaceVisited+1'].Properties.should.deep.equal({ times: '$count' });
    });
    it('should take the identity from the event property it names', () => {
        result.graphs.registrations[0].projection.Graph!.Edges.VISITED.From['PlaceVisited+1'].Identity.should.equal('visitId');
    });
    it('should take the identity of a removal from the event property of the same name when none is named', () => {
        result.graphs.registrations[0].projection.Graph!.Edges.VISITED.RemovedWith['VisitCancelled+1'].Identity.should.equal('visitId');
    });
});

describe('when an event of an identified edge has no property for the identity', () => {
    it('should fail the graph and name the property', async () => {
        class NoteAuthor { personId = ''; }
        graph('Notes')(NoteAuthor);
        node()(NoteAuthor);
        graphKey()(NoteAuthor.prototype, 'personId');
        class NotePlace { placeId = ''; }
        graph('Notes')(NotePlace);
        node()(NotePlace);
        graphKey()(NotePlace.prototype, 'placeId');
        class Noted { personId = ''; placeId = ''; noteId = ''; }
        graph('Notes')(Noted);
        edge('NOTED')(Noted);
        edgeSource(NoteAuthor)(Noted.prototype, 'personId');
        edgeTarget(NotePlace)(Noted.prototype, 'placeId');
        graphKey()(Noted.prototype, 'noteId');
        edgeFrom(NoteWritten, { sourceKey: 'personId', targetKey: 'placeId' })(Noted);

        const result = await discoverGraphs([NoteAuthor, NotePlace, Noted]);

        result.graphs.registrations.length.should.equal(0);
        [...result.graphs.failures.values()][0].should.be.instanceOf(UnknownGraphEventProperty).and.have.property('message').that.includes('noteId');
    });
});

describe('when identifying an edge with the fluent builder', () => {
    it('should identify it by the property and read the identity from the event property of the same name', async () => {
        class VisitsGraph implements IGraphProjection {
            define(builder: IGraphProjectionBuilder): void {
                builder
                    .node(Visitor, node => node.from(PlaceVisited, from => from.usingKey(event => event.personId)))
                    .node(Place, node => node.from(PlaceVisited, from => from.usingKey(event => event.placeId)))
                    .edge(Visited, Visitor, Place, edge => edge
                        .identifiedBy(visited => visited.visitId)
                        .from(PlaceVisited, from => from.usingSourceKey(event => event.personId).usingTargetKey(event => event.placeId)));
            }
        }
        graphProjection('Visits')(VisitsGraph);
        const result = await discoverGraphs([], [VisitsGraph]);
        result.graphs.failures.size.should.equal(0);
        result.graphs.registrations[0].projection.Graph!.Edges.VISITED.From['PlaceVisited+1'].Identity.should.equal('visitId');
    });

    it('should fail when the event has no property to identify the edge with', async () => {
        class NotesGraph implements IGraphProjection {
            define(builder: IGraphProjectionBuilder): void {
                builder
                    .node(Visitor, node => node.from(NoteWritten, from => from.usingKey(event => event.personId)))
                    .node(Place, node => node.from(NoteWritten, from => from.usingKey(event => event.placeId)))
                    .edge(Visited, Visitor, Place, edge => edge
                        .from(NoteWritten, from => from.usingSourceKey(event => event.personId).usingTargetKey(event => event.placeId)));
            }
        }
        graphProjection('Notes')(NotesGraph);
        const result = await discoverGraphs([], [NotesGraph]);
        result.graphs.failures.get(NotesGraph)!.should.be.instanceOf(UnknownGraphEventProperty);
    });
});

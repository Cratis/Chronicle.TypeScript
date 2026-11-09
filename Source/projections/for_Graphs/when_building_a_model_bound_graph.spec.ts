// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { beforeAll, chai, describe, it } from 'vitest';
import { ReadModelObserverType } from '@cratis/chronicle.contracts';
import { discoverGraphs } from './given/a_discovered_graph.js';
import { Group, MemberOf, Person } from './given/organization.js';

chai.should();

describe('when building a graph from decorated nodes and edges', () => {
    let result: Awaited<ReturnType<typeof discoverGraphs>>;
    let schema: Record<string, any>;

    beforeAll(async () => {
        result = await discoverGraphs([Person, Group, MemberOf]);
        schema = JSON.parse(result.graphs.registrations[0].readModel.Schema);
    });

    it('should not fail', () => result.graphs.failures.size.should.equal(0));
    it('should register one graph named by the decorators', () => {
        result.graphs.registrations.map(_ => _.graphName).should.deep.equal(['Organization']);
    });
    it('should store the graph in the graph sink as a read model of the projection', () => {
        const readModel = result.graphs.registrations[0].readModel;
        readModel.Type.Identifier.should.equal('Organization');
        readModel.Sink.TypeId.should.equal('Neo4j');
        readModel.ObserverType.should.equal(ReadModelObserverType.Projection);
        readModel.ObserverIdentifier.should.equal('Organization');
    });
    it('should mark the schema root as a graph', () => {
        schema['x-graph'].should.be.true;
        schema.title.should.equal('Organization');
    });
    it('should annotate a node with its kind and key and describe its properties', () => {
        schema.properties.Person.should.deep.equal({
            type: 'object',
            properties: { personId: { type: 'string' }, name: { type: 'string' } },
            'x-graph-kind': 'Node',
            'x-graph-key': 'personId'
        });
    });
    it('should annotate an edge with its kind, end nodes and leave the keys of the end nodes out of its properties', () => {
        schema.properties.MEMBER_OF.should.deep.equal({
            type: 'object',
            properties: { since: { type: 'string', format: 'date-time' } },
            'x-graph-kind': 'Edge',
            'x-graph-source': 'Person',
            'x-graph-target': 'Group'
        });
    });
    it('should project the graph from the event log, rewindable, with an empty read model state', () => {
        const projection = result.graphs.registrations[0].projection;
        projection.EventSequenceId.should.equal('event-log');
        projection.Identifier.should.equal('Organization');
        projection.ReadModel.should.equal('Organization');
        projection.IsActive.should.be.true;
        projection.IsRewindable.should.be.true;
        projection.InitialModelState.should.equal('{}');
    });
    it('should map a node from an event keyed by the event type id and generation', () => {
        result.graphs.registrations[0].projection.Graph!.Nodes.Person.should.deep.equal({
            From: { 'PersonRegistered+1': { Key: 'personId', Properties: { name: 'name' }, UpdateOnly: false } },
            RemovedWith: { 'PersonRemoved+1': { Key: 'personId', Detach: true } }
        });
    });
    it('should map the properties of a node by name and leave out the key', () => {
        result.graphs.registrations[0].projection.Graph!.Nodes.Group.From['GroupCreated+1'].Properties.should.deep.equal({ name: 'name' });
    });
    it('should map an edge from the events that create and remove it', () => {
        result.graphs.registrations[0].projection.Graph!.Edges.MEMBER_OF.should.deep.equal({
            From: {
                'MemberAdded+1': {
                    SourceKey: 'personId',
                    TargetKey: 'groupId',
                    Identity: '',
                    Properties: { since: '$eventContext(Occurred)' }
                }
            },
            RemovedWith: { 'MemberRemoved+1': { SourceKey: 'personId', TargetKey: 'groupId', Identity: '' } }
        });
    });
});

describe('when building a graph for a sink type', () => {
    it('should use the sink type', async () => {
        const result = await discoverGraphs([Person, Group, MemberOf], [], 'InMemoryGraph');
        result.graphs.registrations[0].readModel.Sink.TypeId.should.equal('InMemoryGraph');
    });
});

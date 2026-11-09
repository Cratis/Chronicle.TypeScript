// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, type Assertion } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { edge } from '../graphs/edge.js';
import { edgeFrom } from '../graphs/edgeFrom.js';
import { edgeRemovedWith } from '../graphs/edgeRemovedWith.js';
import { edgeSource } from '../graphs/edgeSource.js';
import { edgeTarget } from '../graphs/edgeTarget.js';
import { graph } from '../graphs/graph.js';
import { graphKey } from '../graphs/graphKey.js';
import { node } from '../graphs/node.js';
import { nodeFrom } from '../graphs/nodeFrom.js';
import { nodeRemovedWith } from '../graphs/nodeRemovedWith.js';
import { count } from '../modelBound/count.js';
import { setFromContext } from '../modelBound/setFromContext.js';
import { discoverGraphs } from './given/a_discovered_graph.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

@eventType()
class AuthorJoined {
    @field(String) authorId = '';
    @field(String) name = '';
}

@eventType()
class AuthorLeft {
    @field(String) authorId = '';
}

@eventType()
class BookWritten {
    @field(String) authorId = '';
    @field(String) bookId = '';
}

@graph('Library')
@node()
@nodeFrom(AuthorJoined, { key: 'authorId' })
@nodeRemovedWith(AuthorLeft, { key: 'authorId', detach: true })
class Author {
    @graphKey() @field(String) authorId = '';
    @field(String) name = '';
}

@graph('Library')
@node()
@nodeFrom(BookWritten, { key: 'bookId' })
class Book {
    @graphKey() @field(String) bookId = '';
    @count(BookWritten) @field(Number) editions = 0;
}

@graph('Library')
@edge('WROTE')
@edgeFrom(BookWritten, { sourceKey: 'authorId', targetKey: 'bookId' })
@edgeRemovedWith(AuthorLeft, { sourceKey: 'authorId', targetKey: 'authorId' })
class Wrote {
    @edgeSource(Author) @field(String) authorId = '';
    @edgeTarget(Book) @field(String) bookId = '';
    @setFromContext(BookWritten, 'occurred') @field(Date) writtenAt = new Date();
}

describe('when declaring a graph with standard decorators', () => {
    it('should build the same graph as with legacy decorators', async () => {
        const result = await discoverGraphs([Author, Book, Wrote]);
        should(result.graphs.failures.size).equal(0);
        const registration = result.graphs.registrations[0];
        should(registration.graphName).equal('Library');
        should(JSON.parse(registration.readModel.Schema).properties.WROTE).deep.equal({
            type: 'object',
            properties: { writtenAt: { type: 'string', format: 'date-time' } },
            'x-graph-kind': 'Edge',
            'x-graph-source': 'Author',
            'x-graph-target': 'Book'
        });
        should(registration.projection.Graph!.Nodes.Author).deep.equal({
            From: { 'AuthorJoined+1': { Key: 'authorId', Properties: { name: 'name' }, UpdateOnly: false } },
            RemovedWith: { 'AuthorLeft+1': { Key: 'authorId', Detach: true } }
        });
        should(registration.projection.Graph!.Nodes.Book.From['BookWritten+1']).deep.equal({
            Key: 'bookId', Properties: { editions: '$count' }, UpdateOnly: false
        });
        should(registration.projection.Graph!.Edges.WROTE.From['BookWritten+1']).deep.equal({
            SourceKey: 'authorId', TargetKey: 'bookId', Identity: '', Properties: { writtenAt: '$eventContext(Occurred)' }
        });
    });
});

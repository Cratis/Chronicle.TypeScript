// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConcurrencyDimensions, eventSource, eventStream, EventSources } from '../index.js';
import { DuplicateEventSourceName } from '../DuplicateEventSourceName.js';
import { DuplicateEventStreamName } from '../DuplicateEventStreamName.js';
import { UnknownEventSource } from '../UnknownEventSource.js';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';

const should = chai.should();

@eventSource({ description: 'An account', concurrency: ConcurrencyDimensions.eventSourceId })
@eventStream('Transactions', { description: 'Money moves', concurrency: ConcurrencyDimensions.eventSourceId | ConcurrencyDimensions.eventStreamType })
@eventStream('Statements')
class AccountEventSource {}

@eventSource({ name: 'Same' }) class First {}
@eventSource({ name: 'Same' }) class Second {}
@eventSource({ name: 'Dup' })
@eventStream('S') @eventStream('S')
class DuplicateStreams {}

function artifacts(...types: Constructor[]): IClientArtifactsProvider {
    return { eventSources: types } as unknown as IClientArtifactsProvider;
}

function create(...types: Constructor[]) {
    const registerEventSources = vi.fn().mockResolvedValue({ IsSuccess: true, ValidationResults: [], ExceptionMessages: [] });
    const connection = { eventSources: { registerEventSources } } as unknown as ChronicleConnection;
    return { sources: new EventSources('store', connection, artifacts(...types)), registerEventSources };
}

describe('when discovering a decorated event source', () => {
    let sources: EventSources;
    beforeEach(async () => {
        ({ sources } = create(AccountEventSource));
        await sources.discover();
    });
    it('should default the name by trimming the EventSource suffix', () => sources.all[0].name.should.equal('Account'));
    it('should keep description and concurrency', () => {
        sources.all[0].description.should.equal('An account');
        sources.all[0].concurrency.should.equal(ConcurrencyDimensions.eventSourceId);
    });
    it('should keep streams in declaration order with their own dimensions', () => {
        sources.all[0].streams.map(_ => _.name).should.deep.equal(['Transactions', 'Statements']);
        sources.all[0].streams[0].concurrency.should.equal(5);
        sources.all[0].streams[1].concurrency.should.equal(0);
    });
    it('should resolve by class and by name', () => {
        sources.getFor(AccountEventSource).should.equal(sources.getFor('Account'));
    });
    it('should reject an unknown source', () => {
        (() => sources.getFor('Nope')).should.throw(UnknownEventSource);
    });
});

describe('when discovering duplicate names', () => {
    it('should reject duplicate source names', async () => {
        const { sources } = create(First, Second);
        let error: unknown;
        await sources.discover().catch(e => error = e);
        (error as Error).should.be.instanceOf(DuplicateEventSourceName);
    });
    it('should reject duplicate stream names', async () => {
        const { sources } = create(DuplicateStreams);
        let error: unknown;
        await sources.discover().catch(e => error = e);
        (error as Error).should.be.instanceOf(DuplicateEventStreamName);
    });
});

describe('when registering', () => {
    it('should send the definitions with client ownership and wire dimension flags', async () => {
        const { sources, registerEventSources } = create(AccountEventSource);
        await sources.discover();
        await sources.register();
        const request = registerEventSources.mock.calls[0][0];
        request.EventStore.should.equal('store');
        request.Sources.should.have.length(1);
        request.Sources[0].Name.should.equal('Account');
        request.Sources[0].Owner.should.equal(1);
        request.Sources[0].Concurrency.should.equal(1);
        request.Sources[0].Streams[0].should.deep.equal({ Name: 'Transactions', Description: 'Money moves', Concurrency: 5 });
    });
    it('should not call the kernel when there are no definitions', async () => {
        const { sources, registerEventSources } = create();
        await sources.discover();
        await sources.register();
        should.equal(registerEventSources.mock.calls.length, 0);
    });
});

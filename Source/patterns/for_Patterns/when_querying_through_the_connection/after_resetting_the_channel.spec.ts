// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { createServer, type ServiceImplementation } from 'nice-grpc';
import { ConnectionServiceDefinition, PatternsDefinition, type UsualActionsRequest } from '@cratis/chronicle.contracts';
import { EventStore } from '../../../EventStore.js';
import { EventStoreName } from '../../../EventStoreName.js';
import { EventStoreNamespaceName } from '../../../EventStoreNamespaceName.js';
import { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import { DayOfWeek, TimeBucket, type BehaviorPattern } from '../../index.js';

chai.should();

describe('when querying patterns through an event store after resetting its connection', () => {
    let server: ReturnType<typeof createServer>;
    let connection: ChronicleConnection;
    let eventStore: EventStore;
    let request: UsualActionsRequest;
    let apiKey: string | undefined;
    let result: BehaviorPattern[];
    beforeEach(async () => {
        server = createServer();
        const unused = async () => { throw new Error('Unexpected RPC'); };
        server.add(ConnectionServiceDefinition, {
            ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unused])),
            checkCompatibility: async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' })
        } as ServiceImplementation<typeof ConnectionServiceDefinition>);
        server.add(PatternsDefinition, {
            allPatterns: unused, allPatternScopes: unused, matchingPatterns: unused, patternsForScope: unused,
            usualActions: async (received, context) => {
                request = received;
                apiKey = context.metadata.get('api-key');
                return { IsAuthorized: true, Data: [{ Id: 'pattern-1', Occurrences: 9_007_199_254_740_993n }] };
            }
        });
        const port = await server.listen('127.0.0.1:0');
        connection = new ChronicleConnection({ connectionString: `chronicle://127.0.0.1:${port}?disableTls=true&apiKey=patterns-test` });
        await connection.connect();
        eventStore = new EventStore(new EventStoreName('accounts'), new EventStoreNamespaceName('tenant-a'), connection, new ConnectionLifecycle(), 'sink');
        await connection.resetChannel();
        result = await eventStore.patterns.getPatternsAt('user-42', { instant: new Date('2026-01-05T00:30:00Z'), offsetMinutes: -240 });
    });
    afterEach(async () => {
        eventStore?.disposeObservations();
        connection?.dispose();
        await server?.shutdown();
    });
    it('should send the offset-derived context to the generated usual actions service', () => {
        request.should.deep.equal({
            EventStore: 'accounts', Namespace: 'tenant-a', GroupingKey: 'user-42',
            Context: { Day: DayOfWeek.Sunday, TimeBucket: TimeBucket.Evening }, MinimumConfidence: 0, MaximumResults: 0
        });
    });
    it('should use the connection authentication middleware', () => apiKey!.should.equal('patterns-test'));
    it('should preserve occurrence precision across the actual wire codec', () => result[0].occurrences.should.equal(9_007_199_254_740_993n));
});

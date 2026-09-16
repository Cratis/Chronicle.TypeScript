// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { createServer, ServerError, Status, type ServiceImplementation } from 'nice-grpc';
import { chronicleDescriptorSet, ConnectionServiceDefinition, EventSequencesDefinition, type CompatibilityRequest } from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../../ChronicleConnection';

chai.should();

describe('when checking server compatibility before append', () => {
    let server: ReturnType<typeof createServer>;
    let connection: ChronicleConnection;
    let compatible: boolean;
    let check: ReturnType<typeof vi.fn>;
    let append: ReturnType<typeof vi.fn>;
    let appendMany: ReturnType<typeof vi.fn>;
    beforeEach(async () => {
        compatible = true;
        server = createServer();
        check = vi.fn(async (_request: CompatibilityRequest) => ({
            IsCompatible: compatible, Incompatibilities: compatible ? [] : ['missing field'], ServerVersion: 'server'
        }));
        append = vi.fn(async () => ({ Response: { SequenceNumber: 0n } }));
        appendMany = vi.fn(async () => ({ Response: { SequenceNumbers: [0n] } }));
        const unsupported = async () => { throw new ServerError(Status.UNIMPLEMENTED, 'Unexpected RPC in specification'); };
        const connectionMethods = Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unsupported]));
        const eventSequenceMethods = Object.fromEntries(Object.keys(EventSequencesDefinition.methods).map(name => [name, unsupported]));
        server.add(ConnectionServiceDefinition, { ...connectionMethods, checkCompatibility: check } as ServiceImplementation<typeof ConnectionServiceDefinition>);
        server.add(EventSequencesDefinition, { ...eventSequenceMethods, append, appendManyForEventSources: appendMany } as ServiceImplementation<typeof EventSequencesDefinition>);
        const port = await server.listen('127.0.0.1:0');
        connection = new ChronicleConnection({ connectionString: `chronicle://127.0.0.1:${port}/?disableTls=true&apiKey=test-key` });
    });
    afterEach(async () => {
        connection?.dispose();
        await server.shutdown();
    });
    it('should send the installed descriptor and share one check across concurrent writes', async () => {
        await connection.connect();
        await Promise.all([connection.eventSequences.append({}), connection.eventSequences.appendManyForEventSources({})]);
        check.mock.calls.should.have.lengthOf(1);
        check.mock.calls[0][0].DescriptorSet.should.deep.equal(Buffer.from(chronicleDescriptorSet));
        check.mock.calls[0][0].ProtocolVersion.should.equal('18.2.0');
        append.mock.calls.should.have.lengthOf(1);
        appendMany.mock.calls.should.have.lengthOf(1);
    });
    it('should reject both append paths before writing even without connect', async () => {
        compatible = false;
        await connection.resetChannel();
        const results = await Promise.allSettled([connection.eventSequences.append({}), connection.eventSequences.appendManyForEventSources({})]);
        results.map(result => result.status).should.deep.equal(['rejected', 'rejected']);
        check.mock.calls.should.have.lengthOf(1);
        append.mock.calls.should.have.lengthOf(0);
        appendMany.mock.calls.should.have.lengthOf(0);
        connection.isConnected.should.equal(false);
    });
    it('should reject an unavailable compatibility endpoint without trying the append', async () => {
        check.mockRejectedValue(new ServerError(Status.UNAVAILABLE, 'compatibility endpoint unavailable'));
        await connection.resetChannel();
        const results = await Promise.allSettled([connection.eventSequences.append({})]);
        results[0].status.should.equal('rejected');
        append.mock.calls.should.have.lengthOf(0);
    });
    it('should recheck after reconnect and refuse a newly incompatible channel', async () => {
        await connection.connect();
        compatible = false;
        const results = await Promise.allSettled([connection.reconnect()]);
        results[0].status.should.equal('rejected');
        check.mock.calls.should.have.lengthOf(2);
        connection.isConnected.should.equal(false);
        append.mock.calls.should.have.lengthOf(0);
    });
});

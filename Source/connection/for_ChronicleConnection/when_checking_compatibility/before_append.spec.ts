// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createRequire } from 'node:module';
import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { createServer, ServerError, Status, type CallContext, type ServiceImplementation } from 'nice-grpc';
import { chronicleDescriptorSet, ConnectionServiceDefinition, EventSequencesDefinition, type CompatibilityRequest } from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../../ChronicleConnection';
import { ChronicleClient } from '../../../ChronicleClient';
import { ChronicleOptions } from '../../../ChronicleOptions';
import { IncompatibleChronicleServer } from '../../IncompatibleChronicleServer';

chai.should();
const installedContractsVersion = (createRequire(import.meta.url)('@cratis/chronicle.contracts/package.json') as { version: string }).version;

describe('when checking server compatibility before append', () => {
    let server: ReturnType<typeof createServer>;
    let connection: ChronicleConnection;
    let compatible: boolean;
    let address: string;
    let check: ReturnType<typeof vi.fn>;
    let append: ReturnType<typeof vi.fn>;
    let appendMany: ReturnType<typeof vi.fn>;
    beforeEach(async () => {
        compatible = true;
        server = createServer();
        check = vi.fn(async (_request: CompatibilityRequest, _context: CallContext) => ({
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
        address = `chronicle://127.0.0.1:${port}/?disableTls=true&apiKey=test-key`;
        connection = new ChronicleConnection({ connectionString: address });
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
        check.mock.calls[0][0].ProtocolVersion.should.equal(installedContractsVersion);
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
    it('should retry a transient failed check before allowing a later write', async () => {
        check.mockRejectedValueOnce(new ServerError(Status.UNAVAILABLE, 'temporarily unavailable'));
        await connection.resetChannel();
        const failed = await Promise.allSettled([connection.eventSequences.append({})]);
        failed[0].status.should.equal('rejected');
        append.mock.calls.should.have.lengthOf(0);
        await connection.eventSequences.append({});
        check.mock.calls.should.have.lengthOf(2);
        append.mock.calls.should.have.lengthOf(1);
    });
    it('should fail a high-level client connection instead of retrying an incompatible server forever', async () => {
        compatible = false;
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(address, { discoveryPatterns: [] }));
        try {
            const results = await Promise.allSettled([client.getEventStore('store')]);
            results[0].status.should.equal('rejected');
            if (results[0].status === 'rejected') results[0].reason.should.be.instanceOf(IncompatibleChronicleServer);
            check.mock.calls.should.have.lengthOf(1);
            append.mock.calls.should.have.lengthOf(0);
        } finally {
            client.dispose();
        }
    });
    it('should reject a missing compatibility RPC permanently rather than reconnect forever', async () => {
        check.mockRejectedValue(new ServerError(Status.UNIMPLEMENTED, 'compatibility not supported'));
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(address, { discoveryPatterns: [] }));
        try {
            const results = await Promise.allSettled([client.getEventStore('store')]);
            results[0].status.should.equal('rejected');
            if (results[0].status === 'rejected') results[0].reason.should.be.instanceOf(IncompatibleChronicleServer);
            check.mock.calls.should.have.lengthOf(1);
            append.mock.calls.should.have.lengthOf(0);
        } finally {
            client.dispose();
        }
    });
    it('should retain an incompatible verdict until the channel is replaced', async () => {
        compatible = false;
        await connection.resetChannel();
        await Promise.allSettled([connection.eventSequences.append({})]);
        const results = await Promise.allSettled([connection.eventSequences.append({})]);
        results[0].status.should.equal('rejected');
        check.mock.calls.should.have.lengthOf(1);
        append.mock.calls.should.have.lengthOf(0);
        compatible = true;
        await connection.reconnect();
        await connection.eventSequences.append({});
        check.mock.calls.should.have.lengthOf(2);
        append.mock.calls.should.have.lengthOf(1);
    });
    it('should bound a stalled compatibility check without allowing writes', async () => {
        check.mockImplementation((_request, context) => new Promise((_resolve, reject) => {
            context.signal.addEventListener('abort', () => reject(new ServerError(Status.CANCELLED, 'cancelled')), { once: true });
        }));
        connection.dispose();
        connection = new ChronicleConnection({ connectionString: address, connectTimeout: 50 });
        const results = await Promise.allSettled([connection.connect()]);
        results[0].status.should.equal('rejected');
        connection.isConnected.should.be.false;
        append.mock.calls.should.have.lengthOf(0);
    });
    it('should reject a contradictory compatibility verdict', async () => {
        check.mockResolvedValue({ IsCompatible: true, Incompatibilities: ['missing field'], ServerVersion: 'server' });
        await connection.resetChannel();
        const failed = await Promise.allSettled([connection.eventSequences.append({})]);
        failed[0].status.should.equal('rejected');
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

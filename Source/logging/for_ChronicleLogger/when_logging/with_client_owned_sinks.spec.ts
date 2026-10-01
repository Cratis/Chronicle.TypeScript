// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { diag, DiagLogLevel } from '@opentelemetry/api';
import { ClientError, Status } from 'nice-grpc-common';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import { createLogger } from '../../createLogger.js';
import type { ChronicleLogEntry } from '../../ChronicleLogEntry.js';
import { telemetrySession } from '../../../telemetry/for_ChronicleTelemetry/given/a_telemetry_session.fixture.js';
import { CorrelationId, correlationIdManager } from '../../../correlation/index.js';

vi.mock('../../../connection/ChronicleConnection.js', () => ({ ChronicleConnection: class { disconnect() {} } }));
chai.should();
const telemetry = telemetrySession();

describe('when two clients have different diagnostic sinks', () => {
    const first: ChronicleLogEntry[] = [];
    const second: ChronicleLogEntry[] = [];
    beforeEach(() => {
        first.length = 0;
        second.length = 0;
        const one = new ChronicleClient(ChronicleOptions.development({ discoveryPatterns: [], logger: { log: entry => first.push(entry) } }));
        const two = new ChronicleClient(ChronicleOptions.development({ discoveryPatterns: [], logger: { log: entry => second.push(entry) } }));
        one.dispose();
        two.dispose();
    });
    it('should route each diagnostic only to its owning sink', () => {
        first.should.have.lengthOf(2);
        second.should.have.lengthOf(2);
        (first[0] === second[0]).should.be.false;
    });
});

describe('when logging in a correlated trace', () => {
    let entry: ChronicleLogEntry;
    beforeEach(async () => {
        const logger = createLogger('test', { log: value => { entry = value; } });
        await correlationIdManager.run(new CorrelationId('business-id'), () => telemetry.traces.getTracer('host').startActiveSpan('operation', async span => {
            try { logger.error('Operation failed', { error: new TypeError('secret'), sequenceNumber: 9007199254740992n }); }
            finally { span.end(); }
        }));
    });
    it('should export error types with business and trace identifiers but no exception details', () => {
        entry.attributes.should.include({ 'error.type': 'TypeError', 'exception.type': 'TypeError', 'cratis.correlation_id': 'business-id' });
        entry.attributes.should.have.property('trace_id');
        entry.attributes.should.have.property('span_id');
        entry.attributes.should.not.have.property('cratis.event_sequence.number');
        JSON.stringify(entry).should.not.contain('secret');
    });
});

for (const error of [new ClientError('/test', Status.UNAVAILABLE, 'secret'), { code: Status.UNAVAILABLE, message: 'secret' }]) {
    describe('when logging a gRPC failure', () => {
        let entry: ChronicleLogEntry;
        beforeEach(() => {
            createLogger('test', { log: value => { entry = value; } }).error('Operation failed', { error });
        });
        it('should retain the numeric status without exporting sensitive exception details', () => {
            entry.attributes.should.include({ 'rpc.grpc.status_code': Status.UNAVAILABLE });
            JSON.stringify(entry).should.not.contain('secret');
        });
    });
}

describe('when no logger is configured during the compatibility period', () => {
    it('should still deliver sanitized diagnostics to diag', () => {
        const error = vi.fn();
        diag.setLogger({ error, warn: vi.fn(), info: vi.fn(), debug: vi.fn(), verbose: vi.fn() }, DiagLogLevel.ERROR);
        try {
            createLogger('test').error('Operation failed', { error: new Error('secret') });
            error.mock.calls.should.have.lengthOf(1);
            JSON.stringify(error.mock.calls).should.not.contain('secret');
        } finally { diag.disable(); }
    });
});

describe('when a diagnostic sink throws', () => {
    it('should leave the operation unaffected', () => {
        (() => createLogger('test', { log: () => { throw new Error('sink failed'); } }).info('Diagnostic')).should.not.throw();
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { ChronicleClient, ChronicleOptions } from '../../index.js';
import { an_event_store } from './given/an_event_store.js';

chai.should();

describe('when artifact registration runs again', () => {
    let context: ReturnType<typeof an_event_store>;
    let client: ChronicleClient;
    beforeEach(() => {
        context = an_event_store();
        client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
    });
    afterEach(() => {
        context.store.disposeObservations();
        client.dispose();
    });

    it('should identify reconnect attempts and replace stale failures without mutating retained snapshots', async () => {
        context.registerProjection.mockRejectedValueOnce(new Error('Invalid declaration'));
        await client['registerArtifactsForStore'](context.store, 'new-store').catch(() => undefined);
        const previous = context.publicStore.registrationResult!;
        await client['registerArtifactsForStore'](context.store, 'session-lost');
        const current = context.publicStore.registrationResult!;
        current.attemptId.should.equal(previous.attemptId + 1);
        current.reason.should.equal('session-lost');
        current.state.should.equal('successful');
        current.failures.should.deep.equal([]);
        previous.state.should.equal('failed');
        previous.reason.should.equal('new-store');
        previous.failures.should.have.lengthOf(1);
    });

    it('should expose in-progress without claiming a pending declaration succeeded', async () => {
        let finish!: (response: {}) => void;
        let started!: () => void;
        const pending = new Promise<void>(resolve => { started = resolve; });
        context.registerProjection.mockImplementationOnce(() => {
            started();
            return new Promise(resolve => { finish = resolve; });
        });
        const registration = context.store.registerArtifacts();
        await pending;
        const snapshot = context.publicStore.registrationResult!;
        snapshot.state.should.equal('in-progress');
        snapshot.projections.map(outcome => outcome.state).should.deep.equal(['not-run', 'not-run', 'not-run']);
        finish({});
        await registration;
        snapshot.state.should.equal('in-progress');
        context.publicStore.registrationResult!.state.should.equal('successful');
    });

    it('should not let a late failure from a previous attempt overwrite the current attempt', async () => {
        let fail!: (error: Error) => void;
        let started!: () => void;
        const pending = new Promise<void>(resolve => { started = resolve; });
        context.registerProjection.mockImplementationOnce(() => {
            started();
            return new Promise((_resolve, reject) => { fail = reject; });
        });
        const previous = context.store.registerArtifacts('previous').catch(error => error);
        await pending;
        await context.store.registerArtifacts('replacement');
        fail(new Error('Late failure'));
        await previous;
        const current = context.publicStore.registrationResult!;
        current.attemptId.should.equal(2);
        current.reason.should.equal('replacement');
        current.state.should.equal('successful');
        current.failures.should.deep.equal([]);
    });
});

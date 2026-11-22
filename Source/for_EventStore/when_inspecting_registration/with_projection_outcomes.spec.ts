// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { ArtifactRegistrationResult, IEventStore } from '../../index.js';
import { an_event_store } from './given/an_event_store.js';

chai.should();

describe('when inspecting event store registration through the public API', () => {
    let context: ReturnType<typeof an_event_store>;
    const result = (): ArtifactRegistrationResult => context.publicStore.registrationResult!;

    beforeEach(() => { context = an_event_store(); });
    afterEach(() => { context.store.disposeObservations(); });

    it('should allow legacy and in-process event stores to omit registration reporting', () => {
        const legacy = {} as Omit<IEventStore, 'registrationResult'>;
        const store: IEventStore = legacy;
        (store.registrationResult === undefined).should.be.true;
    });

    it('should keep observer liveness unknown even after reactor and reducer streams open', async () => {
        context = an_event_store(true);
        await context.store.registerArtifacts();
        context.observe.mock.calls.should.have.lengthOf(2);
        result().state.should.equal('successful');
        result().observerLiveness.should.equal('unknown');
    });

    it('should report not-run before the first registration attempt', () => {
        result().state.should.equal('not-run');
        result().attemptId.should.equal(0);
        result().projections.should.deep.equal([]);
    });

    it('should expose successful declarations and their actual kernel responses without claiming observer liveness', async () => {
        const response = {};
        context.registerProjection.mockResolvedValue(response);
        await context.store.registerArtifacts();
        result().state.should.equal('successful');
        result().projections.should.have.lengthOf(3);
        result().projections.forEach(outcome => {
            outcome.state.should.equal('successful');
            if (outcome.state === 'successful') outcome.response.should.equal(response);
        });
        result().failures.should.deep.equal([]);
        result().observerLiveness.should.equal('unknown');
    });

    it('should retain successful and failed declarations while preserving fail-fast registration', async () => {
        const failure = Object.assign(new Error('Invalid declaration'), { code: 3, details: ['diagnostic'] });
        context.registerProjection.mockResolvedValueOnce({}).mockRejectedValueOnce(failure);
        const thrown = await context.store.registerArtifacts().catch(error => error);
        thrown.message.should.equal("Failed to register projection 'second' after 1 attempt(s): Error: Invalid declaration");
        result().state.should.equal('partially-failed');
        result().error!.should.equal(thrown);
        result().projections.map(outcome => outcome.state).should.deep.equal(['successful', 'failed', 'not-run']);
        result().failures[0].identifier.should.equal('second');
        result().failures[0].error!.should.equal(failure);
        context.registerProjection.mock.calls.should.have.lengthOf(2);
    });

    it('should report failed when no projection registration succeeds', async () => {
        context.registerProjection.mockRejectedValue(new Error('Invalid declaration'));
        await context.store.registerArtifacts().catch(() => undefined);
        result().state.should.equal('failed');
        result().projections.map(outcome => outcome.state).should.deep.equal(['failed', 'not-run', 'not-run']);
        result().failures.should.have.lengthOf(1);
    });

    it('should capture an orchestration failure even before projection registration', async () => {
        const failure = new Error('Discovery failed');
        context.store.eventTypes.discover = async () => { throw failure; };
        const thrown = await context.store.registerArtifacts().catch(error => error);
        thrown.should.equal(failure);
        result().state.should.equal('failed');
        result().error!.should.equal(failure);
    });
});

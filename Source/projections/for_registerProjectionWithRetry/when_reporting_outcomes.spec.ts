// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import type { ProjectionRegistrationOutcome } from '../../ArtifactRegistrationResult.js';
import type { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { createLogger } from '../../logging/createLogger.js';
import { registerProjectionWithRetry } from '../registerProjectionWithRetry.js';

chai.should();

describe('when reporting projection registration outcomes', () => {
    let register: ReturnType<typeof vi.fn>;
    let record: ReturnType<typeof vi.fn<(outcome: ProjectionRegistrationOutcome) => void>>;
    let connection: ChronicleConnection;
    const projection = { Identifier: 'projection' } as ProjectionDefinition;
    const logger = createLogger('registration-spec');
    const run = (maxAttempts?: number) => registerProjectionWithRetry(connection, 'store', logger, projection, 'projection', maxAttempts, record);

    beforeEach(() => {
        vi.useFakeTimers();
        register = vi.fn().mockResolvedValue({});
        record = vi.fn();
        connection = { projections: { register } } as unknown as ChronicleConnection;
    });
    afterEach(() => { vi.useRealTimers(); });

    it('should retain the actual response only after a transient failure recovers', async () => {
        const response = {};
        register.mockRejectedValueOnce(new Error('UNAVAILABLE')).mockResolvedValueOnce(response);
        const registration = run();
        await vi.advanceTimersByTimeAsync(1999);
        register.mock.calls.should.have.lengthOf(1);
        record.mock.calls.should.have.lengthOf(0);
        await vi.advanceTimersByTimeAsync(1);
        (await registration)!.should.equal(response);
        record.mock.calls.should.deep.equal([[{ identifier: 'projection', state: 'successful', response }]]);
    });

    it('should preserve all five attempts and the growing delays before reporting the underlying failure', async () => {
        const failure = Object.assign(new Error('UNAVAILABLE'), { code: 14 });
        register.mockRejectedValue(failure);
        const registration = run().catch(error => error);
        for (const delay of [2000, 4000, 8000, 15000]) {
            await vi.advanceTimersByTimeAsync(delay - 1);
            record.mock.calls.should.have.lengthOf(0);
            await vi.advanceTimersByTimeAsync(1);
        }
        const thrown = await registration;
        thrown.message.should.equal("Failed to register projection 'projection' after 5 attempt(s): Error: UNAVAILABLE");
        register.mock.calls.should.have.lengthOf(5);
        record.mock.calls.should.deep.equal([[{ identifier: 'projection', state: 'failed', error: failure }]]);
    });

    it('should preserve immediate non-transient rejection without retrying', async () => {
        const failure = new Error('Invalid declaration');
        register.mockRejectedValue(failure);
        const thrown = await run().catch(error => error);
        thrown.message.should.equal("Failed to register projection 'projection' after 1 attempt(s): Error: Invalid declaration");
        register.mock.calls.should.have.lengthOf(1);
        record.mock.calls.should.deep.equal([[{ identifier: 'projection', state: 'failed', error: failure }]]);
    });

    it('should retain the no-attempt behavior without inventing an acknowledgment', async () => {
        const response = await run(0);
        (response === undefined).should.be.true;
        register.mock.calls.should.have.lengthOf(0);
        record.mock.calls.should.have.lengthOf(0);
    });
});

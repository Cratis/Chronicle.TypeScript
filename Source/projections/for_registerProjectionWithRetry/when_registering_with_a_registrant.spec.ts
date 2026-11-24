// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { RegistrationState, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metadata } from 'nice-grpc-common';
import type { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { createLogger } from '../../logging/createLogger.js';
import { ProjectionRegistrationNotApplied } from '../ProjectionRegistrationNotApplied.js';
import { registerProjectionWithRetry } from '../registerProjectionWithRetry.js';

describe('when registering a projection with a registrant', () => {
    let register: ReturnType<typeof vi.fn>;
    let getRegistrationStatus: ReturnType<typeof vi.fn>;
    let connection: ChronicleConnection;
    const projection = { Identifier: 'projection' } as ProjectionDefinition;
    const run = () => registerProjectionWithRetry(connection, 'store', createLogger('registration-spec'), projection, 'projection', undefined, undefined, 'the-app');
    const status = (State: RegistrationState, Failure = '') => ({ State, Revision: 1n, AppliedRevision: 1n, Failure });

    beforeEach(() => {
        vi.useFakeTimers();
        register = vi.fn().mockResolvedValue({});
        getRegistrationStatus = vi.fn();
        connection = { projections: { register, getRegistrationStatus } } as unknown as ChronicleConnection;
    });
    afterEach(() => { vi.useRealTimers(); });

    describe('and the kernel applies it in the background', () => {
        it('should send the registrant and poll the registration status until it is no longer pending', async () => {
            getRegistrationStatus
                .mockResolvedValueOnce(status(RegistrationState.Pending))
                .mockResolvedValueOnce(status(RegistrationState.Pending))
                .mockResolvedValueOnce(status(RegistrationState.Applied));
            const registration = run();
            await vi.advanceTimersByTimeAsync(10_000);
            await registration;
            expect(register.mock.calls[0][0].Registrant).toBe('the-app');
            expect(getRegistrationStatus).toHaveBeenCalledTimes(3);
            expect(getRegistrationStatus).toHaveBeenCalledWith({ EventStore: 'store', Registrant: 'the-app' });
        });
    });

    describe('and the kernel cannot apply it', () => {
        it('should fail with the failure the kernel reported, without registering again', async () => {
            getRegistrationStatus.mockResolvedValue(status(RegistrationState.Failed, 'the read model clashes'));
            const thrown = await run().catch(error => error);
            expect(thrown.message).toContain(new ProjectionRegistrationNotApplied('the-app', 'the read model clashes').message);
            expect(register).toHaveBeenCalledTimes(1);
        });
    });

    describe('and the kernel predates the registration status', () => {
        it('should carry on without waiting', async () => {
            getRegistrationStatus.mockRejectedValue(Object.assign(new Error('unimplemented'), { code: 12 }));
            await run();
            expect(getRegistrationStatus).toHaveBeenCalledTimes(1);
        });
    });

    describe('and the kernel is too busy to take the registration', () => {
        it('should wait as long as the retry-after the kernel asked for before registering again', async () => {
            getRegistrationStatus.mockResolvedValue(status(RegistrationState.Applied));
            register
                .mockImplementationOnce(async (_request: unknown, options: { onTrailer: (trailer: Metadata) => void }) => {
                    options.onTrailer(Metadata({ 'retry-after': '7' }));
                    throw Object.assign(new Error('UNAVAILABLE: busy'), { code: 14 });
                })
                .mockResolvedValue({});
            const registration = run();
            await vi.advanceTimersByTimeAsync(6_999);
            expect(register).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(1);
            await registration;
            expect(register).toHaveBeenCalledTimes(2);
        });
    });
});

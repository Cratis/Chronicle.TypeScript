// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { createLogger } from '../../logging/createLogger.js';
import { registerProjectionWithRetry } from '../registerProjectionWithRetry.js';

describe('when registering a projection without a registrant', () => {
    it('should answer after the registration without asking the kernel for a registration status', async () => {
        const register = vi.fn().mockResolvedValue({});
        const getRegistrationStatus = vi.fn();
        const connection = { projections: { register, getRegistrationStatus } } as unknown as ChronicleConnection;

        await registerProjectionWithRetry(connection, 'store', createLogger('registration-spec'), { Identifier: 'projection' } as ProjectionDefinition, 'projection');

        expect(register).toHaveBeenCalledTimes(1);
        expect(register.mock.calls[0][0].Registrant).toBeUndefined();
        expect(getRegistrationStatus).not.toHaveBeenCalled();
    });
});

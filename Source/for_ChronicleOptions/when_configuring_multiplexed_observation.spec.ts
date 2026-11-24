// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { ChronicleOptions } from '../ChronicleOptions.js';
import { multiplexedObservationCapability, shouldMultiplexObservation } from '../connection/MultiplexedObservation.js';

describe('when configuring multiplexed observation', () => {
    it('should be on by default', () => {
        expect(ChronicleOptions.fromConnectionString('chronicle://localhost:35000').multiplexObservation).toBe(true);
    });

    it('should be turned off by the option', () => {
        expect(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { multiplexObservation: false }).multiplexObservation).toBe(false);
    });

    it('should multiplex only when it is on and the kernel advertises it', () => {
        expect([
            shouldMultiplexObservation(true, [multiplexedObservationCapability]),
            shouldMultiplexObservation(true, []),
            shouldMultiplexObservation(false, [multiplexedObservationCapability])
        ]).toEqual([true, false, false]);
    });
});

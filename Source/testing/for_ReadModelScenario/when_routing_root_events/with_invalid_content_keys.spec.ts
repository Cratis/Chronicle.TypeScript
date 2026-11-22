// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, expect, it } from 'vitest';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../projections/UnsupportedProjectionOperation.js';
import { Changed, fluent } from './given/compiled_projection.js';

chai.should();

describe('when a routed root key is missing or invalid', () => {
    for (const key of [undefined, null, '', 42, false, {}, []]) {
        it(`should reject ${JSON.stringify(key)} before returning any replayed row`, async () => {
            const scenario = new ReadModelScenario(fluent.model, fluent.artifacts);
            scenario.given.forEventSource('source').events(new Changed('A', 'valid'));
            scenario.given.forEventSource('source').events(new Changed(key as string, 'invalid'));
            const reads = [() => scenario.instanceForEventSourceId('A'), () => scenario.instance,
                () => scenario.wasDeletedForEventSourceId('A'), () => scenario.instanceForEventSourceId('source')];
            for (const read of reads) {
                const error = await read().then(() => undefined, (error: unknown) => error);
                expect(error).to.be.instanceOf(UnsupportedProjectionOperation);
                const message = (error as Error).message;
                message.should.include('Model');
                message.should.include('From[RoutedNameChanged:1].Key');
                message.should.include('kernel-backed test');
            }
        });
    }
});

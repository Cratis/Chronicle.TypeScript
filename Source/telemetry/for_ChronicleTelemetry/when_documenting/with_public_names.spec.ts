// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { WellKnownTelemetryNames } from '../../../WellKnownTelemetryNames.js';
import { telemetryReference } from '../../../scripts/telemetry-reference.mjs';

chai.should();
describe('when publishing the telemetry reference', () => {
    it('should keep the documented registry identical to the public constants', () => {
        const documentation = readFileSync(new URL('../../../../Documentation/observability.md', import.meta.url), 'utf8');
        documentation.should.contain(telemetryReference(WellKnownTelemetryNames));
    });
});

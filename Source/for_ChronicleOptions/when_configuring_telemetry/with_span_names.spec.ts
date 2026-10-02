// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { ChronicleTelemetryOptions } from '../../telemetry/ChronicleTelemetryOptions.js';

chai.should();
const factories = {
    development: (telemetry: ChronicleTelemetryOptions) => ChronicleOptions.development({ telemetry }),
    connectionString: (telemetry: ChronicleTelemetryOptions) => ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { telemetry })
};
for (const [name, factory] of Object.entries(factories)) {
    describe(`when configuring removed span names through ${name}`, () => {
        it('should reject legacy mode from JavaScript with migration guidance', () => {
            const telemetry = { spanNames: 'legacy' } as unknown as ChronicleTelemetryOptions;
            (() => factory(telemetry)).should.throw(TypeError,
                "telemetry.spanNames: 'legacy' was removed in this major release. Remove spanNames and migrate to the cratis.chronicle.client.* span names.");
        });
        it('should silently accept the previous convention opt-in from JavaScript', () => {
            const telemetry = { spanNames: 'convention', eventSourceId: { mode: 'raw' as const } };
            factory(telemetry).telemetry!.eventSourceId!.should.deep.equal({ mode: 'raw' });
        });
        it('should accept privacy settings without a span name option', () => {
            factory({ eventSourceId: { mode: 'raw' } }).telemetry!.eventSourceId!.should.deep.equal({ mode: 'raw' });
        });
    });
}

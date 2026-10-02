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
    describe(`when configuring compatibility span names through ${name}`, () => {
        for (const spanNames of ['legacy', 'convention'] as const) {
            it(`should accept ${spanNames} without throwing or changing privacy`, () => {
                factory({ spanNames, eventSourceId: { mode: 'raw' } }).telemetry!.should.deep.equal({
                    spanNames, eventSourceId: { mode: 'raw' }
                });
            });
        }
        it('should accept privacy settings without a span name option', () => {
            factory({ eventSourceId: { mode: 'raw' } }).telemetry!.eventSourceId!.should.deep.equal({ mode: 'raw' });
        });
        for (const spanNames of ['invalid', '', null, 42, {}]) {
            it(`should reject the invalid JavaScript selector ${JSON.stringify(spanNames)}`, () => {
                const telemetry = { spanNames } as unknown as ChronicleTelemetryOptions;
                (() => factory(telemetry)).should.throw(TypeError, 'telemetry.spanNames must be legacy or convention.');
            });
        }
    });
}

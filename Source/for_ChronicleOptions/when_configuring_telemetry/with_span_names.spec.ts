// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { ChronicleTelemetryOptions } from '../../telemetry/ChronicleTelemetryOptions.js';

chai.should();

for (const spanNames of ['unknown', '', null, false, 0, {}, [], ['legacy']]) {
    describe(`when configuring unsupported span names ${JSON.stringify(spanNames)}`, () => {
        const telemetry = { spanNames } as unknown as ChronicleTelemetryOptions;
        it('should reject the development options at construction', () => {
            (() => ChronicleOptions.development({ telemetry })).should.throw(TypeError, 'telemetry.spanNames must be legacy or convention.');
        });
        it('should reject the connection string options at construction', () => {
            (() => ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { telemetry })).should.throw(TypeError, 'telemetry.spanNames must be legacy or convention.');
        });
    });
}

for (const spanNames of [undefined, 'legacy', 'convention'] as const) {
    describe(`when configuring supported span names ${spanNames ?? 'by default'}`, () => {
        it('should preserve the choice with the event source identifier policy', () => {
            const telemetry = { spanNames, eventSourceId: { mode: 'raw' as const } };
            const development = ChronicleOptions.development({ telemetry });
            const connection = ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { telemetry });
            development.telemetry!.should.deep.equal(telemetry);
            connection.telemetry!.should.deep.equal(telemetry);
        });
    });
}

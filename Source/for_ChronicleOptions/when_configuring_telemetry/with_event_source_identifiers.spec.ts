// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { ChronicleTelemetryOptions } from '../../telemetry/ChronicleTelemetryOptions.js';

chai.should();

for (const policy of [
    { mode: 'unknown' }, {}, null,
    { mode: 'hmac' }, { mode: 'hmac', key: '' }, { mode: 'hmac', key: 'secret' },
    { mode: 'hmac', key: [] }, { mode: 'hmac', key: new Uint8Array() },
    { mode: 'hmac', key: Buffer.alloc(0) }, { mode: 'hmac', key: new Uint16Array([1]) },
    { mode: 'hmac', key: new DataView(new ArrayBuffer(1)) },
    { mode: 'hmac', key: runInNewContext('new Uint8Array()') },
    { mode: 'hmac', key: runInNewContext('new Uint16Array([1])') }
]) {
    describe(`when configuring event source privacy with ${JSON.stringify(policy)}`, () => {
        it('should reject invalid telemetry configuration before a client can make business calls', () => {
            const telemetry = { eventSourceId: policy } as unknown as ChronicleTelemetryOptions;
            (() => ChronicleOptions.development({ telemetry })).should.throw(TypeError);
            (() => ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { telemetry })).should.throw(TypeError);
        });
    });
}

describe('when configuring an HMAC key created in another realm', () => {
    it('should accept a non-empty byte array without relying on its realm constructor', () => {
        const key = runInNewContext('new Uint8Array([1, 2, 3])') as Uint8Array;
        (key instanceof Uint8Array).should.be.false;
        (() => ChronicleOptions.development({ telemetry: { eventSourceId: { mode: 'hmac', key } } })).should.not.throw();
        (() => ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { telemetry: { eventSourceId: { mode: 'hmac', key } } })).should.not.throw();
    });
});

for (const eventSourceId of [undefined, { mode: 'raw' }, { mode: 'hmac', key: new Uint8Array([1]) }, { mode: 'hmac', key: Buffer.from('key') }] as const) {
    describe('when configuring a supported event source privacy policy', () => {
        it('should accept omitted identifiers, raw identifiers and non-empty byte keys', () => {
            (() => ChronicleOptions.development({ telemetry: { eventSourceId } })).should.not.throw();
        });
    });
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../ChronicleOptions.js';

chai.should();

const hundredMegabytes = 100 * 1024 * 1024;

describe('when configuring message sizes', () => {
    it('should allow 100 MB in both directions by default, matching the other clients', () => {
        const options = ChronicleOptions.fromConnectionString('chronicle://localhost:35000');
        options.maxReceiveMessageSize!.should.equal(hundredMegabytes);
        options.maxSendMessageSize!.should.equal(hundredMegabytes);
    });

    it('should use the configured sizes', () => {
        const options = ChronicleOptions.development({ maxReceiveMessageSize: 200, maxSendMessageSize: 300 });
        options.maxReceiveMessageSize!.should.equal(200);
        options.maxSendMessageSize!.should.equal(300);
    });

    it('should keep null as null so the gRPC default can be asked for explicitly', () => {
        const options = ChronicleOptions.development({ maxReceiveMessageSize: null, maxSendMessageSize: null });
        (options.maxReceiveMessageSize === null).should.be.true;
        (options.maxSendMessageSize === null).should.be.true;
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { ChronicleConnectionStringBuilder, ChronicleConnectionString } from '../../connection/ChronicleConnectionString.js';

chai.should();

describe('when configuring keep alive', () => {
    it('should preserve the default', () => ChronicleOptions.development().skipKeepAlive.should.be.false);
    it('should accept the factory option', () => ChronicleOptions.development({ skipKeepAlive: true }).skipKeepAlive.should.be.true);
    for (const [query, option, expected] of [
        ['true', undefined, true], ['true', false, true], ['false', false, false], ['false', true, true], ['TRUE', false, false]
    ] as const) {
        it(`should combine string ${query} and option ${option} with OR precedence`, () => {
            ChronicleOptions.fromConnectionString(`chronicle://localhost:35000?skipKeepAlive=${query}`, {
                skipKeepAlive: option
            }).skipKeepAlive.should.equal(expected);
        });
    }
    it('should emit and round trip the enabled key exactly once', () => {
        const builder = new ChronicleConnectionStringBuilder();
        builder.skipKeepAlive = true;
        builder.build().should.equal('chronicle://localhost:35000?skipKeepAlive=true');
        new ChronicleConnectionString(builder.build()).skipKeepAlive.should.be.true;
        new ChronicleConnectionStringBuilder(builder.build()).skipKeepAlive.should.be.true;
    });
    it('should omit the disabled key', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000?skipKeepAlive=true');
        builder.skipKeepAlive = false;
        builder.build().should.equal('chronicle://localhost:35000');
        new ChronicleConnectionString(builder.build()).skipKeepAlive.should.be.false;
    });
});

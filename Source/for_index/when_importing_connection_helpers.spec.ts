// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleConnectionString, ChronicleOptions } from '../index.js';

chai.should();

describe('when importing connection helpers from the package root', () => {
    it('should export the connection string', () =>
        ChronicleOptions.fromConnectionString(new ChronicleConnectionString('chronicle://localhost:35001'))
            .connectionString.serverAddress.port.should.equal(35001));
});

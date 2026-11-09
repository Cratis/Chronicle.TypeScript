// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { WellKnownSinks } from '../../sinks/index.js';

chai.should();

describe('when configuring the graph sink', () => {
    it('should store graphs in Neo4j by default, and leave document read models alone', () => {
        const options = ChronicleOptions.development();
        options.defaultGraphSinkTypeId.should.equal(WellKnownSinks.Neo4j);
        options.defaultSinkTypeId.should.equal(WellKnownSinks.MongoDB);
    });

    it('should use the configured sink type for graphs only', () => {
        const options = ChronicleOptions.development({ defaultGraphSinkTypeId: WellKnownSinks.InMemoryGraph });
        options.defaultGraphSinkTypeId.should.equal(WellKnownSinks.InMemoryGraph);
        options.defaultSinkTypeId.should.equal(WellKnownSinks.MongoDB);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { EventTypeGeneration } from '../EventTypeGeneration.js';
import { toClientEventContext } from '../toClientEventContext.js';
import type { WireEventContext } from '../WireEventContext.js';

const should = chai.should();

function context(appendedGeneration?: number) {
    return toClientEventContext({
        EventType: { Id: 'generation-test', Generation: 1, Tombstone: false },
        AppendedGeneration: appendedGeneration
    } as unknown as WireEventContext);
}

describe('when converting appended generation independently of delivered generation', () => {
    for (const generation of [2, 4_294_967_295]) {
        it(`should expose appended generation ${generation} as an unsigned generation concept`, () => {
            const result = context(generation);
            result.appendedGeneration!.should.be.instanceOf(EventTypeGeneration);
            result.appendedGeneration!.value.should.equal(generation);
            result.eventType.generation.value.should.equal(1);
        });
    }
    for (const generation of [0, undefined]) {
        it(`should expose unknown appended generation ${generation} as undefined`, () => {
            should.not.exist(context(generation).appendedGeneration);
        });
    }
});

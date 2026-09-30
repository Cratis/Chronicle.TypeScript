// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ReactorDefinition, ReactorMessage } from '@cratis/chronicle.contracts';
import { applyExplicitFalseEncoding } from '../encodeExplicitFalse.js';
import { readVarintFields } from './wireFields.js';

chai.should();

const encode = (isReplayable: boolean) => ReactorDefinition.encode(ReactorDefinition.create({ ReactorId: 'reactor', IsReplayable: isReplayable })).finish();

describe('when encoding a reactor definition', () => {
    it('should write an explicit false for a non-replayable reactor', () => {
        readVarintFields(encode(false)).get(4)!.should.deep.equal([0]);
    });

    it('should write true unchanged for a replayable reactor', () => {
        readVarintFields(encode(true)).get(4)!.should.deep.equal([1]);
    });

    it('should not duplicate the field when applied again', () => {
        applyExplicitFalseEncoding();
        applyExplicitFalseEncoding();
        readVarintFields(encode(false)).get(4)!.should.deep.equal([0]);
    });

    it('should keep the explicit false when nested in a reactor message', () => {
        const message = ReactorMessage.encode(ReactorMessage.create({
            Content: { $case: 'Value0', Value0: { Reactor: ReactorDefinition.create({ ReactorId: 'reactor', IsReplayable: false }) } }
        } as never)).finish();
        Buffer.from(message).includes(Buffer.from([32, 0])).should.be.true;
    });
});

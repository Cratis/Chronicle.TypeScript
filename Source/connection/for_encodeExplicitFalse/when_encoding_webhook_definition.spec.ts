// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { WebhookDefinition } from '@cratis/chronicle.contracts';
import { applyExplicitFalseEncoding } from '../encodeExplicitFalse.js';
import { readVarintFields } from './wireFields.js';

chai.should();

const encode = (IsReplayable: boolean, IsActive: boolean) =>
    readVarintFields(WebhookDefinition.encode(WebhookDefinition.create({ Identifier: 'webhook', IsReplayable, IsActive })).finish());

describe('when encoding a webhook definition', () => {
    it('should write an explicit false for a non-replayable webhook', () => {
        const fields = encode(false, true);
        fields.get(5)!.should.deep.equal([0]);
        fields.get(6)!.should.deep.equal([1]);
    });

    it('should write an explicit false for an inactive webhook', () => {
        const fields = encode(true, false);
        fields.get(5)!.should.deep.equal([1]);
        fields.get(6)!.should.deep.equal([0]);
    });

    it('should write true unchanged for a replayable and active webhook', () => {
        const fields = encode(true, true);
        fields.get(5)!.should.deep.equal([1]);
        fields.get(6)!.should.deep.equal([1]);
    });

    it('should not duplicate the fields when applied again', () => {
        applyExplicitFalseEncoding();
        const fields = encode(false, false);
        fields.get(5)!.should.deep.equal([0]);
        fields.get(6)!.should.deep.equal([0]);
    });
});

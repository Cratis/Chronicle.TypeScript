// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { EventScenario } from '../../index.js';

chai.should();

class Noted {
    @field(String) name = '';
}
eventType('AstralNoted')(Noted);

describe('when appending a plain string with a supplementary character', () => {
    it('should keep the content literal and hash the kernel-escaped JSON', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [Noted] }, constraints: 'disabled' });
        const result = await scenario.append('A', Object.assign(new Noted(), { name: 'a\u{1f600}\u{10ffff}' }));
        result.isSuccess.should.equal(true);
        scenario.appendedEvents[0].content.should.deep.equal({ name: 'a\u{1f600}\u{10ffff}' });
        scenario.appendedEvents[0].context.hash.should.equal(createHash('sha256')
            .update('AstralNoted|A|{"name":"a\\uD83D\\uDE00\\uDBFF\\uDFFF"}').digest('base64'));
    });

    it('should reject an unmeasured supplementary character', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [Noted] }, constraints: 'disabled' });
        const error = await scenario.append('A', Object.assign(new Noted(), { name: '\u{1f601}' })).then(() => undefined, caught => caught);
        (error !== undefined).should.equal(true);
        scenario.appendedEvents.should.have.lengthOf(0);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { InvalidNamedTag } from '../../../events/InvalidNamedTag.js';
import { NamedTag } from '../../../events/NamedTag.js';
import type { EventContext } from '../../../events/EventContext.js';
import { reactor } from '../../../reactors/reactor.js';
import { ReactorScenario } from '../../ReactorScenario.js';

chai.should();
@eventType('scenario-named-tag-input')
class NamedTagInput { @field(String) name = 'input'; }
@eventType('scenario-named-tag-output')
class NamedTagOutput { @field(String) name = 'output'; }

const contexts: EventContext[] = [];
@reactor('scenario-named-tag-reactor')
class NamedTagReactor {
    namedTagInput(_: NamedTagInput, context: EventContext) {
        contexts.push(context);
        return { eventSourceId: 'other', event: new NamedTagOutput(), namedTags: [new NamedTag('origin', context.eventSourceId)] };
    }
}
@reactor('scenario-invalid-named-tag-reactor')
class InvalidNamedTagReactor {
    namedTagInput() {
        return { eventSourceId: 'other', event: new NamedTagOutput(), namedTags: [{ name: ' ', value: 'x' }] };
    }
}
const artifacts = { eventTypes: [NamedTagInput, NamedTagOutput] };

describe('when recording a side effect with named tags', () => {
    let scenario: ReactorScenario;
    beforeEach(async () => {
        contexts.length = 0;
        scenario = new ReactorScenario(NamedTagReactor, { artifacts, constraints: 'disabled' });
        await scenario.when.forEventSource('trigger').events(new NamedTagInput());
    });
    it('should record the named tags on the side-effect target', () =>
        scenario.sideEffects[0].target.namedTags!.map(tag => `${tag.name}=${tag.value}`).should.deep.equal(['origin=trigger']));
    it('should deliver an empty named tag list like a kernel delivery of an untagged event', () =>
        contexts[0].namedTags!.should.deep.equal([]));
});

describe('when recording a side effect with an invalid named tag', () => {
    let error: unknown;
    beforeEach(async () => {
        const scenario = new ReactorScenario(InvalidNamedTagReactor, { artifacts, constraints: 'disabled' });
        error = await scenario.when.forEventSource('trigger').events(new NamedTagInput()).catch(caught => caught);
    });
    it('should fail the delivery with an invalid named tag error, as production append does', () =>
        (error as Error).should.be.instanceOf(InvalidNamedTag));
});

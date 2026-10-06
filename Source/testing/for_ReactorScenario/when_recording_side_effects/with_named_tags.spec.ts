// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { InvalidNamedTag } from '../../../events/InvalidNamedTag.js';
import { NamedTag } from '../../../events/NamedTag.js';
import { NamedTagsWithRegisteredEventSourceNotSupported } from '../../../eventSequences/index.js';
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
@reactor('scenario-named-tags-registered-source-same-entry')
class NamedTagRegisteredSourceReactor {
    namedTagInput() {
        return { eventSourceId: 'other', event: new NamedTagOutput(), eventSource: 'Account', namedTags: [new NamedTag('origin', 'trigger')] };
    }
}
@reactor('scenario-named-tags-registered-source-cross-entry')
class NamedTagCrossEntryReactor {
    namedTagInput() {
        return [
            { eventSourceId: 'tagged', event: new NamedTagOutput(), namedTags: [new NamedTag('origin', 'trigger')] },
            { eventSourceId: 'registered', event: new NamedTagOutput(), eventSource: 'Account' }
        ];
    }
}
@reactor('scenario-named-tags-registered-source-cross-entry-reversed')
class NamedTagCrossEntryReversedReactor {
    namedTagInput() {
        return [
            { eventSourceId: 'registered', event: new NamedTagOutput(), eventSource: 'Account' },
            { eventSourceId: 'tagged', event: new NamedTagOutput(), namedTags: [new NamedTag('origin', 'trigger')] }
        ];
    }
}
@reactor('scenario-empty-named-tags-registered-source')
class EmptyNamedTagsRegisteredSourceReactor {
    namedTagInput() {
        return { eventSourceId: 'other', event: new NamedTagOutput(), eventSource: 'Account', namedTags: [] };
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

for (const [description, reactorType] of [
    ['the same entry', NamedTagRegisteredSourceReactor],
    ['a tagged entry before a registered entry', NamedTagCrossEntryReactor],
    ['a registered entry before a tagged entry', NamedTagCrossEntryReversedReactor]
] as const) {
    describe(`when recording named tags and a registered source in ${description}`, () => {
        let scenario: ReactorScenario;
        let error: unknown;
        beforeEach(async () => {
            scenario = new ReactorScenario(reactorType, { artifacts, constraints: 'disabled' });
            error = await scenario.when.forEventSource('trigger').events(new NamedTagInput()).catch(caught => caught);
        });
        it('should reject with the production unsupported combination error', () =>
            (error as Error).should.be.instanceOf(NamedTagsWithRegisteredEventSourceNotSupported));
        it('should record an unsuccessful delivery', () => scenario.results[0].completed.should.be.false);
        it('should retain the rejection on the delivery result', () => scenario.results[0].error!.should.equal(error));
        it('should not record any returned side effect', () => scenario.sideEffects.should.have.lengthOf(0));
        it('should not report any produced event', () => scenario.produced.should.have.lengthOf(0));
    });
}

describe('when recording a registered source with empty named tags', () => {
    let scenario: ReactorScenario;
    beforeEach(async () => {
        scenario = new ReactorScenario(EmptyNamedTagsRegisteredSourceReactor, { artifacts, constraints: 'disabled' });
        await scenario.when.forEventSource('trigger').events(new NamedTagInput());
    });
    it('should complete the delivery', () => scenario.results[0].completed.should.be.true);
    it('should retain the registered source on the recorded effect', () => scenario.sideEffects[0].target.eventSource!.should.equal('Account'));
    it('should retain the empty named tag array', () => scenario.sideEffects[0].target.namedTags!.should.deep.equal([]));
});

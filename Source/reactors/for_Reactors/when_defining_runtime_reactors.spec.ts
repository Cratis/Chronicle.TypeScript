// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../eventSequences/EventSequenceId.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { DecoratorType } from '../../types/DecoratorType.js';
import type { IReactorDefinition } from '../IReactorDefinition.js';
import type { IReactorBuilder } from '../IReactorBuilder.js';
import { Registered, Other, runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

describe('when defining a fluent reactor', () => {
    let context: runtime_reactors;
    let definition: IReactorDefinition;
    let builder: IReactorBuilder;
    let artifacts: number;
    beforeEach(() => {
        context = new runtime_reactors();
        artifacts = TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.Reactor).length;
        definition = context.reactors.define('fluent', value => {
            builder = value;
            value.on(Registered, () => {}).on(Registered, () => {}).onEventSequence(new EventSequenceId('custom')).notReplayable();
        });
        builder.on(Other, () => {});
    });
    afterEach(() => context.reactors.dispose());
    it('should retain a stable ID and sequence', () => {
        definition.id.value.should.equal('fluent');
        definition.eventSequenceId.value.should.equal('custom');
    });
    it('should deduplicate subscription event types', () => definition.eventTypes.map(type => type.id.value).should.deep.equal(['runtime-registered']));
    it('should snapshot replayability', () => definition.isReplayable.should.be.false);
    it('should freeze the definition and its event type list', () => {
        Object.isFrozen(definition).should.be.true;
        Object.isFrozen(definition.eventTypes).should.be.true;
    });
    it('should not start observation', () => context.observe.mock.calls.length.should.equal(0));
    it('should not add a synthetic global artifact', () => TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.Reactor).length.should.equal(artifacts));
});

for (const [scenario, define, message] of [
    ['an empty ID', (context: runtime_reactors) => context.reactors.define('', builder => builder.on(Registered, () => {})), /id must not be empty/],
    ['no subscriptions', (context: runtime_reactors) => context.reactors.define('empty', () => {}), /at least one event type/],
    ['an unregistered event type', (context: runtime_reactors) => context.reactors.define('invalid', builder => builder.on(class Unknown {}, () => {})), /no registered event type/]
] as const) {
    describe(`when defining with ${scenario}`, () => {
        let context: runtime_reactors;
        let failure: unknown;
        beforeEach(() => {
            context = new runtime_reactors();
            try { define(context); } catch (error) { failure = error; }
        });
        afterEach(() => context.reactors.dispose());
        it('should reject before opening a stream', () => {
            (failure as Error).message.should.match(message);
            context.observe.mock.calls.length.should.equal(0);
        });
    });
}

describe('when subscribing to all currently known types', () => {
    let context: runtime_reactors;
    let definition: IReactorDefinition;
    beforeEach(() => {
        context = new runtime_reactors();
        definition = context.reactors.define('all', builder => builder.subscribe(() => {}));
        context.types.length = 0;
    });
    afterEach(() => context.reactors.dispose());
    it('should keep the known-type snapshot rather than a future-type wildcard', () => definition.eventTypes.length.should.equal(2));
    it('should default to the event log and replayable delivery', () => {
        definition.eventSequenceId.value.should.equal(EventSequenceId.eventLog.value);
        definition.isReplayable.should.be.true;
    });
});

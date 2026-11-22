// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { EventGenerationDelivery } from '../../observation/index.js';
import { reactor, getReactorMetadata } from '../reactor.js';
import { ReactorBuilder } from '../ReactorBuilder.js';
import { Registered, runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

for (const delivery of [undefined, EventGenerationDelivery.Compatibility, EventGenerationDelivery.Pinned]) {
    for (const style of ['class', 'callback', 'delegate'] as const) {
        describe(`when selecting ${delivery} generation delivery for a ${style} reactor`, () => {
            let context: runtime_reactors;
            beforeEach(async () => {
                context = new runtime_reactors();
                if (style === 'class') {
                    class Selected { registered() {} }
                    reactor('selected', undefined, delivery)(Selected);
                    getReactorMetadata(Selected)!.generationDelivery!.should.equal(delivery ?? EventGenerationDelivery.Compatibility);
                    context.artifacts.push(Selected);
                    await context.reactors.register();
                } else if (style === 'callback') {
                    await context.reactors.register('selected', builder => {
                        builder.on(Registered, () => {});
                        if (delivery !== undefined) builder.withEventGenerationDelivery(delivery);
                    });
                } else {
                    await context.reactors.register('selected', builder => {
                        builder.withEventType(Registered);
                        if (delivery !== undefined) builder.withEventGenerationDelivery(delivery);
                    }, () => {});
                }
                await vi.waitFor(() => context.attempts[0].sent.length.should.equal(1));
            });
            afterEach(() => context.reactors.dispose());
            it('should serialize the selected mode without changing the subscribed generation', () => {
                const definition = context.attempts[0].sent[0].Content!.Value0!.Reactor!;
                definition.GenerationDelivery.should.equal(delivery ?? 0);
                definition.EventTypes[0].EventType!.Generation.should.equal(1);
            });
        });
    }
}

describe('when registering definitions written before generation delivery was available', () => {
    let context: runtime_reactors;
    beforeEach(() => { context = new runtime_reactors(); });
    afterEach(() => context.reactors.dispose());

    it('should use compatibility for an older runtime definition and class metadata', async () => {
        const definition = new ReactorBuilder('legacy-runtime', [Registered]).withEventType(Registered).build();
        const { generationDelivery: _delivery, ...legacy } = definition;
        await context.reactors.register(legacy);
        class Legacy { registered() {} }
        reactor('legacy-class')(Legacy);
        delete (getReactorMetadata(Legacy) as { generationDelivery?: EventGenerationDelivery }).generationDelivery;
        context.artifacts.push(Legacy);
        await context.reactors.register();
        await vi.waitFor(() => context.attempts.length.should.equal(2));
        for (const attempt of context.attempts) {
            await vi.waitFor(() => attempt.sent.length.should.equal(1));
            attempt.sent[0].Content!.Value0!.Reactor!.GenerationDelivery.should.equal(0);
        }
    });

    it('should preserve pinned delivery when a stream reconnects', async () => {
        await context.reactors.register('reconnect', builder => builder
            .on(Registered, () => {}).withEventGenerationDelivery(EventGenerationDelivery.Pinned));
        await vi.waitFor(() => context.attempts[0].sent.length.should.equal(1));
        await context.lifecycle.disconnected(error => { throw error; });
        await context.reactors.register();
        await vi.waitFor(() => context.attempts.length.should.equal(2));
        await vi.waitFor(() => context.attempts[1].sent.length.should.equal(1));
        context.attempts[1].sent[0].Content!.Value0!.Reactor!.GenerationDelivery.should.equal(1);
    });
});

describe('when snapshotting a runtime generation delivery selection', () => {
    it('should keep earlier definitions independent and return the fluent builder', () => {
        const builder = new ReactorBuilder('snapshots', [Registered]).withEventType(Registered);
        const compatibility = builder.build();
        builder.withEventGenerationDelivery(EventGenerationDelivery.Pinned).should.equal(builder);
        const pinned = builder.build();
        builder.withEventGenerationDelivery(EventGenerationDelivery.Compatibility);
        compatibility.generationDelivery!.should.equal(EventGenerationDelivery.Compatibility);
        pinned.generationDelivery!.should.equal(EventGenerationDelivery.Pinned);
        Object.isFrozen(pinned).should.be.true;
    });
});

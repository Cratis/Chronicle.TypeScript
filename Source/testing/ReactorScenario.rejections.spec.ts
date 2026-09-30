// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { ArtifactCompletionFailed } from '../artifacts/ArtifactCompletionFailed.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { reactor } from '../reactors/reactor.js';
import { ReactorScenario } from './ReactorScenario.js';
import { UnsupportedReactorOperation } from './UnsupportedReactorOperation.js';

chai.should();
@eventType('rejection-event')
class Registered {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
class Unregistered { constructor(readonly name: string) {} }
const options = { artifacts: { eventTypes: [Registered] }, constraints: 'disabled' as const };

async function rejected(operation: string, call: () => Promise<unknown>): Promise<void> {
    await call().then(() => { throw new Error('expected rejection'); }, error => {
        (error instanceof UnsupportedReactorOperation).should.be.true;
        error.operation.should.equal(operation);
        error.message.should.contain('Use a kernel-backed test.');
    });
}

describe('unsupported reactor operations', () => {
    it('rejects missing registration, custom sequence and commands during configuration', () => {
        class Plain {}
        (() => new ReactorScenario(Plain, options)).should.throw(UnsupportedReactorOperation, 'Use a kernel-backed test.');
        @reactor('custom-sequence', 'custom') class Custom { registered() {} }
        (() => new ReactorScenario(Custom, options)).should.throw(UnsupportedReactorOperation, 'Use a kernel-backed test.');
        @reactor('commands') class Commands { registered() {} }
        (() => new ReactorScenario(Commands, { ...options, commandTypes: [Unregistered] }))
            .should.throw(UnsupportedReactorOperation, 'Use a kernel-backed test.');
    });

    it('rejects replay and redelivery asynchronously without mutation', async () => {
        @reactor('replay-rejection') class R { registered() {} }
        const scenario = new ReactorScenario(R, options);
        await rejected('replay', () => scenario.replay());
        await rejected('redeliver', () => scenario.redeliver());
        await rejected('when.events', () => scenario.when.forEventSource('A').events());
        scenario.results.length.should.equal(0);
        scenario.sideEffects.length.should.equal(0);
    });

    it('rejects unsupported returned values instead of silently dropping them', async () => {
        for (const value of [{ command: true }, [new Registered('ok'), { command: true }], [undefined]]) {
            @reactor('unknown-result') class R { registered() { return value; } }
            const scenario = new ReactorScenario(R, options);
            await rejected('handler.return', () => scenario.when.forEventSource('A').events(new Registered('one')));
            scenario.sideEffects.length.should.equal(0);
            scenario.results[0].completed.should.be.false;
        }
    });

    it('rejects unsupported setup before invocation and without delivery results', async () => {
        let called = 0;
        @reactor('unsupported-input') class R { registered() { called++; } }
        const scenario = new ReactorScenario(R, options);
        await scenario.given.forEventSource('A').events(new Registered('ok'), new Unregistered('bad')).then(() => {
            throw new Error('expected rejection');
        }, error => { error.message.should.contain('Use a kernel-backed test.'); });
        called.should.equal(0);
        scenario.results.length.should.equal(0);
        await scenario.when.forEventSource('A').events(new Registered('after'));
        scenario.results[0].handled[0].sequenceNumber.should.equal(0n);
    });

    it('rejects missing read-model services instead of supplying fake data', async () => {
        @reactor('read-model-rejection') class R {
            registered(_event: Registered, _context: unknown, services: { readModels: { findInstanceById(): unknown } }) {
                return services.readModels.findInstanceById();
            }
        }
        const scenario = new ReactorScenario(R, options);
        await rejected('services.readModels.findInstanceById', () => scenario.when.forEventSource('A').events(new Registered('one')));
    });

    it('preserves processing-only, completion-only and activation failures', async () => {
        @reactor('failure-rejection') class R { registered() { throw new Error('handler'); } }
        const processing = new ReactorScenario(R, { ...options, artifactActivator: type => ({ instance: new type() }) });
        await processing.when.forEventSource('A').events(new Registered('one')).then(() => { throw new Error('expected rejection'); },
            error => { String(error).should.contain('handler'); });
        processing.results[0].completed.should.be.false;
        @reactor('completion-rejection') class Complete { registered() {} }
        const completion = new ReactorScenario(Complete, { ...options, artifactActivator: type => ({ instance: new type(),
            complete: () => { throw new Error('completion'); } }) });
        await completion.when.forEventSource('A').events(new Registered('one')).then(() => { throw new Error('expected rejection'); },
            error => { (error instanceof ArtifactCompletionFailed).should.be.true; chai.expect(error.processingError).to.be.undefined; });
        completion.results[0].completed.should.be.false;
        const activation = new ReactorScenario(Complete, { ...options, artifactActivator: () => { throw new Error('activation'); } });
        await activation.when.forEventSource('A').events(new Registered('one')).then(() => { throw new Error('expected rejection'); },
            error => { String(error).should.contain('activation'); });
        activation.results[0].handled.length.should.equal(0);
    });
});

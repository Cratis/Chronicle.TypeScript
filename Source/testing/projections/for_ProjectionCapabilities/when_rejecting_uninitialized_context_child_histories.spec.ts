// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, chai, describe, it, vi } from 'vitest';
import { EventType } from '../../../events/EventType.js';
import { fluent, Model } from '../../for_ReadModelScenario/when_keying_children_from_context/given/compiled_projection.js';
import type { ScenarioEvent } from '../../ScenarioEvent.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { ProjectionValueConverter } from '../ProjectionValueConverter.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();
afterEach(() => vi.restoreAllMocks());

function event(type: string, sourceId = 'A', content: object = {}): ScenarioEvent {
    return {
        sourceId, content,
        context: {
            eventSourceId: sourceId, eventType: EventType.parse(`${type}+1`), sequenceNumber: 0n,
            occurred: new Date('2025-01-01T00:00:00Z'), correlationId: '00000000-0000-0000-0000-000000000000', causation: [], tags: []
        }
    };
}
function parent(sourceId = 'A') { return event('ContextParentCreated', sourceId, { title: 'parent' }); }
function remove(sourceId = 'A') { return event('ContextParentRemoved', sourceId); }
function processor() {
    const compiled = fluent.compile();
    return new ProjectionReadModelProcessor(Model, compiled, compiled.definitions[0]);
}
type ChildEvent = () => ScenarioEvent;
const operations: Array<[string, string, ChildEvent]> = [
    ['creation', 'From[ContextChildChanged:1]', () => event('ContextChildChanged', 'A', { name: 'child' })],
    ['removal', 'RemovedWith[ContextChildRemoved:1]', () => event('ContextChildRemoved')]
];
const invalid: Array<[string, (child: ChildEvent) => ScenarioEvent[]]> = [
    ['without any parent', child => [child()]],
    ['before a later parent', child => [child(), parent()]],
    ['with a different source initialized', child => [parent('B'), child()]],
    ['after parent removal', child => [parent(), remove(), child()]],
    ['after removal of an absent parent', child => [remove(), child()]],
    ['between removal and recreation', child => [parent(), remove(), child(), parent()]]
];
for (const [operation, path, child] of operations) {
    for (const [ordering, history] of invalid) {
        describe(`when rejecting context child ${operation} ${ordering}`, () => {
            it('should reject the whole history before replay, preserving previous snapshots', async () => {
                const subject = processor();
                await subject.process([parent()]);
                const previousEngine = subject.engineState;
                const previousRead = subject.publicRead;
                const conversion = vi.spyOn(ProjectionValueConverter, 'eventContent');
                let failure: unknown;
                try { await subject.process(history(child)); } catch (error) { failure = error; }
                (failure instanceof UnsupportedProjectionOperation).should.be.true;
                const message = (failure as Error).message;
                message.should.include('Model').and.include(`Children.items.${path}`);
                message.should.include(`event-context child ${operation} before parent 'A' is initialized`);
                message.should.include('kernel-backed test');
                conversion.mock.calls.should.have.length(0);
                subject.engineState.should.deep.equal(previousEngine);
                subject.publicRead.should.deep.equal(previousRead);
            });
        });
    }
    describe(`when replaying parent-first context child ${operation}`, () => {
        it('should accept an initialized parent', async () => {
            const subject = processor();
            const result = await subject.process([parent(), child()]);
            result.get('A')!.deleted.should.be.false;
            subject.engineState.A.should.include({ __initialized: true });
        });
        it('should accept a recreated parent', async () => {
            const subject = processor();
            await subject.process([parent(), remove(), parent(), child()]);
            subject.engineState.A.should.include({ __initialized: true });
        });
        it('should keep initialization independent across event sources', async () => {
            const subject = processor();
            await subject.process([parent(), parent('B'), remove('B'), child()]);
            Object.keys(subject.engineState).should.deep.equal(['A']);
            subject.engineState.A.should.include({ __initialized: true });
        });
    });
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import { unique } from '../events/constraints/unique.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';

chai.should();

describe('selected constraint discovery', () => {
    it('enforces selected decorators when global discovery has been cleared', async () => {
        class SelectedClaim {
            @field(String) @unique('ClearedRegistryKey') key: string;
            constructor(key: string) { this.key = key; }
        }
        eventType('ClearedRegistryClaim')(SelectedClaim);
        TypeDiscoverer.default.clear();

        const subject = new EventScenario({ artifacts: { eventTypes: [SelectedClaim] } });
        (await subject.append('A', new SelectedClaim('Alpha'))).isSuccess.should.be.true;
        const result = await subject.append('B', new SelectedClaim('Alpha'));
        result.isSuccess.should.be.false;
        result.constraintViolations[0].constraintId.should.equal('ClearedRegistryKey');
        subject.appendedEvents.length.should.equal(1);
    });

    it('appends a constraint-free selected class shadowed by a later registration with the same ID', async () => {
        class SelectedItemAdded {
            @field(String) label: string;
            constructor(label: string) { this.label = label; }
        }
        eventType('ShadowedPlainItemAdded')(SelectedItemAdded);
        class ShadowItemAdded {
            @field(String) name: string;
            constructor(name: string) { this.name = name; }
        }
        eventType('ShadowedPlainItemAdded')(ShadowItemAdded);

        const subject = new EventScenario({ artifacts: { eventTypes: [SelectedItemAdded] } });
        (await subject.append('A', new SelectedItemAdded('Alpha'))).isSuccess.should.be.true;
        subject.appendedEvents.length.should.equal(1);
        subject.appendedEvents[0].content.should.deep.equal({ label: 'Alpha' });
    });

    it('rejects a globally registered constructor shadowing the selected event type ID', () => {
        class SelectedClaim {
            @field(String) @unique('ShadowedRegistryKey') key = 'Alpha';
        }
        eventType('ShadowedRegistryClaim')(SelectedClaim);
        class ShadowClaim {
            @field(String) key = 'Alpha';
        }
        eventType('ShadowedRegistryClaim')(ShadowClaim);

        try {
            new EventScenario({ artifacts: { eventTypes: [SelectedClaim] } });
            throw new Error('Expected conflicting constructors to be rejected');
        } catch (error) {
            (error instanceof UnsupportedEventSequenceOperation).should.be.true;
            (error as Error).message.should.include('artifacts.eventTypes');
            (error as Error).message.should.include('ShadowedRegistryClaim');
            (error as Error).message.should.include('Conflicting constructors share an event type ID');
        }
    });
});

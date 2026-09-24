// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, field, JsonSerializer } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection/index.js';
import { EventSequence } from '../eventSequences/EventSequence.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';
import { eventType, getEventTypeMetadata } from './eventTypeDecorator.js';

class TaskTitle extends ConceptAs<string> {
    static readonly valueType = String;
}
class TaskDetails {
    @field(String) description!: string;
    constructor(description: string) { this.description = description; }
}
@eventType('constructor-standard')
class TaskCreated {
    @field(TaskTitle) title: TaskTitle;
    @field(TaskDetails) details: TaskDetails;
    constructor(title: TaskTitle, details: TaskDetails) {
        this.title = title;
        this.details = details;
    }
}

describe('when appending a standard-decorator event with required constructor arguments', () => {
    it('should serialize, generate schema and hydrate the event with its concept and nested object', async () => {
        const append = vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } });
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'Default',
            { eventSequences: { append } } as unknown as ChronicleConnection, {} as IUnitOfWorkManager);
        const event = new TaskCreated(new TaskTitle('Write specs'), new TaskDetails('With constructors'));
        await sequence.append('task-1', event);
        const content = append.mock.calls[0][0].Content as string;
        expect(JSON.parse(content)).toEqual({ title: 'Write specs', details: { description: 'With constructors' } });
        expect(getEventTypeMetadata(TaskCreated)!.schema.properties?.title.type).toBe('string');
        expect(getEventTypeMetadata(TaskCreated)!.schema.properties?.details.properties?.description.type).toBe('string');
        const restored = JsonSerializer.deserialize(TaskCreated, content);
        expect(restored).toBeInstanceOf(TaskCreated);
        expect(restored.title).toBeInstanceOf(TaskTitle);
        expect(restored.title.value).toBe('Write specs');
        expect(restored.details).toBeInstanceOf(TaskDetails);
        expect(restored.details.description).toBe('With constructors');
    });
});

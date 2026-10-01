// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Encode with the pinned production TypeScript contracts. In particular, empty string fields
// are omitted by ts-proto; assigning "" to a nullable .NET contract is NOT equivalent.
import { readFileSync } from 'node:fs';
import { AppendRequest, AppendManyForEventSourcesRequest, ConstraintScope } from '@cratis/chronicle.contracts';

const fixture = JSON.parse(readFileSync(0, 'utf8'));
const encode = (type, value) => Buffer.from(type.encode(type.fromPartial(value)).finish()).toString('base64');
const cases = fixture.scopeCases.map(test => ({
    scopes: test.constraintDefinitions.map(definition => encode(ConstraintScope, {
        EventSourceType: definition.scope.perEventSourceType ? '*' : '',
        EventStreamType: definition.scope.perEventStreamType ? '*' : '',
        EventStreamId: definition.scope.perEventStreamId ? '*' : ''
    })),
    operations: test.isolatedConstraintOperations.map(operation => {
        const events = operation.events.map(entry => {
            const schema = test.eventSchemas[entry.type];
            const properties = Object.keys(schema.properties);
            return {
                EventSourceId: entry.source,
                EventType: { Id: schema.eventTypeId, Generation: 1 },
                Content: JSON.stringify(entry.values ?? (properties.length ? { [properties[0]]: entry.value } : {})),
                EventSourceType: entry.sourceType ?? operation.options?.sourceType,
                EventStreamType: entry.streamType ?? operation.options?.streamType,
                EventStreamId: entry.streamId ?? operation.options?.streamId,
                Subject: entry.source,
                Tags: []
            };
        });
        const common = { EventStore: 'test-event-store', Namespace: 'default', EventSequenceId: 'event-log' };
        return operation.mode === 'single'
            ? encode(AppendRequest, { ...common, ...events[0] })
            : encode(AppendManyForEventSourcesRequest, { ...common, Events: events });
    })
}));
process.stdout.write(JSON.stringify(cases));

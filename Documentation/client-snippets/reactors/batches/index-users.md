```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BatchContext, EventBatch, EventContext, eventType, observes, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class UserRegistered {
    @field(String) readonly name: string;

    constructor(name: string = '') {
        this.name = name;
    }
}

@eventType()
class UserRenamed {
    @field(String) readonly newName: string;

    constructor(newName: string = '') {
        this.newName = newName;
    }
}

@eventType()
class UserEmailChanged {
    @field(String) readonly email: string;

    constructor(email: string = '') {
        this.email = email;
    }
}

interface UserDocument {
    readonly id: string;
    readonly name: string;
}

interface BulkUpsertResponse {
    readonly failures: readonly { readonly eventSourceId: string; readonly error: Error }[];
    readonly throttled: readonly { readonly eventSourceId: string; readonly retryAfterMilliseconds: number }[];
}

interface ISearchIndex {
    bulkUpsert(documents: readonly UserDocument[], signal: AbortSignal): Promise<BulkUpsertResponse>;
}

interface IEmailConfirmations {
    send(accountId: string, email: string): Promise<void>;
}

@reactor('users')
class Users {
    constructor(private readonly index: ISearchIndex, private readonly confirmations: IEmailConfirmations) {}

    @observes(UserRegistered)
    @observes(UserRenamed)
    async indexUsers(batch: EventBatch, context: BatchContext): Promise<void> {
        const documents = batch.events.map(entry => {
            if (entry.is(UserRegistered)) return { id: entry.context.eventSourceId, name: entry.event.name };
            if (entry.is(UserRenamed)) return { id: entry.context.eventSourceId, name: entry.event.newName };
            throw new Error(`Unknown user event: ${entry.context.eventType.id.value}`);
        });

        const response = await this.index.bulkUpsert(documents, context.signal);

        for (const failure of response.failures) {
            batch.fail(failure.eventSourceId, failure.error);
        }

        for (const throttled of response.throttled) {
            batch.defer(throttled.eventSourceId, throttled.retryAfterMilliseconds);
        }
    }

    async userEmailChanged(event: UserEmailChanged, context: EventContext): Promise<void> {
        await this.confirmations.send(context.eventSourceId, event.email);
    }
}
```

The methods named after an event type, such as `userEmailChanged`, stay per-event handlers. A method with
`@observes` is a batch method, and an event type reaches exactly one of them. Events in a batch carry their JSON
content; use `entry.is(EventType)` or `batch.ofType(EventType)` to narrow them. Construct the reactor with its
dependencies through your client artifact activator.

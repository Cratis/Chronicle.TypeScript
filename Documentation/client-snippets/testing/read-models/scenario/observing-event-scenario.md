```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';
import { EventScenario, ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingCompositionAuthorRegistered {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@fromEvent(TestingCompositionAuthorRegistered)
class TestingCompositionAuthor {
    @field(String) id = '';
    @field(String) name = '';
}

const compositionEvents = new EventScenario({ artifacts: { eventTypes: [TestingCompositionAuthorRegistered] } });
const compositionAuthors = new ReadModelScenario(TestingCompositionAuthor).observe(compositionEvents);

await compositionEvents.given.forEventSource('author-1').events(new TestingCompositionAuthorRegistered('Ursula'));
await compositionEvents.when.forEventSource('author-2').events(new TestingCompositionAuthorRegistered('Octavia'));

const compositionAuthor = await compositionAuthors.instanceForEventSourceId('author-2');
if (compositionAuthor?.name !== 'Octavia') throw new Error('Expected the appended author');
```

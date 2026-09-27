```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingIndexAuthorRegistered {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@fromEvent(TestingIndexAuthorRegistered)
class TestingIndexAuthor {
    @field(String) id = '';
    @field(String) name = '';
}

const testingIndexScenario = new ReadModelScenario(TestingIndexAuthor);
testingIndexScenario.given.forEventSource('author-1').events(new TestingIndexAuthorRegistered('Jane Austen'));
const testingIndexAuthor = await testingIndexScenario.instance;
if (testingIndexAuthor?.name !== 'Jane Austen') throw new Error('Expected the registered author name');
```

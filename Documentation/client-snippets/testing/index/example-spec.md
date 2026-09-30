```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class AuthorRegistered {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@fromEvent(AuthorRegistered)
class Author {
    @field(String) id = '';
    @field(String) name = '';
}

const authorScenario = new ReadModelScenario(Author);
authorScenario.given.forEventSource('author-1').events(new AuthorRegistered('Jane Austen'));
const projectedAuthor = await authorScenario.instance;
if (projectedAuthor?.name !== 'Jane Austen') throw new Error('Expected the registered author name');
```

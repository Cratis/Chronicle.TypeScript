```typescript title="The projection - builds queryable state"
import { fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@fromEvent(TestEvent)
export class TestProjection {
    // @field lets the client read the property back when you query the read model.
    @field(String) message = '';
}
```

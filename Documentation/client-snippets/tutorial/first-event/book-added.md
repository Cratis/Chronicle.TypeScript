```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class BookAdded {
    @field(String) title: string;
    @field(String) isbn: string;

    constructor(title: string, isbn: string) {
        this.title = title;
        this.isbn = isbn;
    }
}
```

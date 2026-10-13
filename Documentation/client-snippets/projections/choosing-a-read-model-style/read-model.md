```typescript
import { pii } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ChoosingStyleBookStatus {
    id = '';
    @field(String) title: string | null = null;
    @field(String) isbn: string | null = null;
    isBorrowed = false;
    @pii() @field(String) borrowedBy: string | null = null;
}
```

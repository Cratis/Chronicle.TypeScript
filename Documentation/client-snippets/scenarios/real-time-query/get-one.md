```typescript
import { IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ScenariosQueryBook {
    @field(String) readonly title: string;
    @field(Boolean) readonly onLoan: boolean;

    constructor(title: string, onLoan: boolean) {
        this.title = title;
        this.onLoan = onLoan;
    }
}

class ScenariosQueryBookService {
    constructor(private readonly store: IEventStore) {}

    async getBook(bookId: string): Promise<ScenariosQueryBook | null> {
        return this.store.readModels.findInstanceById(ScenariosQueryBook, bookId);
    }
}
```

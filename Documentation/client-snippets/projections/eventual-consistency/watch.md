```typescript
import { eventType, Guid, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EcWatchBookCreated {
    @field(String) readonly title: string;
    @field(String) readonly author: string;

    constructor(title: string, author: string) {
        this.title = title;
        this.author = author;
    }
}

class EcWatchBookInventory {
    id: string = '';
    title: string = '';
    author: string = '';
}

class EcWatchBookService {
    constructor(private readonly store: IEventStore) {}

    watchBookChanges() {
        return this.store.readModels.watch(EcWatchBookInventory);
    }

    async createBookAndWatch(title: string, author: string): Promise<void> {
        const bookId = Guid.create().toString();

        const watcher = this.store.readModels.watch(EcWatchBookInventory);
        try {
            // Wait for the kernel's acknowledgment before appending to avoid missing the update.
            await watcher.subscribed;
            await this.store.eventLog.append(bookId, new EcWatchBookCreated(title, author));
            for await (const changeset of watcher) {
                if (changeset.key === bookId) {
                    console.log(`Book projection updated: ${changeset.readModel.title}`);
                    break;
                }
            }
        } finally {
            watcher.dispose();
        }
    }
}
```

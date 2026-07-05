```typescript
import { eventType, Guid, IEventStore } from '@cratis/chronicle';

@eventType()
class EcWatchBookCreated {
    constructor(readonly title: string, readonly author: string) {}
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

        // Start watching before appending so the update is observed once the projection catches up
        const watchBook = async () => {
            for await (const changeset of this.store.readModels.watch(EcWatchBookInventory)) {
                if (changeset.key === bookId) {
                    console.log(`Book projection updated: ${changeset.readModel.title}`);
                    break;
                }
            }
        };
        const watching = watchBook();

        await this.store.eventLog.append(bookId, new EcWatchBookCreated(title, author));
        await watching;
    }
}
```

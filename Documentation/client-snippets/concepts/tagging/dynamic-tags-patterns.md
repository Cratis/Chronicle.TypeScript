```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class TaggingDynamicTagsEventOccurred {
    constructor(readonly data: string) {}
}

class TaggingDynamicTagsService {
    constructor(private readonly store: IEventStore) {}

    async recordProductionCritical(eventSourceId: string): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new TaggingDynamicTagsEventOccurred('production issue'),
            { tags: ['production', 'critical'] });
    }

    async recordDevelopmentTest(eventSourceId: string): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new TaggingDynamicTagsEventOccurred('test run'),
            { tags: ['development', 'testing'] });
    }

    async recordBatchMigration(eventSourceId: string): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new TaggingDynamicTagsEventOccurred('batch migration'),
            { tags: ['migration', 'batch-process'] });
    }
}
```

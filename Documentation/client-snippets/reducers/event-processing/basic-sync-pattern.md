```typescript
interface EventProcessingBasicSyncPattern<TReadModel, TEvent> {
    // Process event and return new state
    process(event: TEvent, current: TReadModel | undefined): TReadModel;
}
```

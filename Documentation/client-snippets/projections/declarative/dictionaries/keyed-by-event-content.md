```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecDictionarySeriesAssigned {
    slot = '';
    seriesId = '';
}

@eventType()
class DecDictionarySlotCleared {
    slot = '';
}

class DecDictionarySchedule {
    seriesBySlot: Record<string, string> = {};
}

@projection()
class DecDictionaryScheduleProjection implements IProjectionFor<DecDictionarySchedule> {
    define(builder: IProjectionBuilderFor<DecDictionarySchedule>): void {
        builder
            .from(DecDictionarySeriesAssigned, _ => _
                .set(m => m.seriesBySlot, e => e.slot).to(e => e.seriesId))
            .from(DecDictionarySlotCleared, _ => _
                .removeKey(m => m.seriesBySlot, e => e.slot));
    }
}
```

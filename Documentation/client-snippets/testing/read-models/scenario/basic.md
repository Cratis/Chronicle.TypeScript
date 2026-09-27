```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingScenarioValueRecorded {
    @field(String) value: string;
    constructor(value: string) { this.value = value; }
}

@eventType()
class TestingScenarioUnrelatedEvent {
    @field(Number) value: number;
    constructor(value: number) { this.value = value; }
}

@fromEvent(TestingScenarioValueRecorded)
class TestingScenarioValueModel {
    @field(String) id = '';
    @field(String) value = '';
}

const basicReadModelScenario = new ReadModelScenario(TestingScenarioValueModel);
basicReadModelScenario.given.forEventSource('item-1').events(
    new TestingScenarioValueRecorded('expected value'), new TestingScenarioUnrelatedEvent(42)
);
const basicReadModel = await basicReadModelScenario.instance;
if (basicReadModel?.value !== 'expected value') throw new Error('Expected the recorded value');
```

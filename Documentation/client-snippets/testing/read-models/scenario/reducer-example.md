```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reducer } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingScenarioOrderCreated {
    @field(String) orderId: string;
    constructor(orderId: string) { this.orderId = orderId; }
}

@eventType()
class TestingScenarioItemAdded {
    @field(Number) price: number;
    constructor(price: number) { this.price = price; }
}

class TestingScenarioOrderSummary {
    orderId = '';
    total = 0;
}

@reducer('testing-scenario-order-summary', undefined, TestingScenarioOrderSummary)
class TestingScenarioOrderReducer {
    testingScenarioOrderCreated(event: TestingScenarioOrderCreated): TestingScenarioOrderSummary {
        return { orderId: event.orderId, total: 0 };
    }
    testingScenarioItemAdded(event: TestingScenarioItemAdded, current: TestingScenarioOrderSummary): TestingScenarioOrderSummary {
        return { ...current, total: current.total + event.price };
    }
}

const reducerScenario = new ReadModelScenario(TestingScenarioOrderSummary, {
    eventTypes: [TestingScenarioOrderCreated, TestingScenarioItemAdded],
    reducers: [TestingScenarioOrderReducer], projections: []
});
reducerScenario.given.forEventSource('order-1').events(
    new TestingScenarioOrderCreated('order-1'), new TestingScenarioItemAdded(9.99), new TestingScenarioItemAdded(4.50)
);
const reducerSummary = await reducerScenario.instance;
if (reducerSummary?.total !== 14.49) throw new Error('Expected total 14.49');
```

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingScenarioProductCreated {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@eventType()
class TestingScenarioStockAdjusted {
    @field(Number) newStock: number;
    constructor(newStock: number) { this.newStock = newStock; }
}

class TestingScenarioProductView {
    @field(String) id = '';
    @field(String) name = '';
    @field(Number) stock = 0;
}

@projection('testing-scenario-product-view', TestingScenarioProductView)
class TestingScenarioProductProjection implements IProjectionFor<TestingScenarioProductView> {
    define(builder: IProjectionBuilderFor<TestingScenarioProductView>): void {
        builder.from(TestingScenarioProductCreated, from => from.set(model => model.name).to(event => event.name));
        builder.from(TestingScenarioStockAdjusted, from => from.set(model => model.stock).to(event => event.newStock));
    }
}

const productScenario = new ReadModelScenario(TestingScenarioProductView, {
    eventTypes: [TestingScenarioProductCreated, TestingScenarioStockAdjusted],
    reducers: [], projections: [TestingScenarioProductProjection]
});
productScenario.given.forEventSource('product-1').events(
    new TestingScenarioProductCreated('Widget'), new TestingScenarioStockAdjusted(100)
);
const productView = await productScenario.instance;
if (productView?.name !== 'Widget' || productView.stock !== 100) throw new Error('Expected Widget with stock 100');
```

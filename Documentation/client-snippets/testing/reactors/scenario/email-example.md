```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class OrderShipped {
    @field(String) orderId: string;
    @field(String) carrier: string;
    constructor(orderId: string, carrier: string) { this.orderId = orderId; this.carrier = carrier; }
}
eventType('email-testing-order-shipped')(OrderShipped);
interface EmailService { sendShippingConfirmation(orderId: string, carrier: string): Promise<void>; }
class OrderNotificationReactor {
    constructor(private readonly emailService: EmailService) {}
    async orderShipped(event: OrderShipped): Promise<void> {
        await this.emailService.sendShippingConfirmation(event.orderId, event.carrier);
    }
}
reactor('OrderNotificationReactor')(OrderNotificationReactor);
const confirmations: string[] = [];
const emailScenario = new ReactorScenario(OrderNotificationReactor, {
    artifacts: { eventTypes: [OrderShipped] }, constraints: 'disabled',
    artifactActivator: type => ({ instance: new type({
        sendShippingConfirmation: async (orderId: string, carrier: string) => { confirmations.push(`${orderId}:${carrier}`); }
    }) })
});
await emailScenario.given.forEventSource('order-123').events(new OrderShipped('order-123', 'DHL'));
// confirmations contains 'order-123:DHL'.
```

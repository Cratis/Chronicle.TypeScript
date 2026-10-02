Use an application-owned receipt store and payment gateway, supplied through your client artifact activator.

```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { eventType, handles, reactor, EventContext, ReactorDelivery, ReactorServices } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class IdempotentPaymentDue {
    @field(String) readonly orderId: string;
    @field(Number) readonly amount: number;

    constructor(orderId: string = '', amount: number = 0) {
        this.orderId = orderId;
        this.amount = amount;
    }
}

interface IIdempotentPaymentGateway {
    charge(orderId: string, amount: number): Promise<void>;
}

// Your durable storage, not Chronicle's: one receipt per completed delivery.
interface IDeliveryReceipts {
    hasCompleted(deliveryId: string): Promise<boolean>;
    complete(deliveryId: string): Promise<void>;
}

@reactor('idempotent-billing')
class IdempotentBilling {
    constructor(private readonly payments: IIdempotentPaymentGateway, private readonly receipts: IDeliveryReceipts) {}

    @handles(IdempotentPaymentDue)
    async paymentDue(event: IdempotentPaymentDue, _context: EventContext,
        _services: ReactorServices, delivery: ReactorDelivery): Promise<void> {
        if (await this.receipts.hasCompleted(delivery.id)) return;

        await this.payments.charge(event.orderId, event.amount);
        // A crash before this write can repeat the charge. This is not exactly-once delivery.
        await this.receipts.complete(delivery.id);
    }
}
```

`delivery.id` joins reactor, event store, namespace, event sequence, partition and sequence number with `#`,
matching the .NET receipt key. Retry and replay use the same key. Keep the reactor id explicit and stable.
Chronicle still delivers at least once and stores no receipts. Make the receipt atomic with the effect where
possible; for a remote effect, use a gateway that accepts `delivery.id` as an idempotency key to close the gap.

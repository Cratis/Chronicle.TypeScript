```typescript
enum DecFromEventSequenceOrderStatus {
    Created = 'Created',
    Processing = 'Processing',
    Shipped = 'Shipped',
    Delivered = 'Delivered',
    Cancelled = 'Cancelled'
}

class DecFromEventSequenceOrder {
    orderNumber = '';
    customerId = '';
    totalAmount = 0;
    status = DecFromEventSequenceOrderStatus.Created;
    createdAt = new Date();
    shippedAt: Date | null = null;
}
```

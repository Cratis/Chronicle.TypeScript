```typescript
class DecEventContextUserActivity {
    userId = '';
    lastLogin = new Date();
    lastActivity = new Date();
}

class DecEventContextAuditEntry {
    eventId: bigint = 0n;
    occurredAt = new Date();
    correlationId = '';
    actionType = '';
    userId = '';
}
```

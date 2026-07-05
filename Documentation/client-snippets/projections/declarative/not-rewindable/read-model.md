```typescript
class DecNotRewindableAuditLogEntry {
    userId = '';
    action = '';
    details = '';
    occurredAt = new Date();
    processedAt = new Date();
    sequenceNumber: bigint = 0n;
}
```

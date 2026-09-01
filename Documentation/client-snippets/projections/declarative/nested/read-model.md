```typescript
class CommandItemForNestedCommand {
    name = '';
    schema = '';
}

class SliceWithNestedCommand {
    name = '';
    command: CommandItemForNestedCommand | null = null;
}
```

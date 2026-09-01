```typescript
import { EventContext } from '@cratis/chronicle';

interface ReactorHandlerSignatures<TEvent, TResult> {
    methodName(event: TEvent): void;
    methodName(event: TEvent, context: EventContext): void;

    methodNameAsync(event: TEvent): Promise<void>;
    methodNameAsync(event: TEvent, context: EventContext): Promise<void>;

    methodNameReturningAsync(event: TEvent): Promise<TResult>;
    methodNameReturningAsync(event: TEvent, context: EventContext): Promise<TResult>;

    methodNameReturning(event: TEvent): TResult;
    methodNameReturning(event: TEvent, context: EventContext): TResult;
}
```

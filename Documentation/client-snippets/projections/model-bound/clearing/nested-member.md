```typescript title="Clear one member of a nested object, or the whole object"
import { clearWith, eventType, fromEvent, Guid, nested, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MbClearingContractSigned {
    @field(String) readonly title: string;
    @field(String) readonly noticeGiven: string;

    constructor(title: string, noticeGiven: string) {
        this.title = title;
        this.noticeGiven = noticeGiven;
    }
}

@eventType()
class MbClearingNoticeWithdrawn {}

@eventType()
class MbClearingContractEnded {}

@fromEvent(MbClearingContractSigned)
class MbClearingContract {
    title = '';

    // Clears this member of the nested object; the object itself stays.
    @field(String) @setValue(MbClearingNoticeWithdrawn, null)
    noticeGiven: string | null = null;
}

@fromEvent(MbClearingContractSigned)
class MbClearingEmployee {
    id: Guid = Guid.empty;

    // Clears the whole nested object back to null.
    @field(MbClearingContract) @nested @clearWith(MbClearingContractEnded)
    contract: MbClearingContract | null = null;
}
```

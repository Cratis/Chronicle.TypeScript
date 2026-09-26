```typescript title="Clear at the root, on a child and inside a nested object"
import { eventType, Guid, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MbClearingFluentNoted {
    @field(String) readonly note: string;
    constructor(note: string) { this.note = note; }
}

@eventType()
class MbClearingFluentNoteCleared {}

@eventType()
class MbClearingFluentSummarised {
    @field(String) readonly headline: string;
    @field(String) readonly note: string;
    constructor(headline: string, note: string) {
        this.headline = headline;
        this.note = note;
    }
}

@eventType()
class MbClearingFluentSummaryNoteCleared {}

@eventType()
class MbClearingFluentTaskAdded {
    @field(Guid) readonly taskId: Guid;
    @field(String) readonly title: string;
    @field(String) readonly note: string;
    constructor(taskId: Guid, title: string, note: string) {
        this.taskId = taskId;
        this.title = title;
        this.note = note;
    }
}

@eventType()
class MbClearingFluentTaskNoteCleared {
    @field(Guid) readonly taskId: Guid;
    constructor(taskId: Guid) { this.taskId = taskId; }
}

class MbClearingFluentSummary {
    headline = '';
    note: string | null = null;
}

class MbClearingFluentTask {
    id: Guid = Guid.empty;
    title = '';
    note: string | null = null;
}

class MbClearingFluentProject {
    id: Guid = Guid.empty;
    note: string | null = null;
    summary: MbClearingFluentSummary | null = null;
    tasks: MbClearingFluentTask[] = [];
}

@projection()
class MbClearingFluentProjectProjection implements IProjectionFor<MbClearingFluentProject> {
    define(builder: IProjectionBuilderFor<MbClearingFluentProject>): void {
        builder
            .from(MbClearingFluentNoted, _ => _
                .set(m => m.note).to(e => e.note))
            .from(MbClearingFluentNoteCleared, _ => _
                .set(m => m.note).toValue(null))
            .nested<MbClearingFluentSummary>(m => m.summary, summary => summary
                .from(MbClearingFluentSummarised, _ => _
                    .set(m => m.headline).to(e => e.headline)
                    .set(m => m.note).to(e => e.note))
                .from(MbClearingFluentSummaryNoteCleared, _ => _
                    .set(m => m.note).toValue(null)))
            .children<MbClearingFluentTask>(m => m.tasks, tasks => tasks
                .identifiedBy(m => m.id)
                .from(MbClearingFluentTaskAdded, _ => _
                    .usingKey(e => e.taskId)
                    .set(m => m.title).to(e => e.title)
                    .set(m => m.note).to(e => e.note))
                .from(MbClearingFluentTaskNoteCleared, _ => _
                    .usingKey(e => e.taskId)
                    .set(m => m.note).toValue(null)));
    }
}
```

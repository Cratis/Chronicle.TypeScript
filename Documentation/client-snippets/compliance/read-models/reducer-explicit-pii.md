```typescript
import { eventType, pii, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ComplianceReadModelsPatientAdmitted {
    @field(String) readonly name: string;
    @field(Date) readonly admittedAt: Date;

    constructor(name: string, admittedAt: Date) {
        this.name = name;
        this.admittedAt = admittedAt;
    }
}

// Reducer-backed read models do not inherit PII lineage from the source event automatically -
// mark the property explicitly.
class ComplianceReadModelsPatientSummary {
    @pii() name = '';
    lastAdmittedAt = new Date();
}

@reducer('PatientSummaryReducer', undefined, ComplianceReadModelsPatientSummary)
class ComplianceReadModelsPatientSummaryReducer {
    async patientAdmitted(
        event: ComplianceReadModelsPatientAdmitted,
        current?: ComplianceReadModelsPatientSummary
    ): Promise<ComplianceReadModelsPatientSummary> {
        return { name: event.name, lastAdmittedAt: event.admittedAt };
    }
}
```

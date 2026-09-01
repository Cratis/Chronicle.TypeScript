```typescript
import { eventType, pii, reducer } from '@cratis/chronicle';

@eventType()
class ComplianceReadModelsPatientAdmitted {
    constructor(readonly name: string, readonly admittedAt: Date) {}
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

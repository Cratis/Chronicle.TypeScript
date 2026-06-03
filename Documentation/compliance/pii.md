# PII (Personal Identifiable Information)

The `@pii` decorator is used to mark properties or types that contain Personal Identifiable Information according to the GDPR definition. When a property or type is decorated with `@pii`, the Chronicle Kernel automatically encrypts the value to ensure compliance with data protection regulations.

## Overview

Personal Identifiable Information (PII) is any data that could potentially identify a specific individual. Under GDPR, this data requires special protection and handling.

The `@pii` decorator:
- Marks a property or type as containing PII
- Adds compliance metadata to the JSON schema
- Triggers automatic encryption by the Chronicle Kernel
- Can include optional details explaining the classification
- Works as both a property decorator and class decorator

## Usage

### Property-Level PII Marking

Apply the `@pii` decorator to any property that contains personally identifiable information:

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class Employee {
    id: string = '';
    
    @pii()
    ssn: string = '';
    
    @pii()
    email: string = '';
    
    name: string = '';
}
```

### Type-Level PII Marking

You can also mark entire types (classes) as containing PII. This is particularly useful with domain value objects and ConceptAs types:

```typescript
import { pii } from '@cratis/chronicle';

// Mark a type as PII
@pii('Customer email address')
class CustomerEmail {
    constructor(public value: string) {}
}

// Once ConceptAs is available in @cratis/fundamentals:
@pii('Customer email address')
class CustomerEmailConcept extends ConceptAs<string> {}
export type CustomerEmail = CustomerEmailConcept | string;
```

When using type-level PII marking, all properties of that type automatically inherit the PII classification in the schema.

### Checking if a Type is PII

You can programmatically check if a type has been marked as PII:

```typescript
import { isPII, getTypePIIMetadata } from '@cratis/chronicle/compliance';

// Check if a type is marked as PII
if (isPII(CustomerEmail)) {
    console.log('CustomerEmail is PII');
}

// Get the PII metadata for a type
const metadata = getTypePIIMetadata(CustomerEmail);
console.log(metadata?.details); // "Customer email address"
```

### With Details

It's recommended to provide details explaining why a property or type is classified as PII:

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class Employee {
    id: string = '';
    
    @pii('Employee social security number')
    ssn: string = '';
    
    @pii('Personal email address')
    email: string = '';
    
    @pii('Direct phone contact')
    phoneNumber: string = '';
    
    name: string = '';
}
```

The details parameter serves as documentation and helps during compliance audits.

## What Qualifies as PII?

Under GDPR, PII includes (but is not limited to):

### Direct Identifiers
- Full name
- Social security number
- Passport number
- Driver's license number
- Credit card number
- Email address (when it contains a real name)
- Telephone number

### Indirect Identifiers
- IP address
- MAC address
- Device identifiers
- Cookie identifiers
- Location data
- Biometric data
- Health information

### Special Categories
Some PII is considered "special category" and requires extra protection:
- Racial or ethnic origin
- Political opinions
- Religious or philosophical beliefs
- Trade union membership
- Genetic data
- Biometric data for identification
- Health data
- Data concerning sex life or sexual orientation

## How PII Protection Works

1. **Decoration**: You apply the `@pii` decorator to properties containing PII
2. **Schema Generation**: The compliance metadata is added to the JSON schema
3. **Transmission**: The schema is sent to the Chronicle Kernel during read model registration
4. **Encryption**: The Kernel encrypts PII property values before storing them
5. **Access**: Decryption only occurs when explicitly requested (future feature)

## Examples

### User Profile

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class UserProfile {
    id: string = '';
    
    @pii('User full name')
    fullName: string = '';
    
    @pii('Primary contact email')
    email: string = '';
    
    @pii('Primary contact phone')
    phone: string = '';
    
    @pii('Home address')
    address: string = '';
    
    // Not PII - public username
    username: string = '';
    
    // Not PII - preference setting
    theme: string = '';
}
```

### Healthcare Record

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class PatientRecord {
    id: string = '';
    
    @pii('Patient full name')
    patientName: string = '';
    
    @pii('Date of birth')
    dateOfBirth: string = '';
    
    @pii('Medical record number')
    medicalRecordNumber: string = '';
    
    @pii('Diagnosis information')
    diagnosis: string = '';
    
    // Not PII - anonymized statistics
    visitCount: number = 0;
}
```

### Event with PII

```typescript
import { eventType, pii } from '@cratis/chronicle';

@eventType()
class UserRegistered {
    constructor(
        public userId: string,
        @pii('User email address') public email: string,
        @pii('User full name') public fullName: string,
        public username: string
    ) {}
}
```

Note: While you can use `@pii` on events, remember that events are immutable. The decorator ensures the PII is marked in schemas, but consider carefully whether PII belongs in your event stream.

## Best Practices

### DO:
- ✅ Mark all properties that contain any form of personally identifiable information
- ✅ Provide clear details explaining why each property is classified as PII
- ✅ Review your PII classifications during code reviews
- ✅ Document your PII classification decisions
- ✅ Be conservative - when in doubt, mark it as PII

### DON'T:
- ❌ Mark non-PII properties just to be safe (this adds unnecessary overhead)
- ❌ Forget to update PII markings when your data model changes
- ❌ Use PII data for non-essential features
- ❌ Log PII data without proper safeguards
- ❌ Assume encrypted PII is "safe" to share widely

## Compliance Considerations

### Data Minimization
Only collect and store PII that is necessary for your application's functionality. Don't mark something as PII if you don't need to collect it in the first place.

### Purpose Limitation
Ensure that PII is only used for the purposes disclosed to the data subject. The details parameter can help document the intended use.

### Storage Limitation
PII should not be kept longer than necessary. Consider implementing data retention policies in conjunction with compliance annotations.

### Right to Erasure
GDPR grants individuals the "right to be forgotten". Chronicle's compliance features support this through:
- Encryption key deletion (making data unrecoverable)
- Event tombstoning for event streams
- Read model session management

## Future Features

The following features are planned for future releases:

- **Release/Decryption**: Methods to decrypt PII properties when needed
- **Subject-based Access**: Decrypt PII based on data subject identity
- **Audit Logging**: Track who accessed PII and when
- **Retention Policies**: Automatic expiration of PII
- **Additional Compliance Types**: Support for other compliance requirements beyond PII

## See Also

- [Compliance Overview](./index.md)
- [Read Models](./read-models.md)

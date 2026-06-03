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
- Enables cross-cutting compliance through type-level marking

## Cross-Cutting Type-Level PII (Recommended Pattern)

The most powerful way to use `@pii` is at the type level. When you mark a type as PII, **all properties of that type automatically inherit the PII classification** - no need to mark individual properties.

This demonstrates the **cross-cutting nature** of the decorator: mark the type once, and the compliance metadata flows automatically from events to read models to queries.

### Example: PII Types Flow from Events to Read Models

```typescript
import { eventType, readModel, reducer, pii } from '@cratis/chronicle';

// Step 1: Define PII types (mark ONCE)
@pii('Customer email address')
class CustomerEmail {
    constructor(public value: string = '') {}
}

@pii('Customer full legal name')
class CustomerFullName {
    constructor(public value: string = '') {}
}

// Step 2: Use in events - PII metadata flows automatically
@eventType()
class CustomerRegistered {
    constructor(
        public customerId: string,
        public email: CustomerEmail,      // Automatically PII
        public fullName: CustomerFullName  // Automatically PII
    ) {}
}

// Step 3: Use in read models - same PII metadata flows automatically
@readModel()
class Customer {
    id: string = '';
    email: CustomerEmail = new CustomerEmail();      // Automatically PII
    fullName: CustomerFullName = new CustomerFullName();  // Automatically PII
    customerNumber: string = '';  // NOT PII
}

// Step 4: Reducer just maps types - compliance handled automatically
@reducer('', undefined, Customer)
class CustomerReducer {
    async customerRegistered(event: CustomerRegistered): Promise<Customer> {
        return {
            id: event.customerId,
            email: event.email,        // PII metadata flows through
            fullName: event.fullName,  // PII metadata flows through
            customerNumber: `CUST-${event.customerId}`
        };
    }
}
```

**Benefits:**
- ✅ Mark PII classification **once** on the type
- ✅ Compliance metadata flows **automatically** through events, read models, and queries
- ✅ No need to remember to mark individual properties
- ✅ Type-safe and refactoring-friendly
- ✅ ConceptAs-ready for future strongly-typed domain identifiers

### ConceptAs-Ready Pattern

Once `ConceptAs` is available in `@cratis/fundamentals`, this pattern works seamlessly:

```typescript
import { ConceptAs } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle';

@pii('Customer email address')
class CustomerEmailConcept extends ConceptAs<string> {}
export type CustomerEmail = CustomerEmailConcept | string;
```

The infrastructure is ready - just swap the type definition when ConceptAs becomes available.

## Usage

### Type-Level PII Marking (Recommended)

Apply the `@pii` decorator to value object types that represent PII:

```typescript
import { pii } from '@cratis/chronicle';

// Define a PII type
@pii('Customer email address')
class CustomerEmail {
    constructor(public value: string = '') {}
}

@pii('Customer full legal name')
class CustomerFullName {
    constructor(public value: string = '') {}
}

// Use in events and read models
@eventType()
class CustomerRegistered {
    constructor(
        public customerId: string,
        public email: CustomerEmail,      // Automatically classified as PII
        public fullName: CustomerFullName // Automatically classified as PII
    ) {}
}

@readModel()
class Customer {
    id: string = '';
    email: CustomerEmail = new CustomerEmail();      // Automatically classified as PII
    fullName: CustomerFullName = new CustomerFullName(); // Automatically classified as PII
}
```

### Property-Level PII Marking (Legacy/Fallback)

For cases where type-level marking isn't practical, you can mark individual properties:

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class Employee {
    id: string = '';
    
    @pii('Employee social security number')
    ssn: string = '';
    
    @pii('Personal email address')
    email: string = '';
    
    name: string = '';
}
```

**Note:** Property-level marking is less maintainable than type-level marking. If you find yourself marking the same property across multiple classes, consider creating a dedicated PII type instead.

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

### Providing Details (Recommended)

Always provide details explaining why a type or property is classified as PII:

```typescript
import { pii } from '@cratis/chronicle';

// Type-level with details (recommended)
@pii('Customer email address for contact and notifications')
class CustomerEmail {
    constructor(public value: string = '') {}
}

@pii('Customer full legal name as registered')
class CustomerFullName {
    constructor(public value: string = '') {}
}

// Property-level with details (fallback)
@readModel()
class Employee {
    id: string = '';
    
    @pii('Employee social security number for tax reporting')
    ssn: string = '';
    
    @pii('Personal email address for HR communications')
    email: string = '';
}
```

The details parameter serves as documentation and helps during compliance audits.

## How PII Protection Works

1. **Decoration**: You apply the `@pii` decorator to types or properties containing PII
2. **Schema Generation**: The compliance metadata is added to the JSON schema
3. **Type Propagation**: For type-level decorators, metadata flows to all properties of that type
4. **Transmission**: The schema is sent to the Chronicle Kernel during read model registration
5. **Encryption**: The Kernel encrypts PII property values before storing them
6. **Access**: Decryption only occurs when explicitly requested (future feature)

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

### User Profile (Type-Level PII)

```typescript
import { eventType, readModel, reducer, pii } from '@cratis/chronicle';

// Define PII types
@pii('User full name')
class UserFullName {
    constructor(public value: string = '') {}
}

@pii('Primary contact email')
class UserEmail {
    constructor(public value: string = '') {}
}

@pii('Primary contact phone')
class UserPhone {
    constructor(public value: string = '') {}
}

@pii('Home address')
class UserAddress {
    constructor(public value: string = '') {}
}

// Event with PII types
@eventType()
class UserRegistered {
    constructor(
        public userId: string,
        public fullName: UserFullName,
        public email: UserEmail,
        public phone: UserPhone
    ) {}
}

// Read model with same PII types
@readModel()
class UserProfile {
    id: string = '';
    fullName: UserFullName = new UserFullName();  // Automatically PII
    email: UserEmail = new UserEmail();            // Automatically PII
    phone: UserPhone = new UserPhone();            // Automatically PII
    address: UserAddress = new UserAddress();      // Automatically PII
    
    // Not PII - public username
    username: string = '';
    
    // Not PII - preference setting
    theme: string = '';
}

// Reducer - PII metadata flows through
@reducer('', undefined, UserProfile)
class UserProfileReducer {
    async userRegistered(event: UserRegistered): Promise<UserProfile> {
        return {
            id: event.userId,
            fullName: event.fullName,  // PII flows through
            email: event.email,        // PII flows through
            phone: event.phone,        // PII flows through
            username: event.userId,
            theme: 'light'
        };
    }
}
```

### Healthcare Record (Type-Level PII)

```typescript
import { eventType, readModel, reducer, pii } from '@cratis/chronicle';

// Define PII types for healthcare
@pii('Patient full name')
class PatientName {
    constructor(public value: string = '') {}
}

@pii('Date of birth')
class DateOfBirth {
    constructor(public value: string = '') {}
}

@pii('Medical record number')
class MedicalRecordNumber {
    constructor(public value: string = '') {}
}

@pii('Diagnosis information')
class DiagnosisInfo {
    constructor(public value: string = '') {}
}

// Event with PII types
@eventType()
class PatientAdmitted {
    constructor(
        public patientId: string,
        public patientName: PatientName,
        public dateOfBirth: DateOfBirth,
        public medicalRecordNumber: MedicalRecordNumber
    ) {}
}

// Read model with same PII types
@readModel()
class PatientRecord {
    id: string = '';
    patientName: PatientName = new PatientName();                     // Automatically PII
    dateOfBirth: DateOfBirth = new DateOfBirth();                     // Automatically PII
    medicalRecordNumber: MedicalRecordNumber = new MedicalRecordNumber(); // Automatically PII
    diagnosis: DiagnosisInfo = new DiagnosisInfo();                   // Automatically PII
    
    // Not PII - anonymized statistics
    visitCount: number = 0;
}
```

### Property-Level PII (Fallback for Simple Cases)

For simple cases where creating types feels like overkill, you can use property-level marking:

```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class SimpleUserRegistered {
    constructor(
        public userId: string,
        @pii('User email address') public email: string,
        @pii('User full name') public fullName: string,
        public username: string  // Not PII
    ) {}
}
```

**Note:** While you can use `@pii` on events (either type-level or property-level), remember that events are immutable. The decorator ensures the PII is marked in schemas, but consider carefully whether PII belongs in your event stream. Using type-level PII allows you to apply the same types across events and read models consistently.

## Best Practices

### DO:
- ✅ **Use type-level `@pii` for cross-cutting compliance** - mark types once, use everywhere
- ✅ **Create dedicated PII types** for common PII patterns (Email, FullName, PhoneNumber, etc.)
- ✅ **Reuse PII types** across events and read models for consistency
- ✅ **Provide clear details** explaining why each type is classified as PII
- ✅ **Review PII classifications** during code reviews
- ✅ **Document PII classification decisions** for compliance audits
- ✅ **Be conservative** - when in doubt, mark it as PII

### DON'T:
- ❌ **Don't repeat property-level `@pii` everywhere** - use type-level instead
- ❌ **Don't mark non-PII properties** just to be safe (this adds unnecessary overhead)
- ❌ **Don't forget to update PII markings** when your data model changes
- ❌ **Don't use PII data** for non-essential features
- ❌ **Don't log PII data** without proper safeguards
- ❌ **Don't assume encrypted PII is "safe"** to share widely

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

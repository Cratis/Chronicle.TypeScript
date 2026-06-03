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

## Cross-Cutting Type-Level PII with ConceptAs (Recommended Pattern)

The most powerful way to use `@pii` is at the type level with ConceptAs. When you mark a ConceptAs type as PII, **all properties of that type automatically inherit the PII classification** - no need to mark individual properties.

This demonstrates the **cross-cutting nature** of the decorator: mark the type once, and the compliance metadata flows automatically from events to read models to queries.

### Example: PII ConceptAs Types Flow from Events to Read Models

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { eventType, readModel, reducer, pii } from '@cratis/chronicle';

// Step 1: Define PII ConceptAs types (mark ONCE)
@pii('Customer email address')
class CustomerEmailConcept extends ConceptAs<string> {}
export type CustomerEmail = CustomerEmailConcept | string;

@pii('Customer full legal name')
class CustomerFullNameConcept extends ConceptAs<string> {}
export type CustomerFullName = CustomerFullNameConcept | string;

// Step 2: Use in events - PII metadata flows automatically
@eventType()
class CustomerRegistered {
    @field(String)
    customerId!: string;
    
    @field(CustomerEmailConcept)
    email!: CustomerEmail;      // Automatically PII
    
    @field(CustomerFullNameConcept)
    fullName!: CustomerFullName;  // Automatically PII
}

// Step 3: Use in read models - same PII metadata flows automatically
@readModel()
class Customer {
    @field(String)
    id: string = '';
    
    @field(CustomerEmailConcept)
    email: CustomerEmail = new CustomerEmailConcept();      // Automatically PII
    
    @field(CustomerFullNameConcept)
    fullName: CustomerFullName = new CustomerFullNameConcept();  // Automatically PII
    
    @field(String)
    customerNumber: string = '';  // NOT PII
}

// Step 4: Reducer just maps types - compliance handled automatically
@reducer('', undefined, Customer)
class CustomerReducer {
    async customerRegistered(event: CustomerRegistered): Promise<Customer> {
        const customer = new Customer();
        customer.id = event.customerId;
        customer.email = event.email;        // PII metadata flows through
        customer.fullName = event.fullName;  // PII metadata flows through
        customer.customerNumber = `CUST-${event.customerId}`;
        return customer;
    }
}
```

**Benefits:**
- ✅ Mark PII classification **once** on the ConceptAs type
- ✅ Compliance metadata flows **automatically** through events, read models, and queries
- ✅ No need to remember to mark individual properties
- ✅ Type-safe and refactoring-friendly with ConceptAs strong typing
- ✅ Proper serialization/deserialization via JsonSerializer and @field decorators
- ✅ Union type exports allow convenient primitive assignment

**Why ConceptAs?**
- **Strong typing**: Prevents mixing up different domain concepts (email vs. phone number)
- **Proper serialization**: JsonSerializer handles ConceptAs types automatically via @field decorators
- **Domain-driven design**: Makes domain concepts explicit in the type system
- **Self-documenting**: Type names reflect ubiquitous language

## Usage

### Type-Level PII Marking with ConceptAs (Recommended)

Apply the `@pii` decorator to ConceptAs types that represent PII:

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { pii, eventType, readModel } from '@cratis/chronicle';

// Define PII ConceptAs types
@pii('Customer email address')
class CustomerEmailConcept extends ConceptAs<string> {}
export type CustomerEmail = CustomerEmailConcept | string;

@pii('Customer full legal name')
class CustomerFullNameConcept extends ConceptAs<string> {}
export type CustomerFullName = CustomerFullNameConcept | string;

// Use in events and read models with @field decorators
@eventType()
class CustomerRegistered {
    @field(String)
    customerId!: string;
    
    @field(CustomerEmailConcept)
    email!: CustomerEmail;      // Automatically classified as PII
    
    @field(CustomerFullNameConcept)
    fullName!: CustomerFullName; // Automatically classified as PII
}

@readModel()
class Customer {
    @field(String)
    id: string = '';
    
    @field(CustomerEmailConcept)
    email: CustomerEmail = new CustomerEmailConcept();      // Automatically classified as PII
    
    @field(CustomerFullNameConcept)
    fullName: CustomerFullName = new CustomerFullNameConcept(); // Automatically classified as PII
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
import { CustomerEmailConcept } from './compliance-types';

// Check if a type is marked as PII
if (isPII(CustomerEmailConcept)) {
    console.log('CustomerEmailConcept is PII');
}

// Get the PII metadata for a type
const metadata = getTypePIIMetadata(CustomerEmailConcept);
console.log(metadata?.details); // "Customer email address"
```

### Providing Details (Recommended)

Always provide details explaining why a type or property is classified as PII:

```typescript
import { ConceptAs } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle';

// Type-level with details (recommended)
@pii('Customer email address for contact and notifications')
class CustomerEmailConcept extends ConceptAs<string> {}
export type CustomerEmail = CustomerEmailConcept | string;

@pii('Customer full legal name as registered')
class CustomerFullNameConcept extends ConceptAs<string> {}
export type CustomerFullName = CustomerFullNameConcept | string;

// Property-level with details (fallback for non-ConceptAs properties)
@readModel()
class Employee {
    @field(String)
    id: string = '';
    
    @pii('Employee social security number for tax reporting')
    @field(String)
    ssn: string = '';
    
    @pii('Personal email address for HR communications')
    @field(String)
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

### User Profile (Type-Level PII with ConceptAs)

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { eventType, readModel, reducer, pii } from '@cratis/chronicle';

// Define PII ConceptAs types
@pii('User full name')
class UserFullNameConcept extends ConceptAs<string> {}
export type UserFullName = UserFullNameConcept | string;

@pii('Primary contact email')
class UserEmailConcept extends ConceptAs<string> {}
export type UserEmail = UserEmailConcept | string;

@pii('Primary contact phone')
class UserPhoneConcept extends ConceptAs<string> {}
export type UserPhone = UserPhoneConcept | string;

@pii('Home address')
class UserAddressConcept extends ConceptAs<string> {}
export type UserAddress = UserAddressConcept | string;

// Event with PII ConceptAs types
@eventType()
class UserRegistered {
    @field(String)
    userId!: string;
    
    @field(UserFullNameConcept)
    fullName!: UserFullName;
    
    @field(UserEmailConcept)
    email!: UserEmail;
    
    @field(UserPhoneConcept)
    phone!: UserPhone;
}

// Read model with same PII ConceptAs types
@readModel()
class UserProfile {
    @field(String)
    id: string = '';
    
    @field(UserFullNameConcept)
    fullName: UserFullName = new UserFullNameConcept();  // Automatically PII
    
    @field(UserEmailConcept)
    email: UserEmail = new UserEmailConcept();            // Automatically PII
    
    @field(UserPhoneConcept)
    phone: UserPhone = new UserPhoneConcept();            // Automatically PII
    
    @field(UserAddressConcept)
    address: UserAddress = new UserAddressConcept();      // Automatically PII
    
    // Not PII - public username
    @field(String)
    username: string = '';
    
    // Not PII - preference setting
    @field(String)
    theme: string = '';
}

// Reducer - PII metadata flows through ConceptAs types
@reducer('', undefined, UserProfile)
class UserProfileReducer {
    async userRegistered(event: UserRegistered): Promise<UserProfile> {
        const profile = new UserProfile();
        profile.id = event.userId;
        profile.fullName = event.fullName;  // PII flows through
        profile.email = event.email;        // PII flows through
        profile.phone = event.phone;        // PII flows through
        profile.username = event.userId;
        profile.theme = 'light';
        return profile;
    }
}
```

### Healthcare Record (Type-Level PII with ConceptAs)

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { eventType, readModel, reducer, pii } from '@cratis/chronicle';

// Define PII ConceptAs types for healthcare
@pii('Patient full name')
class PatientNameConcept extends ConceptAs<string> {}
export type PatientName = PatientNameConcept | string;

@pii('Date of birth')
class DateOfBirthConcept extends ConceptAs<string> {}
export type DateOfBirth = DateOfBirthConcept | string;

@pii('Medical record number')
class MedicalRecordNumberConcept extends ConceptAs<string> {}
export type MedicalRecordNumber = MedicalRecordNumberConcept | string;

@pii('Diagnosis information')
class DiagnosisInfoConcept extends ConceptAs<string> {}
export type DiagnosisInfo = DiagnosisInfoConcept | string;

// Event with PII ConceptAs types
@eventType()
class PatientAdmitted {
    @field(String)
    patientId!: string;
    
    @field(PatientNameConcept)
    patientName!: PatientName;
    
    @field(DateOfBirthConcept)
    dateOfBirth!: DateOfBirth;
    
    @field(MedicalRecordNumberConcept)
    medicalRecordNumber!: MedicalRecordNumber;
}

// Read model with same PII ConceptAs types
@readModel()
class PatientRecord {
    @field(String)
    id: string = '';
    
    @field(PatientNameConcept)
    patientName: PatientName = new PatientNameConcept();                     // Automatically PII
    
    @field(DateOfBirthConcept)
    dateOfBirth: DateOfBirth = new DateOfBirthConcept();                     // Automatically PII
    
    @field(MedicalRecordNumberConcept)
    medicalRecordNumber: MedicalRecordNumber = new MedicalRecordNumberConcept(); // Automatically PII
    
    @field(DiagnosisInfoConcept)
    diagnosis: DiagnosisInfo = new DiagnosisInfoConcept();                   // Automatically PII
    
    // Not PII - anonymized statistics
    @field(Number)
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
- ✅ **Use type-level `@pii` on ConceptAs types for cross-cutting compliance** - mark ConceptAs types once, use everywhere
- ✅ **Create dedicated PII ConceptAs types** for common PII patterns (Email, FullName, PhoneNumber, etc.)
- ✅ **Reuse PII ConceptAs types** across events and read models for consistency
- ✅ **Use @field decorators** to ensure proper JsonSerializer serialization/deserialization
- ✅ **Export ConceptAs as union types** (e.g., `export type Email = EmailConcept | string`) for convenience
- ✅ **Provide clear details** explaining why each type is classified as PII
- ✅ **Review PII classifications** during code reviews
- ✅ **Document PII classification decisions** for compliance audits
- ✅ **Be conservative** - when in doubt, mark it as PII

### DON'T:
- ❌ **Don't repeat property-level `@pii` everywhere** - use type-level ConceptAs instead
- ❌ **Don't forget @field decorators** on ConceptAs properties (serialization won't work properly)
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

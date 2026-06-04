# Compliance

Chronicle TypeScript provides built-in support for compliance requirements, particularly for handling Personal Identifiable Information (PII) according to GDPR definitions. The compliance system ensures that sensitive data is properly marked, encrypted, and managed throughout your application.

## Overview

The compliance support in Chronicle TypeScript includes:

- **Type-level decorators** for marking ConceptAs types as containing sensitive information (recommended)
- **Property-level decorators** for marking individual properties
- **Automatic schema metadata** that informs the Chronicle Kernel about compliance requirements
- **Encryption** of compliance-annotated properties by the Chronicle Kernel
- **Release functionality** for decrypting properties when needed (with proper authorization)

## Why Compliance Matters

When building event-sourced systems, it's crucial to:

1. **Identify sensitive data** - Know which properties contain PII
2. **Protect sensitive data** - Ensure PII is encrypted at rest
3. **Control access** - Only decrypt PII when authorized and necessary
4. **Comply with regulations** - Meet GDPR and other privacy requirements

Chronicle's compliance support handles the technical aspects of these requirements, allowing you to focus on your business logic while maintaining regulatory compliance.

## Key Concepts

### Compliance Metadata

Compliance metadata is information attached to your data structures that describes the compliance requirements. This metadata is:

- Defined using decorators on your TypeScript classes
- Automatically included in JSON schemas sent to the Chronicle Kernel
- Used by the Kernel to apply appropriate encryption and access controls

### Personal Identifiable Information (PII)

PII is any data that can be used to identify an individual person. This includes:

- Names
- Email addresses
- Phone numbers
- Social security numbers
- IP addresses
- And many other types of identifying information

Chronicle provides the `@pii` decorator to mark properties or types containing such information.

## Getting Started

To use compliance features in your Chronicle application:

1. **Import the compliance module and ConceptAs**:

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle/compliance';
```

2. **Define PII ConceptAs types** (recommended approach):

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { readModel, eventType, pii } from '@cratis/chronicle';

// Define PII types once
@pii('Employee social security number')
class EmployeeSSNConcept extends ConceptAs<string> {}
export type EmployeeSSN = EmployeeSSNConcept | string;

@pii('Personal email address')
class EmployeeEmailConcept extends ConceptAs<string> {}
export type EmployeeEmail = EmployeeEmailConcept | string;

// Use in events - PII metadata flows automatically
@eventType()
class EmployeeRegistered {
    @field(String)
    employeeId!: string;
    
    @field(EmployeeSSNConcept)
    ssn!: EmployeeSSN;  // Automatically PII
    
    @field(EmployeeEmailConcept)
    email!: EmployeeEmail;  // Automatically PII
}

// Use in read models - same PII metadata flows automatically
@readModel()
class Employee {
    @field(String)
    id: string = '';
    
    @field(EmployeeSSNConcept)
    ssn: EmployeeSSN = new EmployeeSSNConcept();  // Automatically PII
    
    @field(EmployeeEmailConcept)
    email: EmployeeEmail = new EmployeeEmailConcept();  // Automatically PII
    
    @field(String)
    name: string = '';
}
```

**Benefits of ConceptAs approach:**
- ✅ Mark PII classification once on the type
- ✅ Compliance metadata flows automatically from events to read models
- ✅ Type-safe with strong typing
- ✅ Proper serialization via JsonSerializer
- ✅ Self-documenting code

3. **Register your read models** normally - the compliance metadata is automatically included in the schema sent to the Chronicle Kernel.

4. **Release PII when needed**:

```typescript
// Get instance with encrypted PII
const employee = await eventStore.readModels.getInstanceById(Employee, employeeId);

// Release (decrypt) PII when authorized
const released = await eventStore.readModels.release(Employee, employee);
console.log(released.email); // Decrypted value
```

## Topics

- [PII (Personal Identifiable Information)](./pii.md) - Learn about the `@pii` decorator and the recommended ConceptAs pattern
- [Read Models](./read-models.md) - Understand how compliance works with read models and how to use release functionality

## Important Notes

### Release Functionality

The `release()` and `releaseMany()` methods are now available for decrypting PII properties when you have proper authorization. The Chronicle Kernel uses the `id` property of the read model instance as the subject for decryption, ensuring that you can only decrypt PII for the specific individual you're working with.

### Best Practices

1. **Use ConceptAs types** - Mark PII at the type level with ConceptAs for cross-cutting compliance
2. **Use @field decorators** - Ensure proper serialization with JsonSerializer by decorating all properties with `@field`
3. **Be explicit** - Always provide a details parameter explaining why a type or property is marked as PII
4. **Be minimal** - Only mark types or properties that actually contain PII
5. **Be consistent** - Use the same classification approach (preferably ConceptAs) across your entire application
6. **Review regularly** - Periodically audit your compliance annotations as your data model evolves
7. **Authorize releases** - Only call `release()` when you have proper authorization and a legitimate need to access decrypted PII

## Next Steps

- Learn about the [`@pii` decorator](./pii.md)
- Understand [compliance in read models](./read-models.md)

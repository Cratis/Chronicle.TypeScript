# Compliance

Chronicle TypeScript provides built-in support for compliance requirements, particularly for handling Personal Identifiable Information (PII) according to GDPR definitions. The compliance system ensures that sensitive data is properly marked, encrypted, and managed throughout your application.

## Overview

The compliance support in Chronicle TypeScript includes:

- **Decorators** for marking properties as containing sensitive information
- **Automatic schema metadata** that informs the Chronicle Kernel about compliance requirements
- **Encryption** of compliance-annotated properties by the Chronicle Kernel
- **Release functionality** (coming soon) for decrypting properties when needed

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

Chronicle provides the `@pii` decorator to mark properties containing such information.

## Getting Started

To use compliance features in your Chronicle application:

1. **Import the compliance module**:

```typescript
import { pii } from '@cratis/chronicle/compliance';
```

2. **Decorate properties** with compliance markers:

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

3. **Register your read models** normally - the compliance metadata is automatically included in the schema sent to the Chronicle Kernel.

## Topics

- [PII (Personal Identifiable Information)](./pii.md) - Learn about the `@pii` decorator and how to mark sensitive properties
- [Read Models](./read-models.md) - Understand how compliance works with read models

## Important Notes

### Current Limitations

- **Release functionality** (decryption of PII properties) requires an updated version of the `@cratis/chronicle.contracts` package. This feature will be fully available in a future release.
- Currently, only the `@pii` decorator is supported, but the architecture allows for additional compliance types in the future.

### Best Practices

1. **Be explicit** - Always provide a details parameter explaining why a property is marked as PII
2. **Be minimal** - Only mark properties that actually contain PII
3. **Be consistent** - Use the same classification approach across your entire application
4. **Review regularly** - Periodically audit your compliance annotations as your data model evolves

## Next Steps

- Learn about the [`@pii` decorator](./pii.md)
- Understand [compliance in read models](./read-models.md)

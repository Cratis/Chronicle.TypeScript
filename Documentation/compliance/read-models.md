# Compliance in Read Models

Read models in Chronicle TypeScript fully support compliance features. When you decorate read model properties with `@pii` or other compliance decorators, the compliance metadata is automatically included in the read model schema and enforced by the Chronicle Kernel.

## Overview

Read models are projections of your event stream, and they often contain Personal Identifiable Information (PII) or other sensitive data. Chronicle's compliance support ensures that:

1. **PII is marked** in the read model schema
2. **Encryption is automatic** when the Kernel stores the read model
3. **Decryption is controlled** through the release mechanism (coming soon)
4. **Compliance is transparent** to your application logic

## Decorating Read Models

To add compliance to a read model, simply decorate properties with the appropriate compliance decorators:

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class Employee {
    id: string = '';
    
    @pii('Employee social security number')
    ssn: string = '';
    
    @pii('Personal email address')
    email: string = '';
    
    @pii('Home address')
    address: string = '';
    
    // Not PII
    employeeNumber: string = '';
    department: string = '';
}
```

When this read model is registered with the Chronicle Kernel, the schema includes compliance metadata for the `ssn`, `email`, and `address` properties.

## How It Works

### Schema Generation

When you register a read model, the `JsonSchemaGenerator` processes your class definition:

1. **Discovers decorators**: It finds all `@pii` and other compliance decorators
2. **Collects metadata**: It retrieves the compliance metadata (type and details)
3. **Adds to schema**: It adds a `compliance` array to each property's schema

The resulting JSON schema includes compliance information:

```json
{
    "type": "object",
    "properties": {
        "ssn": {
            "type": "string",
            "compliance": [
                {
                    "metadataType": "cae5580e-83d6-44dc-9d7a-a72e8a2f17d7",
                    "details": "Employee social security number"
                }
            ]
        }
    }
}
```

The `metadataType` GUID identifies the type of compliance (in this case, PII).

### Automatic Encryption

When the Chronicle Kernel receives the read model schema:

1. **Parses compliance metadata**: The Kernel identifies which properties need encryption
2. **Encrypts on write**: When a read model instance is stored, PII properties are encrypted
3. **Stores encrypted**: The encrypted values are stored in MongoDB
4. **Returns encrypted**: When you query the read model, you receive the encrypted values

This encryption is transparent to your application code - you work with plain objects, and the Kernel handles encryption/decryption.

## Release (Decryption)

> **Note**: The release functionality requires an updated version of the `@cratis/chronicle.contracts` package and will be available in a future release.

The "release" mechanism allows you to decrypt PII properties when you have a legitimate need to access them. This is a key part of GDPR compliance: PII should only be decrypted when necessary and authorized.

### Future API

The planned API for releasing PII will look like this:

```typescript
// Get an employee with encrypted PII
const employee = await eventStore.readModels.getInstanceById(Employee, employeeId);
console.log(employee.ssn); // Encrypted value

// Release (decrypt) the PII for this employee
const released = await eventStore.readModels.release(Employee, employee);
console.log(released.ssn); // Decrypted value

// Release multiple instances at once
const employees = await eventStore.readModels.getInstances(Employee);
const releasedEmployees = await eventStore.readModels.releaseMany(Employee, employees);
```

### Subject-based Decryption

The release mechanism uses the concept of a "subject" - the individual whose PII is being decrypted. By convention, Chronicle uses the `id` property as the subject identifier.

When you call `release()`, Chronicle:
1. Extracts the subject from the instance's `id` property
2. Sends a Release request to the Compliance service with the subject
3. The Kernel decrypts only the PII for that specific subject
4. Returns a new instance with decrypted values

This ensures that you can only decrypt PII for the specific individual you're working with, not all PII in your system.

## Examples

### Basic Read Model with PII

```typescript
import { readModel, pii } from '@cratis/chronicle';

@readModel()
class Customer {
    id: string = '';
    
    @pii('Customer full name')
    fullName: string = '';
    
    @pii('Primary email')
    email: string = '';
    
    @pii('Billing address')
    billingAddress: string = '';
    
    @pii('Phone number')
    phone: string = '';
    
    // Not PII
    customerNumber: string = '';
    accountStatus: string = '';
    totalOrders: number = 0;
}

// Usage
const customer = await eventStore.readModels.getInstanceById(Customer, customerId);
// customer.email contains encrypted value

// Future: Decrypt when needed
// const released = await eventStore.readModels.release(Customer, customer);
// released.email contains decrypted value
```

### Projection with PII

When building projections that populate read models with PII, the projection logic remains unchanged:

```typescript
import { 
    readModel, 
    projection, 
    fromEvent, 
    pii 
} from '@cratis/chronicle';

@eventType()
class CustomerRegistered {
    constructor(
        public customerId: string,
        public email: string,
        public fullName: string
    ) {}
}

@eventType()
class CustomerAddressUpdated {
    constructor(
        public customerId: string,
        public address: string
    ) {}
}

@readModel()
@projection()
class Customer {
    id: string = '';
    
    @pii('Customer email')
    @fromEvent(CustomerRegistered, (event, model) => model.email = event.email)
    email: string = '';
    
    @pii('Customer full name')
    @fromEvent(CustomerRegistered, (event, model) => model.fullName = event.fullName)
    fullName: string = '';
    
    @pii('Customer address')
    @fromEvent(CustomerAddressUpdated, (event, model) => model.address = event.address)
    address: string = '';
    
    customerNumber: string = '';
}
```

The projection decorators work normally - the PII metadata is separate and doesn't affect projection behavior.

### Reducer with PII

Similarly, reducers work unchanged with PII-marked properties:

```typescript
import { readModel, reducer, on, pii } from '@cratis/chronicle';

@readModel()
@reducer()
class UserProfile {
    id: string = '';
    
    @pii('User full name')
    fullName: string = '';
    
    @pii('User email')
    email: string = '';
    
    username: string = '';
    
    @on(UserRegistered)
    registered(event: UserRegistered) {
        this.id = event.userId;
        this.fullName = event.fullName;
        this.email = event.email;
        this.username = event.username;
    }
    
    @on(UserEmailChanged)
    emailChanged(event: UserEmailChanged) {
        this.email = event.newEmail;
    }
}
```

## Read Model Sessions

Chronicle read models support sessions, which can be used in conjunction with compliance features:

```typescript
// Create a session for working with PII
const sessionId = 'audit-session-123';
const employee = await eventStore.readModels
    .getInstanceById(Employee, employeeId, sessionId);

// Future: Release PII within the session
// const released = await eventStore.readModels.release(Employee, employee);

// Dehydrate (cleanup) the session when done
await eventStore.readModels.dehydrateSession(sessionId);
```

Sessions allow you to:
- Track access to PII
- Manage temporary decrypted state
- Implement audit logging
- Control data lifetime in memory

## Best Practices

### DO:
- ✅ Mark all PII properties with `@pii` in read models
- ✅ Use sessions when working with decrypted PII
- ✅ Only decrypt PII when necessary for your use case
- ✅ Dehydrate sessions promptly after use
- ✅ Document why each property is marked as PII

### DON'T:
- ❌ Log decrypted PII values
- ❌ Store decrypted PII in client-side storage
- ❌ Pass decrypted PII to third-party services without consent
- ❌ Keep sessions with decrypted PII open longer than necessary
- ❌ Decrypt PII for display purposes without user authorization

## Architecture

### Schema Integration

The compliance metadata flows through the system like this:

```
@pii decorator → TypeIntrospector → JsonSchemaGenerator → Chronicle Kernel
```

1. `@pii` decorator stores metadata using reflect-metadata
2. `TypeIntrospector` tracks the property for schema generation
3. `JsonSchemaGenerator` collects compliance metadata and adds it to the schema
4. The Kernel receives the schema and configures encryption

### Metadata Format

Compliance metadata in the schema follows this structure:

```typescript
{
    metadataType: string,  // GUID identifying the compliance type (e.g., PII)
    details: string        // Human-readable explanation
}
```

This format matches the C# implementation, ensuring consistency across Chronicle clients.

### Type Safety

The compliance decorators are type-safe and work with TypeScript's type system:

```typescript
@readModel()
class Example {
    @pii('Sensitive data')
    sensitiveField: string = '';  // ✅ Works with any type
    
    @pii('Numeric PII')
    numericField: number = 0;     // ✅ Works with numbers
    
    @pii('Complex PII')
    complexField: Address = new Address();  // ✅ Works with objects
}
```

## Troubleshooting

### Metadata Not Appearing in Schema

If compliance metadata isn't appearing in your generated schemas:

1. Ensure you've imported the decorator: `import { pii } from '@cratis/chronicle/compliance';`
2. Verify the decorator is applied correctly: `@pii('details')`
3. Check that `reflect-metadata` is imported at your application entry point
4. Ensure the read model class is decorated with `@readModel()`

### Encryption Not Applied

If the Kernel isn't encrypting PII properties:

1. Verify the compliance metadata is in the schema (check Kernel logs)
2. Ensure you're using a recent version of the Chronicle Kernel that supports compliance
3. Check that the property type is supported by the encryption system

## Future Enhancements

Planned features for read model compliance:

- **Release API**: Full implementation of `release()` and `releaseMany()`
- **Granular decryption**: Decrypt specific properties, not entire instances
- **Access control**: Integration with Chronicle's authorization system
- **Audit trail**: Automatic logging of PII access
- **Retention policies**: Automatic cleanup of PII based on retention rules
- **Anonymization**: Automatic anonymization of expired PII

## See Also

- [Compliance Overview](./index.md)
- [PII Decorator](./pii.md)
- [Read Models Guide](../read-models.md)
- [Projections Guide](../projections.md)
- [Reducers Guide](../reducers.md)

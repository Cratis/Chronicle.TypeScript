// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { field } from '@cratis/fundamentals';
import { readModel, reducer, pii } from '@cratis/chronicle';
import { eventType } from '@cratis/chronicle';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/ComplianceExample' });

/**
 * Temporary placeholder for ConceptAs until @cratis/fundamentals publishes it.
 * 
 * ConceptAs provides strong typing for domain concepts and proper serialization.
 * This placeholder demonstrates the pattern - replace with the official implementation
 * when available in @cratis/fundamentals.
 */
class ConceptAs<T> {
    constructor(public readonly value: T = undefined as any) {}
    
    toString(): string {
        return String(this.value);
    }
    
    valueOf(): T {
        return this.value;
    }
}

/**
 * Customer email address - marked as PII at the type level.
 * 
 * This demonstrates the cross-cutting nature of the @pii decorator with ConceptAs.
 * When you mark a ConceptAs type as PII, any property of this type automatically
 * inherits the PII metadata without needing individual @pii decorators.
 * 
 * The ConceptAs pattern provides:
 * - Strong typing for domain concepts
 * - Proper serialization/deserialization via JsonSerializer
 * - Seamless flow of PII metadata from events to read models
 */
@pii('Customer email address')
class CustomerEmailConcept extends ConceptAs<string> {}
export type CustomerEmail = CustomerEmailConcept | string;

/**
 * Customer full name - marked as PII at the type level.
 */
@pii('Customer full legal name')
class CustomerFullNameConcept extends ConceptAs<string> {}
export type CustomerFullName = CustomerFullNameConcept | string;

/**
 * Customer phone number - marked as PII at the type level.
 */
@pii('Customer phone contact number')
class CustomerPhoneNumberConcept extends ConceptAs<string> {}
export type CustomerPhoneNumber = CustomerPhoneNumberConcept | string;

/**
 * Customer street address - marked as PII at the type level.
 */
@pii('Customer street address')
class CustomerStreetAddressConcept extends ConceptAs<string> {}
export type CustomerStreetAddress = CustomerStreetAddressConcept | string;

/**
 * Customer city - marked as PII at the type level.
 */
@pii('City of residence')
class CustomerCityConcept extends ConceptAs<string> {}
export type CustomerCity = CustomerCityConcept | string;

/**
 * Customer postal code - marked as PII at the type level.
 */
@pii('Postal code')
class CustomerPostalCodeConcept extends ConceptAs<string> {}
export type CustomerPostalCode = CustomerPostalCodeConcept | string;

/**
 * Event representing a customer registration.
 * 
 * Notice how the PII ConceptAs types (CustomerEmail, CustomerFullName, CustomerPhoneNumber)
 * are used directly as property types with @field decorators for proper serialization.
 * The @pii decorator metadata flows automatically from the ConceptAs type definition.
 */
@eventType()
export class CustomerRegistered {
    @field(String)
    customerId!: string;
    
    @field(CustomerEmailConcept)
    email!: CustomerEmail;
    
    @field(CustomerFullNameConcept)
    fullName!: CustomerFullName;
    
    @field(CustomerPhoneNumberConcept)
    phoneNumber!: CustomerPhoneNumber;
}

/**
 * Event representing a customer address update.
 * 
 * The PII ConceptAs types carry their compliance metadata automatically.
 */
@eventType()
export class CustomerAddressUpdated {
    @field(String)
    customerId!: string;
    
    @field(CustomerStreetAddressConcept)
    streetAddress!: CustomerStreetAddress;
    
    @field(CustomerCityConcept)
    city!: CustomerCity;
    
    @field(CustomerPostalCodeConcept)
    postalCode!: CustomerPostalCode;
    
    @field(String)
    country!: string;
}

/**
 * Event representing a customer email update.
 */
@eventType()
export class CustomerEmailUpdated {
    @field(String)
    customerId!: string;
    
    @field(CustomerEmailConcept)
    newEmail!: CustomerEmail;
}

/**
 * Customer read model demonstrating PII compliance features with ConceptAs.
 * 
 * This demonstrates the cross-cutting nature of type-level @pii decorators with ConceptAs:
 * - PII ConceptAs types (CustomerEmail, CustomerFullName, etc.) are used directly as property types
 * - The @pii decorator metadata flows automatically from the ConceptAs type definition
 * - No need to mark individual properties with @pii decorators
 * - The same types flow from events to read models seamlessly
 * - JsonSerializer handles ConceptAs serialization/deserialization automatically via @field decorators
 * 
 * The Chronicle Kernel automatically encrypts properties of PII types
 * to ensure GDPR compliance and data protection.
 */
@readModel()
export class Customer {
    /**
     * Customer identifier (not PII - used as the encryption subject).
     */
    @field(String)
    id: string = '';

    /**
     * Customer full name - automatically PII because of CustomerFullNameConcept type.
     */
    @field(CustomerFullNameConcept)
    fullName: CustomerFullName = new CustomerFullNameConcept();

    /**
     * Primary contact email - automatically PII because of CustomerEmailConcept type.
     */
    @field(CustomerEmailConcept)
    email: CustomerEmail = new CustomerEmailConcept();

    /**
     * Primary phone number - automatically PII because of CustomerPhoneNumberConcept type.
     */
    @field(CustomerPhoneNumberConcept)
    phoneNumber: CustomerPhoneNumber = new CustomerPhoneNumberConcept();

    /**
     * Street address - automatically PII because of CustomerStreetAddressConcept type.
     */
    @field(CustomerStreetAddressConcept)
    streetAddress: CustomerStreetAddress = new CustomerStreetAddressConcept();

    /**
     * City - automatically PII because of CustomerCityConcept type.
     */
    @field(CustomerCityConcept)
    city: CustomerCity = new CustomerCityConcept();

    /**
     * Postal code - automatically PII because of CustomerPostalCodeConcept type.
     */
    @field(CustomerPostalCodeConcept)
    postalCode: CustomerPostalCode = new CustomerPostalCodeConcept();

    /**
     * Country - NOT a PII type, so not encrypted.
     */
    @field(String)
    country: string = '';

    /**
     * Customer number - NOT marked as PII.
     * This is an internal identifier that doesn't directly identify a person.
     */
    @field(String)
    customerNumber: string = '';

    /**
     * Account status - NOT PII.
     */
    @field(String)
    accountStatus: string = 'active';

    /**
     * Total orders - NOT PII (anonymized metric).
     */
    @field(Number)
    totalOrders: number = 0;
}

/**
 * Reducer that builds the Customer read model from events.
 * 
 * Notice how the PII ConceptAs types flow seamlessly from events to the read model.
 * The @pii decorator metadata is preserved automatically through the ConceptAs type system.
 * 
 * The Chronicle Kernel handles encryption/decryption automatically based
 * on the type-level @pii decorators on the ConceptAs types - no additional annotations needed.
 * 
 * JsonSerializer ensures proper serialization/deserialization of ConceptAs instances,
 * converting them to their primitive values when sending to the server and reconstructing
 * them as typed instances when receiving data back.
 * 
 * The @reducer decorator parameters are:
 * - eventStore: '' (empty string = default event store)
 * - namespace: undefined (default namespace)
 * - readModelType: Customer (the read model this reducer produces)
 */
@reducer('', undefined, Customer)
export class CustomerReducer {
    /**
     * Handles customer registration events.
     * 
     * The event already contains typed PII properties (CustomerEmail, CustomerFullName, etc.)
     * which flow directly to the read model without conversion. The ConceptAs types are
     * handled automatically by JsonSerializer.
     */
    async customerRegistered(event: CustomerRegistered): Promise<Customer> {
        logger.info('Handling CustomerRegistered', { 
            customerId: event.customerId,
            // Note: Don't log PII in production!
            email: '***@***' 
        });

        const customer = new Customer();
        customer.id = event.customerId;
        customer.fullName = event.fullName;
        customer.email = event.email;
        customer.phoneNumber = event.phoneNumber;
        customer.customerNumber = `CUST-${event.customerId.substring(0, 8)}`;
        customer.accountStatus = 'active';
        customer.totalOrders = 0;

        return customer;
    }

    /**
     * Handles customer address updates.
     * 
     * The PII ConceptAs types (CustomerStreetAddress, CustomerCity, CustomerPostalCode) 
     * flow automatically from event to read model with proper serialization.
     */
    async customerAddressUpdated(event: CustomerAddressUpdated, state?: Customer): Promise<Customer> {
        logger.info('Handling CustomerAddressUpdated', { 
            customerId: event.customerId,
            city: event.city.toString() 
        });

        if (!state) {
            throw new Error(`Cannot update address for non-existent customer ${event.customerId}`);
        }

        return Object.assign(new Customer(), state, {
            streetAddress: event.streetAddress,
            city: event.city,
            postalCode: event.postalCode,
            country: event.country
        });
    }

    /**
     * Handles customer email updates.
     * 
     * The CustomerEmail ConceptAs type flows automatically from event to read model.
     */
    async customerEmailUpdated(event: CustomerEmailUpdated, state?: Customer): Promise<Customer> {
        logger.info('Handling CustomerEmailUpdated', { 
            customerId: event.customerId 
        });

        if (!state) {
            throw new Error(`Cannot update email for non-existent customer ${event.customerId}`);
        }

        return Object.assign(new Customer(), state, {
            email: event.newEmail
        });
    }
}

/**
 * Example usage demonstrating compliance features with ConceptAs.
 * 
 * This sample demonstrates the cross-cutting nature of type-level @pii decorators on ConceptAs types:
 * 
 * 1. PII ConceptAs types (CustomerEmail, CustomerFullName, etc.) are marked with @pii ONCE
 * 2. These types extend ConceptAs<string> for strong typing and proper serialization
 * 3. These types are used in both events and read models
 * 4. The @pii metadata flows automatically through the ConceptAs type system
 * 5. No need to mark individual properties with @pii decorators
 * 6. The Chronicle Kernel automatically encrypts properties of PII types
 * 7. JsonSerializer ensures proper serialization/deserialization of ConceptAs instances
 * 
 * ConceptAs Benefits:
 * - Strong typing prevents mixing up different domain concepts (e.g., email vs. phone number)
 * - Automatic serialization to primitive values and deserialization back to typed instances
 * - Seamless integration with Chronicle's compliance and encryption features
 * - Self-documenting code with explicit domain types
 * 
 * IMPORTANT: The release() method for decrypting PII is not yet available
 * and requires an updated version of @cratis/chronicle.contracts.
 */
export async function demonstrateCompliance() {
    logger.info('=== Compliance Feature Demonstration with ConceptAs ===');
    logger.info('');
    logger.info('This sample demonstrates Chronicle\'s cross-cutting compliance features with ConceptAs:');
    logger.info('');
    logger.info('1. Type-Level @pii Decorators on ConceptAs:');
    logger.info('   - CustomerEmailConcept, CustomerFullNameConcept, etc. extend ConceptAs<string>');
    logger.info('   - Each ConceptAs class is marked with @pii decorator');
    logger.info('   - Exported as union types for convenient primitive assignment');
    logger.info('   - These types carry their compliance metadata wherever they\'re used');
    logger.info('   - No need to mark individual properties in events or read models');
    logger.info('');
    logger.info('2. Automatic Flow from Events to Read Models:');
    logger.info('   - Events use PII ConceptAs types: CustomerRegistered has CustomerEmail property');
    logger.info('   - Read models use the same PII ConceptAs types: Customer has CustomerEmail property');
    logger.info('   - The @pii metadata flows automatically through the ConceptAs type system');
    logger.info('   - JsonSerializer handles serialization/deserialization automatically');
    logger.info('');
    logger.info('3. Schema Compliance Metadata:');
    logger.info('   - Each PII ConceptAs type includes a compliance array in the JSON schema');
    logger.info('   - The metadataType is the PII GUID: cae5580e-83d6-44dc-9d7a-a72e8a2f17d7');
    logger.info('   - The details field explains why the type is classified as PII');
    logger.info('');
    logger.info('4. ConceptAs Benefits:');
    logger.info('   - Strong typing: email: CustomerEmail vs phoneNumber: CustomerPhoneNumber');
    logger.info('   - Automatic serialization: ConceptAs instances serialize to primitive values');
    logger.info('   - Type safety: prevents mixing up different domain concepts');
    logger.info('   - Self-documenting: explicit domain types make code clear');
    logger.info('');
    logger.info('Future: release() method will allow decrypting PII when authorized');
    logger.info('Example: const decrypted = await eventStore.readModels.release(Customer, encrypted);');
    logger.info('');
}

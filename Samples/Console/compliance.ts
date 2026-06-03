// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { readModel, reducer, pii } from '@cratis/chronicle';
import { eventType } from '@cratis/chronicle';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/ComplianceExample' });

/**
 * Customer email address - marked as PII at the type level.
 * 
 * This demonstrates the cross-cutting nature of the @pii decorator.
 * When you mark a type as PII, any property of this type automatically
 * inherits the PII metadata without needing individual @pii decorators.
 * 
 * This pattern will work seamlessly with ConceptAs once available in @cratis/fundamentals.
 */
@pii('Customer email address')
export class CustomerEmail {
    constructor(public value: string = '') {}

    toString(): string {
        return this.value;
    }
}

/**
 * Customer full name - marked as PII at the type level.
 */
@pii('Customer full legal name')
export class CustomerFullName {
    constructor(public value: string = '') {}

    toString(): string {
        return this.value;
    }
}

/**
 * Customer phone number - marked as PII at the type level.
 */
@pii('Customer phone contact number')
export class CustomerPhoneNumber {
    constructor(public value: string = '') {}

    toString(): string {
        return this.value;
    }
}

/**
 * Customer street address - marked as PII at the type level.
 */
@pii('Customer street address')
export class CustomerStreetAddress {
    constructor(public value: string = '') {}

    toString(): string {
        return this.value;
    }
}

/**
 * Customer city - marked as PII at the type level.
 */
@pii('City of residence')
export class CustomerCity {
    constructor(public value: string = '') {}

    toString(): string {
        return this.value;
    }
}

/**
 * Customer postal code - marked as PII at the type level.
 */
@pii('Postal code')
export class CustomerPostalCode {
    constructor(public value: string = '') {}

    toString(): string {
        return this.value;
    }
}

/**
 * Event representing a customer registration.
 * 
 * Notice how the PII types (CustomerEmail, CustomerFullName, CustomerPhoneNumber)
 * are used directly as property types. The @pii decorator metadata flows
 * automatically from the type definition.
 */
@eventType()
export class CustomerRegistered {
    constructor(
        public customerId: string,
        public email: CustomerEmail,
        public fullName: CustomerFullName,
        public phoneNumber: CustomerPhoneNumber
    ) {}
}

/**
 * Event representing a customer address update.
 * 
 * The PII types carry their compliance metadata automatically.
 */
@eventType()
export class CustomerAddressUpdated {
    constructor(
        public customerId: string,
        public streetAddress: CustomerStreetAddress,
        public city: CustomerCity,
        public postalCode: CustomerPostalCode,
        public country: string
    ) {}
}

/**
 * Event representing a customer email update.
 */
@eventType()
export class CustomerEmailUpdated {
    constructor(
        public customerId: string,
        public newEmail: CustomerEmail
    ) {}
}

/**
 * Customer read model demonstrating PII compliance features.
 * 
 * This demonstrates the cross-cutting nature of type-level @pii decorators:
 * - PII types (CustomerEmail, CustomerFullName, etc.) are used directly as property types
 * - The @pii decorator metadata flows automatically from the type definition
 * - No need to mark individual properties with @pii decorators
 * - The same types flow from events to read models seamlessly
 * 
 * The Chronicle Kernel automatically encrypts properties of PII types
 * to ensure GDPR compliance and data protection.
 */
@readModel()
export class Customer {
    /**
     * Customer identifier (not PII - used as the encryption subject).
     */
    id: string = '';

    /**
     * Customer full name - automatically PII because of CustomerFullName type.
     */
    fullName: CustomerFullName = new CustomerFullName();

    /**
     * Primary contact email - automatically PII because of CustomerEmail type.
     */
    email: CustomerEmail = new CustomerEmail();

    /**
     * Primary phone number - automatically PII because of CustomerPhoneNumber type.
     */
    phoneNumber: CustomerPhoneNumber = new CustomerPhoneNumber();

    /**
     * Street address - automatically PII because of CustomerStreetAddress type.
     */
    streetAddress: CustomerStreetAddress = new CustomerStreetAddress();

    /**
     * City - automatically PII because of CustomerCity type.
     */
    city: CustomerCity = new CustomerCity();

    /**
     * Postal code - automatically PII because of CustomerPostalCode type.
     */
    postalCode: CustomerPostalCode = new CustomerPostalCode();

    /**
     * Country - NOT a PII type, so not encrypted.
     */
    country: string = '';

    /**
     * Customer number - NOT marked as PII.
     * This is an internal identifier that doesn't directly identify a person.
     */
    customerNumber: string = '';

    /**
     * Account status - NOT PII.
     */
    accountStatus: string = 'active';

    /**
     * Total orders - NOT PII (anonymized metric).
     */
    totalOrders: number = 0;
}

/**
 * Reducer that builds the Customer read model from events.
 * 
 * Notice how the PII types flow seamlessly from events to the read model.
 * The @pii decorator metadata is preserved automatically through the type system.
 * 
 * The Chronicle Kernel handles encryption/decryption automatically based
 * on the type-level @pii decorators - no additional annotations needed.
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
     * which flow directly to the read model without conversion.
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
     * The PII types (CustomerStreetAddress, CustomerCity, CustomerPostalCode) 
     * flow automatically from event to read model.
     */
    async customerAddressUpdated(event: CustomerAddressUpdated, state?: Customer): Promise<Customer> {
        logger.info('Handling CustomerAddressUpdated', { 
            customerId: event.customerId,
            city: event.city.value 
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
     * The CustomerEmail type flows automatically from event to read model.
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
 * Example usage demonstrating compliance features.
 * 
 * This sample demonstrates the cross-cutting nature of type-level @pii decorators:
 * 
 * 1. PII types (CustomerEmail, CustomerFullName, etc.) are marked with @pii ONCE
 * 2. These types are used in both events and read models
 * 3. The @pii metadata flows automatically through the type system
 * 4. No need to mark individual properties with @pii decorators
 * 5. The Chronicle Kernel automatically encrypts properties of PII types
 * 
 * This pattern is ConceptAs-ready: once @cratis/fundamentals publishes ConceptAs,
 * you can use ConceptAs<string> with @pii decorator exactly the same way.
 * 
 * IMPORTANT: The release() method for decrypting PII is not yet available
 * and requires an updated version of @cratis/chronicle.contracts.
 */
export async function demonstrateCompliance() {
    logger.info('=== Compliance Feature Demonstration ===');
    logger.info('');
    logger.info('This sample demonstrates Chronicle\'s cross-cutting compliance features:');
    logger.info('');
    logger.info('1. Type-Level @pii Decorators:');
    logger.info('   - CustomerEmail, CustomerFullName, CustomerPhoneNumber, etc. are marked with @pii');
    logger.info('   - These types carry their compliance metadata wherever they\'re used');
    logger.info('   - No need to mark individual properties in events or read models');
    logger.info('');
    logger.info('2. Automatic Flow from Events to Read Models:');
    logger.info('   - Events use PII types: CustomerRegistered has CustomerEmail email property');
    logger.info('   - Read models use the same PII types: Customer has CustomerEmail email property');
    logger.info('   - The @pii metadata flows automatically through the type system');
    logger.info('');
    logger.info('3. Schema Compliance Metadata:');
    logger.info('   - Each PII type includes a compliance array in the JSON schema');
    logger.info('   - The metadataType is the PII GUID: cae5580e-83d6-44dc-9d7a-a72e8a2f17d7');
    logger.info('   - The details field explains why the type is classified as PII');
    logger.info('');
    logger.info('4. ConceptAs-Ready:');
    logger.info('   - This pattern works seamlessly with ConceptAs once available');
    logger.info('   - Use @pii on ConceptAs types for strongly-typed domain identifiers');
    logger.info('   - Example: @pii("Email") class Email extends ConceptAs<string> {}');
    logger.info('');
    logger.info('Future: release() method will allow decrypting PII when authorized');
    logger.info('Example: const decrypted = await eventStore.readModels.release(Customer, encrypted);');
    logger.info('');
}

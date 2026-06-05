// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { ConceptAs, field } from '@cratis/fundamentals';
import { readModel, reducer, pii, IEventStore } from '@cratis/chronicle';
import { eventType } from '@cratis/chronicle';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/ComplianceExample' });

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
class CustomerEmailConcept extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
export type CustomerEmail = CustomerEmailConcept | string;

/**
 * Customer full name - marked as PII at the type level.
 */
@pii('Customer full legal name')
class CustomerFullNameConcept extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
export type CustomerFullName = CustomerFullNameConcept | string;

/**
 * Customer phone number - marked as PII at the type level.
 */
@pii('Customer phone contact number')
class CustomerPhoneNumberConcept extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
export type CustomerPhoneNumber = CustomerPhoneNumberConcept | string;

/**
 * Customer street address - marked as PII at the type level.
 */
@pii('Customer street address')
class CustomerStreetAddressConcept extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
export type CustomerStreetAddress = CustomerStreetAddressConcept | string;

/**
 * Customer city - marked as PII at the type level.
 */
@pii('City of residence')
class CustomerCityConcept extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
export type CustomerCity = CustomerCityConcept | string;

/**
 * Customer postal code - marked as PII at the type level.
 */
@pii('Postal code')
class CustomerPostalCodeConcept extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
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
    fullName: CustomerFullName = '';

    /**
     * Primary contact email - automatically PII because of CustomerEmailConcept type.
     */
    @field(CustomerEmailConcept)
    email: CustomerEmail = '';

    /**
     * Primary phone number - automatically PII because of CustomerPhoneNumberConcept type.
     */
    @field(CustomerPhoneNumberConcept)
    phoneNumber: CustomerPhoneNumber = '';

    /**
     * Street address - automatically PII because of CustomerStreetAddressConcept type.
     */
    @field(CustomerStreetAddressConcept)
    streetAddress: CustomerStreetAddress = '';

    /**
     * City - automatically PII because of CustomerCityConcept type.
     */
    @field(CustomerCityConcept)
    city: CustomerCity = '';

    /**
     * Postal code - automatically PII because of CustomerPostalCodeConcept type.
     */
    @field(CustomerPostalCodeConcept)
    postalCode: CustomerPostalCode = '';

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
 * A fixed customer whose personally identifiable information flows through the
 * PII-typed events and into the encrypted {@link Customer} read model. Using a
 * stable identifier lets us append the events under one key and read the
 * resulting read model back by the same key under another.
 */
export const sampleCustomer = {
    id: 'c0000001-0000-0000-0000-000000000000',
    fullName: 'Eve Jackson',
    email: 'eve.jackson@example.com',
    phoneNumber: '+1-202-555-0143',
    streetAddress: '742 Evergreen Terrace',
    city: 'Springfield',
    postalCode: '49007',
    country: 'USA'
};

/**
 * Appends a sequence of PII-carrying events for the {@link sampleCustomer}.
 *
 * The event properties are typed with @pii ConceptAs types, so when the
 * {@link CustomerReducer} projects them into the {@link Customer} read model the
 * Chronicle Kernel encrypts the PII properties automatically — no per-property
 * annotations are needed at the call site.
 *
 * @param store - The event store to append to.
 */
export async function registerCustomerWithPii(store: IEventStore): Promise<void> {
    const registered = new CustomerRegistered();
    registered.customerId = sampleCustomer.id;
    registered.fullName = sampleCustomer.fullName;
    registered.email = sampleCustomer.email;
    registered.phoneNumber = sampleCustomer.phoneNumber;

    const addressUpdated = new CustomerAddressUpdated();
    addressUpdated.customerId = sampleCustomer.id;
    addressUpdated.streetAddress = sampleCustomer.streetAddress;
    addressUpdated.city = sampleCustomer.city;
    addressUpdated.postalCode = sampleCustomer.postalCode;
    addressUpdated.country = sampleCustomer.country;

    const results = await store.eventLog.appendMany(sampleCustomer.id, [registered, addressUpdated]);
    const failures = results.filter(result => !result.isSuccess);
    if (failures.length > 0) {
        const violations = failures.flatMap(result => result.constraintViolations.map(violation => violation.message));
        console.log(`[pii] Could not register ${sampleCustomer.fullName}: ${violations.join('; ')}`);
        return;
    }

    const lastSequence = results[results.length - 1].sequenceNumber.value;
    console.log(`[pii] Registered ${sampleCustomer.fullName} (${sampleCustomer.id}) with PII events up to sequence ${lastSequence}`);
}

/** Renders a single read model field, falling back to a placeholder when empty. */
const formatField = (label: string, value: unknown, isPii: boolean): string => {
    const text = value?.toString() ?? '';
    const display = text.length > 0 ? text : '(empty)';
    return `  ${label.padEnd(15)}: ${display}${isPii ? '   [PII]' : ''}`;
};

/**
 * Reads the {@link Customer} read model for the {@link sampleCustomer} back via
 * {@link IReadModels.getInstanceById} and prints it in a human-friendly layout.
 *
 * PII properties are encrypted at rest, so the values printed for the [PII]
 * fields are the encrypted representations — exactly what is stored. Decrypting
 * them would go through `store.readModels.release(Customer, instance)`.
 *
 * @param store - The event store to read from.
 */
export async function showCustomerReadModel(store: IEventStore): Promise<void> {
    const customer = await store.readModels.getInstanceById(Customer, sampleCustomer.id);

    if (!customer.id) {
        console.log(`[pii] No Customer read model found for ${sampleCustomer.id}. Append the PII events first.`);
        return;
    }

    console.log([
        `Customer read model for ${customer.id}:`,
        formatField('Full name', customer.fullName, true),
        formatField('Email', customer.email, true),
        formatField('Phone number', customer.phoneNumber, true),
        formatField('Street address', customer.streetAddress, true),
        formatField('City', customer.city, true),
        formatField('Postal code', customer.postalCode, true),
        formatField('Country', customer.country, false),
        formatField('Customer number', customer.customerNumber, false),
        formatField('Account status', customer.accountStatus, false),
        formatField('Total orders', customer.totalOrders, false),
        '  PII fields are stored encrypted at rest — values above are the encrypted form.'
    ].join('\n'));
}

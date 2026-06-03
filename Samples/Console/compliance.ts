// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { readModel, reducer, pii } from '@cratis/chronicle';
import { eventType } from '@cratis/chronicle';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/ComplianceExample' });

/**
 * Event representing a customer registration.
 */
@eventType()
export class CustomerRegistered {
    constructor(
        public customerId: string,
        public email: string,
        public fullName: string,
        public phoneNumber: string
    ) {}
}

/**
 * Event representing a customer address update.
 */
@eventType()
export class CustomerAddressUpdated {
    constructor(
        public customerId: string,
        public streetAddress: string,
        public city: string,
        public postalCode: string,
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
        public newEmail: string
    ) {}
}

/**
 * Customer read model demonstrating PII compliance features.
 * 
 * Properties marked with @pii are automatically encrypted by the Chronicle Kernel
 * to ensure GDPR compliance and data protection.
 */
@readModel()
export class Customer {
    /**
     * Customer identifier (not PII - used as the encryption subject).
     */
    id: string = '';

    /**
     * Customer full name (PII - will be encrypted).
     */
    @pii('Customer full legal name')
    fullName: string = '';

    /**
     * Primary contact email (PII - will be encrypted).
     */
    @pii('Primary email address for customer contact')
    email: string = '';

    /**
     * Primary phone number (PII - will be encrypted).
     */
    @pii('Primary phone contact number')
    phoneNumber: string = '';

    /**
     * Street address (PII - will be encrypted).
     */
    @pii('Customer street address')
    streetAddress: string = '';

    /**
     * City (PII - can identify individual when combined with other data).
     */
    @pii('City of residence')
    city: string = '';

    /**
     * Postal code (PII - can identify individual when combined).
     */
    @pii('Postal code')
    postalCode: string = '';

    /**
     * Country (not typically PII on its own, but including for completeness).
     */
    @pii('Country of residence')
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
 * Note: The reducer methods work with plain property values.
 * The Chronicle Kernel handles encryption/decryption automatically based
 * on the @pii decorators in the read model schema.
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
     */
    async customerAddressUpdated(event: CustomerAddressUpdated, state?: Customer): Promise<Customer> {
        logger.info('Handling CustomerAddressUpdated', { 
            customerId: event.customerId,
            city: event.city 
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
 * IMPORTANT: The release() method for decrypting PII is not yet available
 * and requires an updated version of @cratis/chronicle.contracts.
 */
export async function demonstrateCompliance() {
    logger.info('=== Compliance Feature Demonstration ===');
    logger.info('');
    logger.info('This sample demonstrates Chronicle\'s compliance features:');
    logger.info('1. The Customer read model has properties marked with @pii');
    logger.info('2. These properties (fullName, email, phoneNumber, etc.) will be automatically encrypted');
    logger.info('3. The Chronicle Kernel handles encryption transparently');
    logger.info('4. When you query the Customer read model, PII fields contain encrypted values');
    logger.info('');
    logger.info('Schema compliance metadata:');
    logger.info('- Each @pii property includes a compliance array in the JSON schema');
    logger.info('- The metadataType is the PII GUID: cae5580e-83d6-44dc-9d7a-a72e8a2f17d7');
    logger.info('- The details field explains why the property is classified as PII');
    logger.info('');
    logger.info('Future: release() method will allow decrypting PII when authorized');
    logger.info('Example: const decrypted = await eventStore.readModels.release(Customer, encrypted);');
    logger.info('');
}

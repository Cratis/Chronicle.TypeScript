// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IExternalServiceBuilder } from './IExternalServiceBuilder';

/**
 * Defines a system for working with external service registrations for the Kernel.
 */
export interface IExternalServices {
    /**
     * Registers an external service.
     * @param name - The name of the external service. The name is also used as its identifier.
     * @param configure - Callback for configuring the external service.
     */
    register(name: string, configure: (builder: IExternalServiceBuilder) => void): Promise<void>;
}

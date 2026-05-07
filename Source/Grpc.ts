// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ServiceError, ClientUnaryCall } from '@grpc/grpc-js';

/**
 * Provides utility methods for working with gRPC clients.
 */
export class Grpc {
    /**
     * Promisifies a gRPC unary call that uses a callback-based API.
     * @param callFunction - A function that invokes the gRPC method with a callback.
     * @returns A Promise that resolves with the response or rejects with the service error.
     */
    static call<TResponse>(
        callFunction: (callback: (error: ServiceError | null, response: TResponse) => void) => ClientUnaryCall
    ): Promise<TResponse> {
        return new Promise<TResponse>((resolve, reject) => {
            callFunction((error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

/**
 * Promisifies a gRPC unary call that uses a callback-based API.
 * @param callFunction - A function that invokes the gRPC method with a callback.
 * @returns A Promise that resolves with the response or rejects with the service error.
 */
export function promisifyGrpcCall<TResponse>(
    callFunction: (callback: (error: ServiceError | null, response: TResponse) => void) => ClientUnaryCall
): Promise<TResponse> {
    return Grpc.call(callFunction);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { createSecureContext } from 'node:tls';

/** The connection string options that name TLS material. */
export interface ChronicleTlsMaterialSource {
    readonly caCertificatePath?: string;
    readonly certificatePath?: string;
    readonly certificatePassword?: string;
}

/** The Node TLS options a Chronicle connection hands to its HTTPS clients and gRPC channel. */
export interface ChronicleTlsConnectOptions {
    ca?: Buffer;
    pfx?: Buffer;
    cert?: Buffer;
    key?: Buffer;
    passphrase?: string;
    rejectUnauthorized: boolean;
}

interface ClientIdentity {
    readonly pfx?: Buffer;
    readonly cert?: Buffer;
    readonly key?: Buffer;
    readonly passphrase?: string;
}

const certificateBlock = /-----BEGIN CERTIFICATE-----/;
const privateKeyBlock = /-----BEGIN (?:ENCRYPTED |RSA |EC )?PRIVATE KEY-----/;

function readFile(path: string, description: string): Buffer {
    try {
        return readFileSync(path);
    } catch (error) {
        throw new Error(`Cannot read the ${description} '${path}': ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}

/**
 * The TLS material a connection string names: the client identity from `certificatePath` and the certificate
 * authorities from `caCertificatePath`.
 *
 * It is loaded once when the connection is created, so a missing or unreadable file fails the connection setup
 * instead of every reconnect - and also when validation is skipped or TLS is disabled, so the option cannot lie
 * dormant until validation is switched on.
 */
export class ChronicleTlsMaterial {
    /** No TLS material beyond the platform defaults. */
    static readonly None = new ChronicleTlsMaterial();

    constructor(
        private readonly _certificateAuthorities?: Buffer,
        private readonly _identity?: ClientIdentity
    ) {}

    /** Whether this configures anything beyond the platform defaults. */
    get isEmpty(): boolean {
        return this._certificateAuthorities === undefined && this._identity === undefined;
    }

    /**
     * The options for a Node TLS client. The certificate authorities replace the system trust store, and
     * only when certificate validation is on.
     */
    connectOptions(skipTlsValidation: boolean): ChronicleTlsConnectOptions {
        return {
            ...(!skipTlsValidation && this._certificateAuthorities ? { ca: this._certificateAuthorities } : {}),
            ...this._identity,
            rejectUnauthorized: !skipTlsValidation
        };
    }
}

/**
 * Loads the TLS material `source` names.
 *
 * `caCertificatePath` is a PEM file with one or more certificate authorities. `certificatePath` is a PKCS#12
 * file (`.p12`/`.pfx`), or a PEM file holding the certificate chain and the private key; `certificatePassword`
 * unlocks either.
 * @throws When a file is missing, unreadable or holds no usable material.
 */
export function loadTlsMaterial(source: ChronicleTlsMaterialSource): ChronicleTlsMaterial {
    const authorities = source.caCertificatePath ? loadCertificateAuthorities(source.caCertificatePath) : undefined;
    const identity = source.certificatePath ? loadClientIdentity(source.certificatePath, source.certificatePassword) : undefined;
    return authorities === undefined && identity === undefined ? ChronicleTlsMaterial.None : new ChronicleTlsMaterial(authorities, identity);
}

function loadCertificateAuthorities(path: string): Buffer {
    const contents = readFile(path, 'CA certificate file');
    if (!certificateBlock.test(contents.toString('latin1'))) {
        throw new Error(`The CA certificate file '${path}' does not contain any PEM certificates.`);
    }

    return contents;
}

function loadClientIdentity(path: string, password: string | undefined): ClientIdentity {
    const contents = readFile(path, 'client certificate');
    const text = contents.toString('latin1');
    const isPem = text.includes('-----BEGIN');
    if (isPem && (!certificateBlock.test(text) || !privateKeyBlock.test(text))) {
        throw new Error(`The client certificate '${path}' must hold both a certificate and a private key.`);
    }

    const identity: ClientIdentity = isPem
        ? { cert: contents, key: contents, passphrase: password }
        : { pfx: contents, passphrase: password };

    // Building the context validates the password and that the key belongs to the certificate, now rather
    // than on the first connection attempt.
    try {
        createSecureContext(identity);
    } catch (error) {
        throw new Error(`The client certificate '${path}' could not be loaded: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    return identity;
}

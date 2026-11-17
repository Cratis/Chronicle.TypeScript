// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChronicleConnectionString } from './ChronicleConnectionString.js';
import { loadTlsMaterial } from './ChronicleTlsMaterial.js';
import { fetchOAuthAccessToken } from './fetchOAuthAccessToken.js';

const directory = mkdtempSync(join(tmpdir(), 'chronicle-tls-'));

function hasOpenSsl(): boolean {
    try {
        execFileSync('openssl', ['version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const openSslAvailable = hasOpenSsl();

interface Identity {
    certificate: string;
    key: string;
}

function openssl(...args: string[]): void {
    execFileSync('openssl', args, { cwd: directory, stdio: 'ignore' });
}

/** Generates a self-signed certificate valid for localhost, with its PKCS#8 private key. */
function generateIdentity(name: string): Identity {
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.pem`,
        '-subj', `/CN=${name}`, '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '2');
    return { certificate: join(directory, `${name}.pem`), key: join(directory, `${name}.key`) };
}

function connectionStringFor(options: string): ChronicleConnectionString {
    return new ChronicleConnectionString(`chronicle://localhost:35000?${options}`);
}

describe.skipIf(!openSslAvailable)('ChronicleTlsMaterial', () => {
    let server: { identity: Identity; client: Identity; stranger: Identity };

    beforeAll(() => {
        server = {
            identity: generateIdentity('server'),
            client: generateIdentity('client'),
            stranger: generateIdentity('stranger')
        };
    });

    afterAll(() => rmSync(directory, { recursive: true, force: true }));

    describe('when the connection string names no TLS material', () => {
        it('should be empty', () => expect(loadTlsMaterial(connectionStringFor('skipTlsValidation=false')).isEmpty).toBe(true));
    });

    describe('when the CA certificate file is missing', () => {
        it('should fail even while validation is skipped', () =>
            expect(() => loadTlsMaterial(connectionStringFor('caCertificatePath=%2Fno%2Fsuch.pem'))).toThrow(/Cannot read the CA certificate file/));
    });

    describe('when the CA certificate file holds no certificates', () => {
        it('should fail', () => {
            const path = join(directory, 'empty.pem');
            writeFileSync(path, 'not a certificate');
            expect(() => loadTlsMaterial(connectionStringFor(`caCertificatePath=${encodeURIComponent(path)}`))).toThrow(/does not contain any PEM certificates/);
        });
    });

    describe('when a client certificate is a PKCS#12 file with the wrong password', () => {
        it('should fail', () => {
            openssl('pkcs12', '-export', '-in', 'client.pem', '-inkey', 'client.key', '-out', 'client.p12', '-passout', 'pass:changeit');
            const path = encodeURIComponent(join(directory, 'client.p12'));
            expect(() => loadTlsMaterial(connectionStringFor(`certificatePath=${path}&certificatePassword=wrong`))).toThrow(/could not be loaded/);
            expect(loadTlsMaterial(connectionStringFor(`certificatePath=${path}&certificatePassword=changeit`)).isEmpty).toBe(false);
        });
    });

    describe('when a client certificate is a PEM bundle with the key listed first', () => {
        it('should load', () => {
            const path = join(directory, 'bundle.pem');
            writeFileSync(path, readFileSync(server.client.key, 'latin1') + readFileSync(server.client.certificate, 'latin1'));
            expect(loadTlsMaterial(connectionStringFor(`certificatePath=${encodeURIComponent(path)}`)).isEmpty).toBe(false);
        });
    });

    describe('when a client certificate PEM has no private key', () => {
        it('should fail', () => {
            expect(() => loadTlsMaterial(connectionStringFor(`certificatePath=${encodeURIComponent(server.client.certificate)}`))).toThrow(/both a certificate and a private key/);
        });
    });

    describe('when fetching a token from a TLS server', () => {
        const listen = async (requireClientCertificate: boolean): Promise<{ instance: Server; endpoint: string }> => {
            const instance = createServer({
                key: readFileSync(server.identity.key),
                cert: readFileSync(server.identity.certificate),
                ca: readFileSync(server.client.certificate),
                requestCert: requireClientCertificate,
                rejectUnauthorized: requireClientCertificate
            }, (_request, response) => {
                response.setHeader('content-type', 'application/json');
                response.end(JSON.stringify({ access_token: 'token', expires_in: 3600 }));
            });
            await new Promise<void>(resolve => instance.listen(0, '127.0.0.1', resolve));
            return { instance, endpoint: `https://localhost:${(instance.address() as AddressInfo).port}/connect/token` };
        };

        it('should validate the server against the configured certificate authority', async () => {
            const { instance, endpoint } = await listen(false);
            try {
                const trusted = loadTlsMaterial(connectionStringFor(`caCertificatePath=${encodeURIComponent(server.identity.certificate)}`));
                await expect(fetchOAuthAccessToken(endpoint, 'id', 'secret', false, trusted)).resolves.toMatchObject({ access_token: 'token' });
            } finally {
                instance.close();
            }
        });

        it('should reject a server the configured certificate authority does not vouch for', async () => {
            const { instance, endpoint } = await listen(false);
            try {
                const stranger = loadTlsMaterial(connectionStringFor(`caCertificatePath=${encodeURIComponent(server.stranger.certificate)}`));
                await expect(fetchOAuthAccessToken(endpoint, 'id', 'secret', false, stranger)).rejects.toThrow();
            } finally {
                instance.close();
            }
        });

        it('should ignore the certificate authority while validation is skipped', async () => {
            const { instance, endpoint } = await listen(false);
            try {
                const stranger = loadTlsMaterial(connectionStringFor(`caCertificatePath=${encodeURIComponent(server.stranger.certificate)}`));
                await expect(fetchOAuthAccessToken(endpoint, 'id', 'secret', true, stranger)).resolves.toMatchObject({ access_token: 'token' });
            } finally {
                instance.close();
            }
        });

        it('should present the client certificate to a server that requires one', async () => {
            const { instance, endpoint } = await listen(true);
            try {
                const bundle = join(directory, 'mutual.pem');
                writeFileSync(bundle, readFileSync(server.client.certificate, 'latin1') + readFileSync(server.client.key, 'latin1'));
                const material = loadTlsMaterial(connectionStringFor(`certificatePath=${encodeURIComponent(bundle)}`));
                await expect(fetchOAuthAccessToken(endpoint, 'id', 'secret', true, material)).resolves.toMatchObject({ access_token: 'token' });
                await expect(fetchOAuthAccessToken(endpoint, 'id', 'secret', true)).rejects.toThrow();
            } finally {
                instance.close();
            }
        });
    });
});

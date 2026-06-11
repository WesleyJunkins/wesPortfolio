// archive-crypto.js
// Shared client-side encryption for the archive page.
//
// Security model: the archive's video links are NEVER published in plaintext.
// They live in an encrypted blob (archive-data.enc) that ships in the repo as
// ciphertext only. The password (entered by family on the archive page) is run
// through PBKDF2-SHA256 to derive an AES-256-GCM key that decrypts the blob in
// the browser. Without the password, the published files contain nothing but
// ciphertext.
//
// AES-GCM is authenticated: a wrong password fails the auth-tag check and
// decrypt() throws, so there is no separate password hash to store or leak.
//
// The SAME module is used by encrypt.html (to produce the blob) and by
// archive.js (to consume it), so the wire format can never drift between them.
//
// NOTE: the strength of this scheme rests entirely on the password, because the
// ciphertext is public and brute-forceable offline. Use a real passphrase.

const ArchiveCrypto = (() => {
    // OWASP-recommended PBKDF2-SHA256 work factor. Higher = slower to brute
    // force AND slower to log in; tune here if old devices feel sluggish.
    const ITERATIONS = 600000;

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // --- base64 <-> Uint8Array (binary-safe) ---
    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function deriveKey(password, salt, iterations) {
        const baseKey = await crypto.subtle.importKey(
            'raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt a plaintext string with a password. Returns a JSON string (the
    // blob) that is safe to commit to the repo and serve publicly.
    async function encrypt(plaintext, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt, ITERATIONS);
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, key, textEncoder.encode(plaintext)
        ));
        return JSON.stringify({
            v: 1,
            kdf: 'PBKDF2-SHA256',
            iter: ITERATIONS,
            salt: bytesToBase64(salt),
            iv: bytesToBase64(iv),
            ct: bytesToBase64(ciphertext)
        }, null, 2);
    }

    // Decrypt a blob string with a password. Throws on a wrong password
    // (AES-GCM auth-tag mismatch) or malformed blob.
    async function decrypt(blobString, password) {
        const blob = JSON.parse(blobString);
        const salt = base64ToBytes(blob.salt);
        const iv = base64ToBytes(blob.iv);
        const ciphertext = base64ToBytes(blob.ct);
        const key = await deriveKey(password, salt, blob.iter || ITERATIONS);
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, key, ciphertext
        );
        return textDecoder.decode(plaintext);
    }

    return { encrypt, decrypt, ITERATIONS };
})();

if (typeof window !== 'undefined') window.ArchiveCrypto = ArchiveCrypto;

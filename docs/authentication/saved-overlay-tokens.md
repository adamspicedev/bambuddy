# Saved streaming overlay tokens

Create an overlay token under Settings → API Keys, either in Camera API Tokens or directly in Streaming Overlay. The overlay token selector lists your tokens by name. Select one whenever you configure a browser source, including after reloading or on another device. Copy the resulting overlay URL into OBS. You do not need to keep a separate copy of the token.

Existing tokens created before this feature have only a hash. They keep working in existing browser sources, but cannot be retrieved by the selector. They are marked “Create a replacement”. Create a new token once, update and verify your browser sources, then revoke the old token when it is no longer needed. Replacement never happens automatically.

## Storage and access

New tokens with the `overlay` scope retain an authenticated Fernet-encrypted copy in `long_lived_tokens.encrypted_token`. Every scope still uses its existing password hash for authentication. Camera-stream and Cam Wall tokens remain hash-only. Lists expose metadata and `can_reuse`, never ciphertext or plaintext.

`POST /api/v1/auth/tokens/{id}/overlay-secret` requires an authenticated owner with `camera:view`. Administrators cannot retrieve another user's token. The endpoint rejects revoked, expired and non-overlay tokens, verifies the decrypted value against the authentication hash, and returns `Cache-Control: no-store`. Revoking a token removes its encrypted copy. The browser holds retrieved values only in component memory, masks them by default, and never writes them to browser storage or the query cache.

## Encryption key and backups

This uses Bambuddy's existing encryption key resolver: `MFA_ENCRYPTION_KEY`, or the automatically generated `DATA_DIR/.mfa_encryption_key` file with owner-only permissions. The key is outside the database. Unlike legacy MFA helpers, overlay-token creation fails if encryption is unavailable; plaintext is never stored as a fallback.

Preserve the existing key when migrating or restoring an installation. Full Bambuddy backups already include the file-based key and must therefore be protected as credentials themselves. An environment-provided key must be preserved separately. Losing or changing the key prevents retrieval of previously saved tokens; restoring the correct key restores retrieval. Existing browser-source URLs continue to authenticate against their hashes until expiry or revocation.

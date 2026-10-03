# Streaming overlay token creation and reuse

Create an overlay token under Settings → API Keys, either in Camera API Tokens or directly in Streaming Overlay. The builder uses the one-time creation response. Choose the printer and appearance, then copy the complete URL into OBS before leaving or reloading.

To reuse an existing credential, paste it into **Manual token**, or import its complete browser-source URL with **Existing overlay URL** and choose **Import URL**. Import parses the URL locally and never fetches it. Generated URLs use the current Bambuddy origin; check the printer when importing from another installation. Import supports printer, token, fields, text size, FPS, artwork and camera visibility. Unsupported or invalid options are rejected without changing the current settings; use manual token entry for URLs with other options. The input and displayed output are masked by default, while Copy uses the full usable URL. Credentials remain in component memory and are never saved in browser storage.

## Storage and compatibility

All scopes retain the existing hash-only token model. There is no saved-secret retrieval endpoint and no new encryption or backup-key policy. Existing tokens and browser-source URLs remain valid until expiry or explicit revocation. Nothing is rotated or revoked automatically.

Installations that tested an earlier draft may have an unused encrypted-token column. This revision does not delete existing data or keys. New tokens do not populate encrypted copies, and authentication continues to use existing token hashes. Existing backup and key guidance for other Bambuddy features remains unchanged.

If every copy of a credential has been lost, create a replacement, update and verify its browser sources, then revoke the old token when it is no longer needed. Treat complete source URLs as credentials.

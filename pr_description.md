🔒 Fix Hardcoded Secret and Encryption Keys in Config

🎯 **What:** The vulnerability fixed
The `secret_key` and `encryption_key` in `api/app/config.py` were previously hardcoded with default string values. Pydantic would fallback to these default hardcoded keys if environment variables weren't present.

⚠️ **Risk:** The potential impact if left unfixed
A critical vulnerability where an attacker could forge JSON Web Tokens (JWT) since the signing secret is publicly known in the repository. Additionally, since the `encryption_key` was also hardcoded, attackers could easily decrypt any sensitive data that might be stored using the app's cryptographic functions.

🛡️ **Solution:** How the fix addresses the vulnerability
The default strings have been completely removed from `api/app/config.py`. The keys are now required string parameters without any defaults. Pydantic will raise a `ValidationError` on startup if `SECRET_KEY` and `ENCRYPTION_KEY` are not explicitly defined in the environment. This ensures instances of the API strictly fail securely rather than silently continuing with insecure credentials. Relevant test setups (`api/tests/conftest.py` and `test_smoke.py`) have been updated with explicit dummy keys to prevent tests from breaking.

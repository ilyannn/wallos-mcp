# API Key Retrieval Endpoint

Since Wallos doesn't have a built-in endpoint to retrieve the current user's
API key, we need to use the regenerate endpoint to get a new API key.

The `/endpoints/user/regenerateapikey.php` endpoint:

- Requires session authentication
- Generates a new API key
- Returns the new API key in the response

This is the safest approach since:

1. It requires session authentication (user is logged in)
2. It generates a fresh API key (more secure)
3. It returns the key in the response (no additional query needed)

For our MCP server, when username/password is provided but no API key:

1. Authenticate with session
2. Call regenerateapikey endpoint
3. Use the returned API key for subsequent API calls

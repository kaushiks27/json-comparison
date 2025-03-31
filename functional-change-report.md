# 📋 Functional Change Report


## 🔌 Connector: `okta`

### 🧾 Summary of Changes
- 📦 Output structure changed
- 🆕 actions/createUser.json
- 🔐 Auth change
- 🆕 events/groupAssigned.json
- 🆕 events/userSuspended.json
- 📁 New folder: events
- 📁 Removed folder: meta

### 📂 Actions Changes
✏️ Changed `actions/getUser.description`: `"Retrieves a user's profile."` → `"Retrieves user details including MFA status."`
✏️ Changed `actions/getUser.outputFields`: `["id","email","status"]` → `["id","email","status","mfaEnabled"]`
🆕 New file: `actions/createUser.json`

### 📂 Auth Changes
✏️ Changed `auth/auth.type`: `"OAuth2"` → `"API Key"`
❌ Removed `auth/auth.tokenUrl` (was `"https://okta.com/oauth2/token"`)
➕ Added `auth/auth.keyName` with value `"Authorization"`
➕ Added `auth/auth.location` with value `"header"`

### 📂 Events Changes
🆕 New file: `events/groupAssigned.json`
🆕 New file: `events/userSuspended.json`
📁 New folder added: `events/`

### 📂 Meta Changes
📁 Folder removed: `meta/`

### 📂 Metadata Changes
✏️ Changed `metadata/manifest.version`: `"1.0.0"` → `"1.1.0"`
✏️ Changed `metadata/manifest.categories`: `["IAM","Security"]` → `["IAM","Security","Provisioning"]`
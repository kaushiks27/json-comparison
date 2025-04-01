# 📋 Functional Change Report

> **Change Summary:** 4 Critical, 5 Major, 4 Minor changes

## 🚨 Executive Summary

### okta

- 🟠 ✏️ Changed `outputFields`
- 🟠 ➕ Added file: `actions/createUser.json`
- 🔴 ✏️ Changed `type`
- 🔴 ❌ Removed `tokenUrl` (was `"https://okta.com/oauth2/token"`)
- 🔴 ➕ Added `location` with value `"header"`
- 🟠 ➕ Added folder: `events/`
- 🟠 ➕ Added file: `events/groupAssigned.json`
- 🟠 ➕ Added file: `events/userSuspended.json`
- 🔴 ✏️ Changed `categories`

## 🔌 Connector: `okta`

### 🧾 Summary of Changes
- 📦 Output structure changed
- 🆕 actions/createUser.json
- 📁 New folder: events
- 🆕 events/groupAssigned.json
- 🆕 events/userSuspended.json
- 📁 Removed folder: meta

### 📂 Actions Changes
✏️ Changed `description`: `"Retrieves a user's profile."` → `"Retrieves user details including MFA status."`
✏️ Changed `outputFields`: `["id","email","status"]` → `["id","email","status","mfaEnabled"]`
➕ New file: `actions/createUser.json`

### 📂 Auth Changes
✏️ Changed `type`: `"OAuth2"` → `"API Key"`
❌ Removed `tokenUrl` (was `"https://okta.com/oauth2/token"`)
➕ Added `keyName` with value `"Authorization"`
➕ Added `location` with value `"header"`

### 📂 Events Changes
➕ New folder added: `events/`
➕ New file: `events/groupAssigned.json`
➕ New file: `events/userSuspended.json`

### 📂 Metadata Changes
✏️ Changed `version`: `"1.0.0"` → `"1.1.0"`
✏️ Changed `categories`: `["IAM","Security"]` → `["IAM","Security","Provisioning"]`

### 📂 Meta Changes
❌ Folder removed: `meta/`

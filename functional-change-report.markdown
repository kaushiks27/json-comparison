# 📋 Functional Change Report

> **Change Summary:** 5 Critical, 6 Major, 2 Minor changes

## 🚨 Executive Summary

### okta

- 🟠 ✏️ Changed `description`: `Retrieves a user's profile.` → `Retrieves user details including MFA status.`
- 🟠 ✏️ Changed `outputFields`: `["id","email","status"]` → `["id","email","status","mfaEnabled"]`
- 🟠 ➕ Added file: `createUser.json`
- 🔴 ✏️ Changed `type`: `OAuth2` → `API Key`
- 🔴 ❌ Removed `tokenUrl` (was `https://okta.com/oauth2/token`)
- 🔴 ➕ Added `keyName` with value `Authorization`
- 🔴 ➕ Added `location` with value `header`
- 🟠 ➕ Added folder: `events/`
- 🟠 ➕ Added file: `groupAssigned.json`
- 🟠 ➕ Added file: `userSuspended.json`
- 🔴 ✏️ Changed `categories`: `["IAM","Security"]` → `["IAM","Security","Provisioning"]`

## 🔌 Connector: `okta`

### 🧾 Summary of Changes
- 📦 Output structure changed
- 🆕 createUser.json
- 📁 New folder: events
- 🆕 groupAssigned.json
- 🆕 userSuspended.json
- 📁 Removed folder: meta

### 📂 Actions Changes
✏️ Changed `description`: `Retrieves a user's profile.` → `Retrieves user details including MFA status.`
✏️ Changed `outputFields`: `["id","email","status"]` → `["id","email","status","mfaEnabled"]`
➕ New file: `createUser.json`

### 📂 Auth Changes
✏️ Changed `type`: `OAuth2` → `API Key`
❌ Removed `tokenUrl` (was `https://okta.com/oauth2/token`)
➕ Added `keyName` with value `Authorization`
➕ Added `location` with value `header`

### 📂 Events Changes
➕ New folder added: `events/`
➕ New file: `groupAssigned.json`
➕ New file: `userSuspended.json`

### 📂 Meta Changes
❌ Folder removed: `meta/`

### 📂 Metadata Changes
✏️ Changed `version`: `1.0.0` → `1.1.0`
✏️ Changed `categories`: `["IAM","Security"]` → `["IAM","Security","Provisioning"]`

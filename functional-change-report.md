# 📋 Enhanced Functional Change Report

> **Change Summary:** 4 Critical, 7 Major, 2 Minor changes

## 🚨 Executive Summary

<details open>
<summary><strong>Critical and Major Changes (11)</strong></summary>

### okta

- 🔴 ✏️ Changed <code>auth/auth.type</code> <a href="#okta-auth-modified-auth-auth-type">(details)</a>
- 🔴 ❌ Removed <code>auth/auth.tokenUrl</code> (was <code>"https://okta.com/oauth2/token"</code>) <a href="#okta-auth-removed-auth-auth-tokenUrl">(details)</a>
- 🔴 ➕ Added <code>auth/auth.keyName</code> with value <code>"Authorization"</code> <a href="#okta-auth-added-auth-auth-keyName">(details)</a>
- 🔴 ➕ Added <code>auth/auth.location</code> with value <code>"header"</code> <a href="#okta-auth-added-auth-auth-location">(details)</a>
- 🟠 ✏️ Changed <code>actions/getUser.description</code> <a href="#okta-actions-modified-actions-getUser-description">(details)</a>
- 🟠 ✏️ Changed <code>actions/getUser.outputFields</code> <a href="#okta-actions-modified-actions-getUser-outputFields">(details)</a>
- 🟠 ➕ Added file: <code>actions/createUser.json</code> <a href="#okta-actions-file-added-actions-createUser-json">(details)</a>
- 🟠 ➕ Added file: <code>events/groupAssigned.json</code> <a href="#okta-events-file-added-events-groupAssigned-json">(details)</a>
- 🟠 ➕ Added file: <code>events/userSuspended.json</code> <a href="#okta-events-file-added-events-userSuspended-json">(details)</a>
- 🟠 ➕ Added folder: <code>events/</code> <a href="#okta-events-folder-added-events">(details)</a>
- 🟠 ❌ Removed folder: <code>meta/</code> <a href="#okta-meta-folder-removed-meta">(details)</a>

</details>

## 🔌 Connector: `okta`
<details open>
<summary><strong>Changes (13)</strong></summary>

### 🧾 Summary of Changes
- 📦 Output structure changed
- 🆕 actions/createUser.json
- 🔐 Auth change
- 🆕 events/groupAssigned.json
- 🆕 events/userSuspended.json
- 📁 New folder: events
- 📁 Removed folder: meta

### 🔴 Critical Changes (4)
<details open>
<summary><strong>Critical Changes</strong></summary>

<a id="okta-auth-modified-auth-auth-type"></a>
✏️ Changed `auth/auth.type`:
<table>
<tr><th>Before</th><th>After</th></tr>
<tr><td>
```json
"OAuth2"
```
</td><td>
```json
"API Key"
```
</td></tr>
</table>

<a id="okta-auth-removed-auth-auth-tokenUrl"></a>
❌ Removed `auth/auth.tokenUrl` (was):
```json
"https://okta.com/oauth2/token"
```

<a id="okta-auth-added-auth-auth-keyName"></a>
➕ Added `auth/auth.keyName` with value:
```json
"Authorization"
```

<a id="okta-auth-added-auth-auth-location"></a>
➕ Added `auth/auth.location` with value:
```json
"header"
```

</details>

### 🟠 Major Changes (7)
<details>
<summary><strong>Major Changes</strong></summary>

#### 📂 Actions
<a id="okta-actions-modified-actions-getUser-description"></a>
✏️ Changed `actions/getUser.description`:
<table>
<tr><th>Before</th><th>After</th></tr>
<tr><td>
```json
"Retrieves a user's profile."
```
</td><td>
```json
"Retrieves user details including MFA status."
```
</td></tr>
</table>

<a id="okta-actions-modified-actions-getUser-outputFields"></a>
✏️ Changed `actions/getUser.outputFields`:
<table>
<tr><th>Before</th><th>After</th></tr>
<tr><td>
```json
[
  "email",
  "id",
  "status"
]
```
</td><td>
```json
[
  "email",
  "id",
  "mfaEnabled",
  "status"
]
```
</td></tr>
</table>

<a id="okta-actions-file-added-actions-createUser-json"></a>
➕ New file: `actions/createUser.json`

#### 📂 Events
<a id="okta-events-file-added-events-groupAssigned-json"></a>
➕ New file: `events/groupAssigned.json`

<a id="okta-events-file-added-events-userSuspended-json"></a>
➕ New file: `events/userSuspended.json`

<a id="okta-events-folder-added-events"></a>
➕ New folder added: `events/`

#### 📂 Meta
<a id="okta-meta-folder-removed-meta"></a>
❌ Folder removed: `meta/`

</details>

### 🟢 Minor Changes (2)
<details>
<summary><strong>Minor Changes</strong></summary>

<a id="okta-metadata-modified-metadata-manifest-version"></a>
✏️ Changed `metadata/manifest.version`:
<table>
<tr><th>Before</th><th>After</th></tr>
<tr><td>
```json
"1.0.0"
```
</td><td>
```json
"1.1.0"
```
</td></tr>
</table>

<a id="okta-metadata-modified-metadata-manifest-categories"></a>
✏️ Changed `metadata/manifest.categories`:
<table>
<tr><th>Before</th><th>After</th></tr>
<tr><td>
```json
[
  "IAM",
  "Security"
]
```
</td><td>
```json
[
  "IAM",
  "Provisioning",
  "Security"
]
```
</td></tr>
</table>

</details>
</details>

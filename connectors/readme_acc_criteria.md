# ✅ Acceptance Criteria: JSON Functional Change Detection Script

---

## 🎯 Objective
To build a script that:
- Compares **current** and **previous** versions of each connector.
- Detects all JSON-level changes across known subfolders (`actions`, `auth`, `events`, `meta`, `metadata`).
- Maps these changes to **functional impacts** (not just structural diffs).
- Outputs a **human-readable report** to help developers/reviewers quickly understand what changed and why it matters.

---

## 📁 File Structure Expectations

### Directory Layout
```
connectors/
├── previous/
│   └── <connector_name>/
└── current/
    └── <connector_name>/
```

- Subfolders within each connector (may or may not exist):  
  `actions/`, `auth/`, `events/`, `meta/`, `metadata/`
- Each subfolder contains `.json` files describing the connector's behavior and configuration.

---

## 🔎 Functional Requirements

### ✅ FR1: Folder and File Traversal
- The script must recursively read all folders and JSON files under each connector in both `previous/` and `current/`.
- If a folder is **missing** in either version, this must be handled **gracefully**, and noted in the report.
- If a file is **missing in one version**, report it as **Added** or **Removed**.

---

### ✅ FR2: JSON Comparison Logic
- The script must:
  - Load JSON from both versions.
  - Perform a **deep comparison** (recursive key-by-key diff).
  - Detect and classify:
    - **Added keys**
    - **Removed keys**
    - **Modified values**
    - **Changes in arrays** (e.g., new fields in `outputFields`)

---

### ✅ FR3: Functional Mapping Rules
- The script must map certain changes to functional meaning. Examples:
  - `auth.type` changed → *Authentication method changed*
  - New file in `actions/` → *New endpoint or feature introduced*
  - `outputFields[]` in an action grew → *Response payload extended*
  - New file in `events/` → *New automation trigger available*
  - Entire folder missing → *Removed functional module*

---

### ✅ FR4: Human-Readable Report
- Output should be console- and markdown-friendly.
- For each connector, group changes under the following sections:
  - `Auth Changes`
  - `Action Changes`
  - `Event Changes`
  - `Metadata Changes`
  - `Removed/Added Folders`
- Changes must be explained in plain English:
  ```
  ✅ Authentication type changed from 'OAuth2' to 'API Key'
  ➕ Added action: createUser.json
  ✏️ Modified event: userSuspended.json → new field 'suspendedBy' added
  ❌ Removed folder: meta/
  ```
- The report **must be saved as `functional-change-report.md` in the project root**.

---

## 📊 Output Format
- Print to terminal (CLI-friendly)
- Save as `functional-change-report.md` in project root
- Markdown table or bullet list is acceptable

---

## 🚨 Error Handling
- Missing folders/files → log as "Absent"
- Invalid JSON → display file path and line number if possible
- If comparison fails, script must exit with meaningful error

---

## 🧪 Acceptance Test Coverage
The script should be tested with:
- A connector with all folders present
- A connector with some folders missing
- A connector with added/removed files
- Modifications deep inside JSON structures (e.g., nested `trigger.eventFilter.value`)
- Arrays that add or remove fields (e.g., `outputFields`, `categories`)

---

## 🌐 Extensibility Considerations
- Rules for functional mapping must be **configurable** (external JSON/YAML file)
- Script should support multiple connectors in one run
- Must support plug-in output formats later (e.g., HTML, GitHub comment)
# 🔍 JSON Functional Change Detection Tool

This tool compares JSON-based connector definitions between two versions (`previous/` and `current/`) and outputs a **functional change report** in a human-readable Markdown format.

---

## 📁 Folder Structure

Place your connectors in the following layout:

```
project-root/
├── detectFunctionalChanges.js
├── connectors/
│   ├── previous/
│   │   └── <connector_name>/
│   └── current/
│       └── <connector_name>/
```

Each `<connector_name>` folder may include subfolders:
- `actions/`
- `auth/`
- `events/`
- `meta/`
- `metadata/`

Each of these folders may contain `.json` files describing the behavior of the connector.

---

## 🚀 How to Use

1. **Place the Script**
   - Copy `detectFunctionalChanges.js` into your project root.

2. **Add Connector Versions**
   - Place your **previous version** JSON files in `connectors/previous/<connector_name>/`
   - Place your **current version** JSON files in `connectors/current/<connector_name>/`

3. **Run the Script**

```bash
node detectFunctionalChanges.js
```

4. **Check the Output**
   - A Markdown report named `functional-change-report.md` will be generated in your project root.
   - This report highlights functional differences in plain English.

---

## 🛠 Features

- Detects added/removed/modified files and fields
- Recursively compares JSON keys
- Groups changes by connector
- Gracefully handles missing folders
- CLI and Markdown friendly output

---

## 📄 Example Output Snippet

```
## Connector: `okta`

➕ File added: `actions/createUser.json`
✏️ Field changed: `auth/auth.type` from "OAuth2" to "API Key"
📁 Folder added: `events/`
➕ Field added: `events/userSuspended.payload.fields` = ["suspendedBy"]
```

---

## 📌 Requirements

- Node.js (v12 or higher)

---

## 📬 Output

- File: `functional-change-report.md`
- Format: Markdown
- Use it in code reviews, changelogs, or automation pipelines

---

## 📦 Future Enhancements (Optional Ideas)

- Configurable rule-to-description mappings
- HTML export for UI
- GitHub Actions integration

---

Happy diffing!
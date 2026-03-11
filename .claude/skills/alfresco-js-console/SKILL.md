---
name: alfresco-js-console
description: >
  Write and execute JavaScript scripts against Alfresco ECM repositories using the alfresco-js-console CLI.
  Use this skill whenever the user wants to: query or modify Alfresco content/nodes, run scripts against Alfresco,
  search the Alfresco repository, manage workflows or tasks in Alfresco, access Alfresco Java services from scripts,
  write FreeMarker templates for Alfresco output, or interact with the JavaScript Console webscript (OOTBee or fme).
  Also use when you see references to Alfresco content models, node properties (cm:name, cm:content, etc.),
  NodeRefs, or Alfresco API objects like companyhome, search, person, workflow.
---

# Alfresco JavaScript Console

## What this is

The `alfresco-js-console` CLI runs JavaScript scripts against a live Alfresco repository via the OOTBee (or fme) JavaScript Console webscript. Scripts execute server-side in Alfresco's embedded Rhino JavaScript engine with full access to the Alfresco JavaScript API and Spring beans.

## Rhino Engine Constraints

Scripts run in Mozilla Rhino (not V8/Node.js). This means **ES5 syntax only** with some exceptions:

**Do use:**
- `var` for all variable declarations
- `function` declarations and expressions
- `for` loops, `for..in`, `while`
- `try/catch/finally`
- String concatenation with `+`
- `Array.prototype.forEach`, `.map`, `.filter` (available in Rhino)
- Arrow functions work in **some** Rhino versions but are unreliable — prefer `function`

**Do NOT use:**
- `let`, `const` — use `var` instead
- Template literals (`` `${x}` ``) — use `"string " + x` instead
- Destructuring (`var {a, b} = obj`) — access properties directly
- `async/await`, `Promise` — everything is synchronous
- Spread operator (`...args`)
- `class` syntax — use constructor functions if needed
- `for..of` — use `for` loop with index or `.forEach`
- Optional chaining (`?.`) or nullish coalescing (`??`)

**Java interop through Rhino:**
- `Packages.java.fully.qualified.ClassName` accesses any Java class on the classpath
- `new java.util.ArrayList()` creates Java objects
- Java collections use `.get(i)`, `.size()`, `.add()` — not bracket access or `.length`
- Convert Java strings with `"" + javaString` if needed

## CLI Usage

```bash
# Run without installing (npx)
npx alfresco-javascript-console run script.js

# Execute a script file (uses saved profile, if installed globally)
alfresco-js-console run script.js

# Inline connection (no profile needed)
alfresco-js-console run script.js --server https://host/alfresco --username admin --password admin

# Read from stdin
echo 'print(companyhome.name);' | alfresco-js-console run -

# Read-write transaction (needed for creating/modifying/deleting nodes)
alfresco-js-console run script.js --transaction readwrite

# JSON output (for parsing results programmatically)
alfresco-js-console run script.js --json

# With FreeMarker template
alfresco-js-console run script.js --template output.ftl

# Run as different user
alfresco-js-console run script.js --runas admin
```

**Important:** Read-only is the default transaction mode. Use `--transaction readwrite` for any script that creates, modifies, or deletes content.

**Exit codes:** 0 = success, 1 = execution error, 2 = config/usage error.

**JSON output structure:**
```json
{
  "success": true,
  "printOutput": ["line1", "line2"],
  "renderedTemplate": "...",
  "scriptPerf": "42",
  "webscriptPerf": "58",
  "spacePath": "/Company Home",
  "error": null
}
```

## Output Mechanisms

There are two ways to get output from scripts:

**1. `print()` — streaming text output**
```javascript
print("Found " + results.length + " nodes");
```
Each `print()` call adds a line to `printOutput`. Output streams in real-time during execution.

**2. `model.*` — FreeMarker template data**
```javascript
model.nodes = search.luceneSearch("TYPE:\"cm:content\"");
model.user = person.properties["cm:userName"];
```
Set properties on `model` to make them available in FreeMarker templates. Then pass `--template file.ftl` to render.

Note: The `result` field in the JSON response is always `[]` in OOTBee — it's a vestigial field. Use `print()` and `model.*` instead.

## Standard Alfresco JavaScript API

These global objects are always available in scripts. For the full reference with examples, read `references/api-reference.md`.

| Object | Purpose |
|---|---|
| `companyhome` | Company Home ScriptNode (root folder) |
| `userhome` | Current user's home folder |
| `person` | Current user's person node |
| `search` | Search service (Lucene, FTS, CMIS, findNode) |
| `workflow` | Workflow service |
| `print(msg)` | Output a line of text |
| `logger` | Logger (`.log()`, `.warn()`, `.error()`) |
| `model` | Object for passing data to FreeMarker templates |
| `space` | Context space node (defaults to Company Home) |
| `document` | Context document node (if provided) |

### ScriptNode (every node you work with)

```javascript
var node = search.findNode("workspace://SpacesStore/some-uuid");
node.name                           // String: node name
node.nodeRef                        // String: "workspace://SpacesStore/uuid"
node.type                           // String: full type URI
node.typeShort                      // String: "cm:content"
node.properties["cm:title"]         // Access any property
node.children                       // Array of child ScriptNodes
node.aspects                        // Array of aspect names
node.getPermissions()               // Array of permission strings
node.hasPermission("Write")         // Boolean
node.createNode("name", "cm:folder") // Create child node
node.save()                         // Persist property changes
node.remove()                       // Delete the node (needs readwrite tx)
```

### Search

```javascript
// Lucene query
var results = search.luceneSearch("TYPE:\"cm:content\" AND @cm\\:name:\"report*\"");

// Find by NodeRef
var node = search.findNode("workspace://SpacesStore/uuid-here");

// PATH query (XPath-like)
var results = search.luceneSearch("PATH:\"/app:company_home/st:sites/cm:my-site/cm:documentLibrary//*\"");
```

## Accessing Spring Beans and Java Services

This is the most powerful feature — scripts can access **any** Spring bean registered in the Alfresco application context, including custom ones. For the full guide with patterns and examples, read `references/spring-beans.md`.

Quick example:
```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var nodeService = ctx.getBean("NodeService", Packages.org.alfresco.service.cmr.repository.NodeService);
var NodeRef = Packages.org.alfresco.service.cmr.repository.NodeRef;

var ref = new NodeRef("workspace://SpacesStore/some-uuid");
var props = nodeService.getProperties(ref);
print("Title: " + props.get(Packages.org.alfresco.model.ContentModel.PROP_TITLE));
```

## FreeMarker Templates

Templates render data set on the `model` object. Use `--template file.ftl`:

```ftl
<#-- Variables come from model.* in the script -->
User: ${user}

<#list nodes as node>
${node.name} - ${node.nodeRef}
</#list>

<#if count?? && count gt 0>
Found ${count} items.
</#if>
```

## Common Patterns

### Search and report
```javascript
var results = search.luceneSearch("TYPE:\"cm:content\" AND @cm\\:modified:[NOW/DAY-7DAYS TO NOW]");
print("Modified in last 7 days: " + results.length);
for (var i = 0; i < results.length; i++) {
    var n = results[i];
    print("  " + n.name + " (" + n.properties["cm:modifier"] + ")");
}
```

### Modify content (requires --transaction readwrite)
```javascript
var folder = search.findNode("workspace://SpacesStore/folder-uuid");
var newDoc = folder.createNode("report.txt", "cm:content");
newDoc.properties["cm:title"] = "Monthly Report";
newDoc.content = "Report content here";
newDoc.save();
print("Created: " + newDoc.nodeRef);
```

### Wrap in main() for clean scope
```javascript
function main() {
    var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
    var service = ctx.getBean("beanName", Packages.some.ServiceClass);
    // ... work ...
    print("Done");
}
main();
```

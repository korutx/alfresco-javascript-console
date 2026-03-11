# Alfresco JavaScript API Reference

## Global Objects

### companyhome
The Company Home folder — root of the content repository.

```javascript
print(companyhome.name);        // "Company Home"
print(companyhome.nodeRef);     // "workspace://SpacesStore/uuid"

var children = companyhome.children;
for (var i = 0; i < children.length; i++) {
    print(children[i].name + " (" + children[i].typeShort + ")");
}
```

### userhome
Current user's home folder.

```javascript
print(userhome.name);
var myDocs = userhome.children;
```

### person
Current user's person node.

```javascript
print(person.properties["cm:userName"]);
print(person.properties["cm:firstName"] + " " + person.properties["cm:lastName"]);
print(person.properties["cm:email"]);
```

### search
Search service with multiple query languages.

```javascript
// Lucene search
var results = search.luceneSearch("TYPE:\"cm:content\"");

// Find single node by NodeRef
var node = search.findNode("workspace://SpacesStore/uuid");

// PATH-based search (XPath-like)
var results = search.luceneSearch("PATH:\"/app:company_home/st:sites/cm:mysite/cm:documentLibrary//*\"");

// Search with property filters
var results = search.luceneSearch("TYPE:\"cm:content\" AND @cm\\:name:\"report*\"");
var results = search.luceneSearch("TYPE:\"cm:person\" AND @cm\\:userName:\"admin\"");

// Full-text search
var results = search.luceneSearch("TEXT:\"important document\"");

// Search by aspect
var results = search.luceneSearch("ASPECT:\"cm:titled\"");
```

**Lucene query syntax tips:**
- Escape colons in property names: `@cm\\:name` (double backslash in JS string)
- Quote values with special chars: `"my document.pdf"`
- Wildcards: `report*`, `*.pdf`
- Date ranges: `@cm\\:modified:[NOW/DAY-7DAYS TO NOW]`
- Boolean: `AND`, `OR`, `NOT`
- PATH uses encoded names: `/app:company_home/cm:My_x0020_Folder`
  - Space → `_x0020_`, `@` → `_x0040_`, etc.

### workflow
Workflow service.

```javascript
var active = workflow.getActiveWorkflows();
for (var i = 0; i < active.length; i++) {
    print(active[i].id + ": " + active[i].description);
}
```

### print(message)
Output a line of text. Supports any type — objects get converted to string.

```javascript
print("Simple text");
print("Count: " + results.length);
print(node);  // Prints formatted: "name (nodeRef)"
```

For collections and ScriptNodes, `print()` automatically formats the output nicely.

### logger
Logger with level-prefixed output. All calls also appear in `printOutput`.

```javascript
logger.log("debug message");     // "DEBUG - debug message"
logger.info("info message");     // "info message" (no prefix)
logger.warn("warning");          // "WARN - warning"
logger.error("error");           // "ERROR - error"
```

### model
Object for passing data to FreeMarker templates. Properties set on `model` become template variables.

```javascript
model.title = "My Report";
model.nodes = search.luceneSearch("TYPE:\"cm:content\"");
model.count = 42;
```

In template (`--template report.ftl`):
```ftl
${title}
Found ${count} items.
<#list nodes as node>
  ${node.name}
</#list>
```

---

## ScriptNode API

Every node returned from search, companyhome, etc. is a ScriptNode.

### Properties

```javascript
node.name                              // String: cm:name
node.nodeRef                           // String: "workspace://SpacesStore/uuid"
node.id                                // String: just the UUID part
node.type                              // String: full type e.g. "{http://...}content"
node.typeShort                         // String: "cm:content"
node.isDocument                        // Boolean
node.isContainer                       // Boolean (folder)
node.parent                            // ScriptNode: parent folder
node.children                          // Array: child ScriptNodes
node.aspects                           // Array: applied aspect names
node.content                           // String: text content (for cm:content)
node.size                              // Number: content size in bytes
node.mimetype                          // String: MIME type
```

### Property access

```javascript
// Read
var title = node.properties["cm:title"];
var desc = node.properties["cm:description"];
var created = node.properties["cm:created"];    // Date
var creator = node.properties["cm:creator"];    // String
var modified = node.properties["cm:modified"];  // Date
var modifier = node.properties["cm:modifier"]; // String

// Write (needs readwrite transaction, followed by .save())
node.properties["cm:title"] = "New Title";
node.properties["cm:description"] = "Updated description";
node.save();
```

### Node operations

```javascript
// Create child node
var child = parentFolder.createNode("document.txt", "cm:content");
child.properties["cm:title"] = "My Document";
child.content = "File content here";
child.save();

// Create folder
var folder = parentFolder.createNode("New Folder", "cm:folder");
folder.save();

// Delete node (needs readwrite transaction)
node.remove();

// Copy and move
var copy = node.copy(targetFolder);
node.move(targetFolder);

// Check and add aspects
var hasAspect = node.hasAspect("cm:titled");
node.addAspect("cm:taggable");
node.removeAspect("cm:taggable");
```

### Permissions

```javascript
// List permissions
var perms = node.getPermissions();
for (var i = 0; i < perms.length; i++) {
    print(perms[i]);  // "ALLOWED;user;ReadProperties"
}

// Check permission
if (node.hasPermission("Write")) {
    print("User can write");
}

// Set permission (needs readwrite tx)
node.setPermission("Contributor", "GROUP_site_mysite_SiteCollaborator");
```

### Associations

```javascript
// Child associations
var children = node.childAssocs["cm:contains"];

// Peer associations (target associations from this node)
var targets = node.assocs["cm:references"];

// Source associations (nodes pointing to this node)
var sources = node.sourceAssocs["cm:references"];
```

---

## Common Lucene Query Patterns

```javascript
// All documents in a site's document library
search.luceneSearch("PATH:\"/app:company_home/st:sites/cm:my-site/cm:documentLibrary//*\" AND TYPE:\"cm:content\"");

// All folders at a specific path (non-recursive, immediate children only)
search.luceneSearch("PATH:\"/app:company_home/cm:Shared/*\" AND TYPE:\"cm:folder\"");

// Content modified today
search.luceneSearch("TYPE:\"cm:content\" AND @cm\\:modified:[NOW/DAY TO NOW]");

// Content created by specific user
search.luceneSearch("TYPE:\"cm:content\" AND @cm\\:creator:\"admin\"");

// Documents with specific MIME type
search.luceneSearch("TYPE:\"cm:content\" AND @cm\\:content.mimetype:\"application/pdf\"");

// Custom type (use full namespace or prefix)
search.luceneSearch("TYPE:\"my:customType\"");

// Nodes with specific aspect
search.luceneSearch("ASPECT:\"cm:versionable\" AND TYPE:\"cm:content\"");
```

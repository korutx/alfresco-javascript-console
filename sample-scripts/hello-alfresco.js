// Sample Alfresco JavaScript Console Script
// Demonstrates print output, model population, and template usage

// --- Print output (streamed in real-time) ---

print("Hello from Alfresco JavaScript Console!");

var companyHome = companyhome;
print("Company Home: " + companyHome.name + " (" + companyHome.nodeRef + ")");
print("Current User: " + person.properties["cm:userName"]);

var children = companyHome.children;
print("Company Home has " + children.length + " children:");

for (var i = 0; i < Math.min(children.length, 5); i++) {
    print("  - " + children[i].name + " (" + children[i].type + ")");
}

// --- Model (for FreeMarker templates) ---
// Set properties on the `model` object to make them available in templates.
// Use with: alfresco-js-console run hello-alfresco.js --template hello-alfresco.ftl

model.nodes = children;
model.user = person.properties["cm:userName"];

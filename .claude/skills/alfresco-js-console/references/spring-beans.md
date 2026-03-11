# Accessing Spring Beans and Java Services

The most powerful feature of the Alfresco JavaScript Console is direct access to any Spring bean in the application context. This lets you call low-level Alfresco services, Activiti workflow engines, and any custom Java code deployed in the repository.

## The Pattern

Every script that accesses Spring beans follows this structure:

```javascript
function main() {
    // 1. Get the Spring ApplicationContext
    var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();

    // 2. Get a bean by name and interface
    var service = ctx.getBean("beanName", Packages.org.alfresco.service.SomeInterface);

    // 3. Use the service
    service.doSomething();
}
main();
```

Wrapping in `main()` keeps variables scoped and avoids polluting the global scope.

## Common Alfresco Service Beans

### NodeService — Low-level node CRUD

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var nodeService = ctx.getBean("NodeService", Packages.org.alfresco.service.cmr.repository.NodeService);
var NodeRef = Packages.org.alfresco.service.cmr.repository.NodeRef;
var ContentModel = Packages.org.alfresco.model.ContentModel;

var ref = new NodeRef("workspace://SpacesStore/some-uuid");

// Read properties
var props = nodeService.getProperties(ref);
print("Name: " + props.get(ContentModel.PROP_NAME));
print("Title: " + props.get(ContentModel.PROP_TITLE));

// Check/add aspects
if (!nodeService.hasAspect(ref, ContentModel.ASPECT_TITLED)) {
    var aspectProps = new java.util.HashMap();
    aspectProps.put(ContentModel.PROP_TITLE, "My Title");
    nodeService.addAspect(ref, ContentModel.ASPECT_TITLED, aspectProps);
}

// Set a property
nodeService.setProperty(ref, ContentModel.PROP_TITLE, "Updated Title");

// Get associations
var assocs = nodeService.getSourceAssocs(ref, someAssociationType);
for (var i = 0; i < assocs.size(); i++) {
    var assocRef = assocs.get(i);
    print("Source: " + assocRef.getSourceRef());
}
```

### SearchService

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var searchService = ctx.getBean("SearchService", Packages.org.alfresco.service.cmr.search.SearchService);
var StoreRef = Packages.org.alfresco.service.cmr.repository.StoreRef;

// Note: For most searches, the built-in `search` object is easier.
// Use SearchService directly when you need advanced options.
```

### WorkflowService — Alfresco workflow API

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var workflowService = ctx.getBean("WorkflowService", Packages.org.alfresco.service.cmr.workflow.WorkflowService);

// Get workflow paths
var paths = workflowService.getWorkflowPaths("activiti$12345");

// Get task by ID
var task = workflowService.getTaskById("activiti$67890");
print("Task: " + task.getName());

// End a task with a specific transition
workflowService.endTask("activiti$67890", "Approve");
```

### AuthorityService — Users and groups

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var authorityService = ctx.getBean("authorityService", Packages.org.alfresco.service.cmr.security.AuthorityService);
var AuthorityType = Packages.org.alfresco.service.cmr.security.AuthorityType;

// Get members of a group
var members = authorityService.getContainedAuthorities(AuthorityType.USER, "GROUP_ALFRESCO_ADMINISTRATORS", false);
var it = members.iterator();
while (it.hasNext()) {
    print("Member: " + it.next());
}

// Check group membership
var groups = authorityService.getContainingAuthorities(AuthorityType.GROUP, "admin", false);
```

### PersonService — User management

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var personService = ctx.getBean("PersonService", Packages.org.alfresco.service.cmr.security.PersonService);

var personRef = personService.getPerson("admin");
print("Person NodeRef: " + personRef);
```

### AttributeService — Persistent key-value store

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var attributeService = ctx.getBean("AttributeService", Packages.org.alfresco.service.cmr.attributes.AttributeService);

// Get attribute
var value = attributeService.getAttribute("key1", "key2", "key3");

// Set attribute (needs readwrite transaction)
attributeService.setAttribute("myValue", "key1", "key2", "key3");

// Remove attribute
attributeService.removeAttribute("key1", "key2", "key3");
```

### Global Properties

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var properties = ctx.getBean("global-properties", Packages.java.util.Properties);

print("Alfresco dir: " + properties["dir.root"]);
print("Server URL: " + properties["alfresco.host"]);
```

---

## Activiti (BPMN Workflow Engine)

Alfresco uses Activiti as its BPMN engine. You can access it directly for advanced workflow operations.

### TaskService — Query and manage tasks

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var taskService = ctx.getBean("activitiTaskService", Packages.org.activiti.engine.TaskService);

// Query tasks with fluent API
var tasks = taskService
    .createTaskQuery()
    .taskAssignee("admin")
    .active()
    .includeProcessVariables()
    .list();

for (var i = 0; i < tasks.size(); i++) {
    var task = tasks.get(i);
    print("Task: " + task.getName() + " (ID: " + task.getId() + ")");
    print("  Assignee: " + task.getAssignee());
    print("  Created: " + task.getCreateTime());

    // Access process variables
    var vars = task.getProcessVariables();
    print("  Variable: " + vars.get("myVariable"));
}

// Query by definition key and candidate group
var tasks = taskService
    .createTaskQuery()
    .taskDefinitionKey("userTask1")
    .taskCandidateGroupIn(["GROUP_MY_GROUP"])
    .active()
    .list();

// OR queries
var tasks = taskService
    .createTaskQuery()
    .or()
    .taskAssignee("admin")
    .taskCandidateGroupIn(["GROUP_MANAGERS"])
    .endOr()
    .active()
    .list();

// Task operations
taskService.complete("taskId");                          // Complete task
taskService.setVariable("taskId", "varName", "value");   // Set variable
taskService.unclaim("taskId");                           // Unclaim
taskService.setAssignee("taskId", "username");           // Reassign
taskService.addCandidateGroup("taskId", "GROUP_NAME");   // Add candidate group
taskService.deleteCandidateGroup("taskId", "GROUP_NAME");// Remove candidate group

// Get identity links (who can work on this task)
var links = taskService.getIdentityLinksForTask("taskId");
for (var i = 0; i < links.size(); i++) {
    var link = links.get(i);
    if (link.getGroupId() != null) {
        print("Candidate group: " + link.getGroupId());
    }
}
```

### RuntimeService — Process variables and execution

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var runtimeService = ctx.getBean("activitiRuntimeService", Packages.org.activiti.engine.RuntimeService);

// Get/set process-level variables
var value = runtimeService.getVariable("processInstanceId", "variableName");
runtimeService.setVariable("processInstanceId", "variableName", "newValue");

// Set a list variable
var groups = new java.util.ArrayList();
groups.add("GROUP_A");
groups.add("GROUP_B");
runtimeService.setVariable("processInstanceId", "candidateGroups", groups);
```

### HistoryService — Completed process data

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var historyService = ctx.getBean("activitiHistoryService", Packages.org.activiti.engine.HistoryService);

// Query finished processes
var instances = historyService
    .createHistoricProcessInstanceQuery()
    .includeProcessVariables()
    .finished()
    .listPage(0, 100);

for (var i = 0; i < instances.size(); i++) {
    var inst = instances.get(i);
    print("Process: " + inst.getId() + " ended: " + inst.getEndTime());
    var vars = inst.getProcessVariables();
}
```

### ProcessEngine — Advanced operations

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var processEngine = ctx.getBean("activitiProcessEngine", Packages.org.activiti.engine.ProcessEngine);

// Execute in command context (for low-level operations)
processEngine.getManagementService().executeCommand({
    execute: function(commandContext) {
        // Operations here run in the Activiti command context
        // Useful for operations that need the engine's internal transaction
        return null;
    }
});

// Access repository for process definitions
var definition = processEngine.getRepositoryService().getProcessDefinition("defId");
print("Process: " + definition.getName() + " v" + definition.getVersion());
```

---

## Custom Java Services

Any Spring bean deployed in the Alfresco repository can be accessed. If your project registers a bean like:

```xml
<bean id="myCustomService" class="com.example.MyService" />
```

You access it like:

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var myService = ctx.getBean("myCustomService", Packages.com.example.MyService);
myService.doWork();
```

### Custom domain models

If your project defines a Java model class with constants:

```javascript
var MyModel = Packages.com.example.model.MyModel;

// Use constants for QNames, property names, etc.
var value = nodeService.getProperty(nodeRef, MyModel.PROP_CUSTOM_FIELD);
nodeService.addAspect(nodeRef, MyModel.ASPECT_CUSTOM, props);
```

---

## Java Type Reference

Common Java types you'll use in scripts:

```javascript
// Collections
var list = new java.util.ArrayList();
list.add("item");
list.size();       // not .length
list.get(0);       // not [0]

var map = new java.util.HashMap();
map.put("key", "value");
map.get("key");

// From Map.of (Java 9+)
var headers = new java.util.HashMap(java.util.Map.of(
    "key1", "value1",
    "key2", "value2"
));

// Arrays
var arr = java.util.Arrays.asList("a", "b", "c");

// UUID
var uuid = Packages.java.util.UUID.randomUUID().toString();

// Date/Time (java.time)
var Instant = Packages.java.time.Instant;
var ZonedDateTime = Packages.java.time.ZonedDateTime;
var ZoneId = Packages.java.time.ZoneId;
var DateTimeFormatter = Packages.java.time.format.DateTimeFormatter;

var now = Instant.now();
var zdt = ZonedDateTime.ofInstant(now, ZoneId.of("America/Santiago"));
var formatted = zdt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

// SimpleDateFormat (legacy)
var sdf = new Packages.java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
sdf.setTimeZone(Packages.java.util.TimeZone.getTimeZone("America/Santiago"));
var dateStr = sdf.format(someDate);

// Alfresco types
var NodeRef = Packages.org.alfresco.service.cmr.repository.NodeRef;
var ref = new NodeRef("workspace://SpacesStore/uuid");
var ContentModel = Packages.org.alfresco.model.ContentModel;
```

---

## Messaging / Event Publishing

If the repository has a message publishing service:

```javascript
var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();
var messagePublisher = ctx.getBean("messagePublisherService", Packages.com.example.messaging.MessagePublisherService);
var UUID = Packages.java.util.UUID;

var event = {
    task: { id: "12345", name: "myTask" },
    context: { user: "admin" }
};

var headers = new java.util.HashMap(java.util.Map.of(
    "id", UUID.randomUUID().toString(),
    "action", "MyEventAction"
));

messagePublisher.publish("channelName", event, headers);
```

---

## Changing Log Levels at Runtime

```javascript
var Configurator = Packages.org.apache.logging.log4j.core.config.Configurator;
var Level = Packages.org.apache.logging.log4j.Level;

// Set log level for a class
Configurator.setLevel("org.alfresco.repo.search.impl", Level.DEBUG);

// Set for multiple classes
var classes = [
    "org.alfresco.repo.workflow",
    "org.activiti.engine"
];
for (var i = 0; i < classes.length; i++) {
    Configurator.setLevel(classes[i], Level.DEBUG);
}
print("Log levels updated");
```

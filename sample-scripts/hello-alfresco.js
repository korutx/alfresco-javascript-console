// Sample Alfresco JavaScript Console Script
// This script demonstrates basic Alfresco API usage

// Print a welcome message
print("🚀 Hello from Alfresco JavaScript Console!");
print("Extension successfully connected to Alfresco server");

// Get and display company home information
try {
    var companyHome = companyhome;
    print("📁 Company Home Details:");
    print("  Name: " + companyHome.name);
    print("  NodeRef: " + companyHome.nodeRef);
    print("  Type: " + companyHome.type);
    
    // List some children of company home
    var children = companyHome.children;
    print("📂 Company Home contains " + children.length + " children:");
    
    for (var i = 0; i < Math.min(children.length, 5); i++) {
        var child = children[i];
        print("  - " + child.name + " (" + child.type + ")");
    }
    
    // Display current user information
    print("👤 Current User: " + person.properties["cm:userName"]);
    
    // Show server information
    print("🔧 Server Information:");
    print("  Date: " + new Date());
    print("  Script executed successfully!");
    
} catch (error) {
    print("❌ Error: " + error.message);
}
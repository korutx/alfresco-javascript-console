<#-- Sample FreeMarker template for hello-alfresco.js -->
<#-- Use with: alfresco-js-console run hello-alfresco.js --template hello-alfresco.ftl -->
<#-- Variables come from model.* set in the script -->

User: ${user}

Children of Company Home:
<#list nodes as node>
  ${node.name} (${node.typeShort}) - ${node.nodeRef}
</#list>

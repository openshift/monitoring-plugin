# Scale up the Monitoring-plugin
#!/bin/bash
oc scale --replicas=1 -n openshift-monitoring deployment/monitoring-plugin

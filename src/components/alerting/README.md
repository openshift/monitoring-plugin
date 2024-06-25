## Dev Console Migration
The Observability UI team is in the process of migrating the developer perspective UI from the 
openshift/console repo into this one. In the process of this, the alerting UI will be going through
a refactor to help make the code more maintainable. At this time the current plan is as follows:

```
src/components
│   alerting.tsx (This file will be reserved for the routing of the alerting module)
│
└───alerting
│   │   AlertsUtils (Utility functions and components use across the alerting pages)
│   │   alerts-types (Types used across the alerting pages)
│   │   AlertsPage (Lister view of alerts for both developer and admin perspectives)
│   │   AlertsDetailPage (Detail page of alerts)
│   │   AlertsRulePage (Lister view of alert rules)
│   │   AlertsRuleDetailPage (Detail page of alert rules)
│   │   SilencesPage (Lister view of silences)
│   │   SilencesDetailPage (Detail page of alert rules)
```

Update this doc if changes are needed and remove it once the migration is complete.

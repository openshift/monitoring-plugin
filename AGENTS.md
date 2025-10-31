# OpenShift Monitoring Plugin - AI Agent Guide

## Quick Start (30-second overview)
- **What**: Dual frontend plugins for OpenShift observability (monitoring-plugin + monitoring-console-plugin)
- **Purpose**: Alerts, Metrics, Targets, Dashboards + Perses, Incidents, ACM integration
- **Tech Stack**: React + TypeScript + Webpack + i18next + Go 
- **Key Files**: `web/console-extensions.json`, `web/src/components/`

## Common Tasks & Workflows

### Adding a New Feature
1. Check if it belongs in `monitoring-plugin` (core) or `monitoring-console-plugin` (extended)
2. Update console extensions in `web/console-extensions.json`
3. Add React components in `web/src/components/`
4. Add translations in `public/locales/`
5. Test with `make lint-frontend && make test-backend`

### Debugging Issues
- **Build failures**: Check `Makefile` targets
- **Console integration**: Verify `console-extensions.json`
- **Plugin loading**: Check OpenShift Console logs
- **Perses dashboards**: Debug at `web/src/components/dashboards/perses/`

### Development Setup
- See README.md for full setup
- Deployment: https://github.com/observability-ui/development-tools/

## Development Context

### When working on Alerts:
- Files: `web/src/components/alerts/`
- Integration: Alertmanager API
- Testing: Cypress tests in `web/cypress/`

### When working on Dashboards:
- **Legacy**: Standard OpenShift dashboards
- **Perses**: `web/src/components/dashboards/perses/` (uses ECharts wrapper)
- **Upstream**: https://github.com/perses/perses

### When working on ACM:
- Multi-cluster observability
- Hub cluster aggregation
- Thanos/Alertmanager integration

## Important Decision Points

### Choosing Between Plugins:
- **monitoring-plugin**: Core observability (always available)
- **monitoring-console-plugin**: Optional features (COO required)

### Adding Dependencies:
- Check compatibility with OpenShift Console versions
- Verify i18next translation support
- Consider CMO vs COO deployment differences

## External Dependencies & Operators

| System | Repository | Purpose |
|--------|------------|---------|
| CMO | https://github.com/openshift/cluster-monitoring-operator | Manages monitoring-plugin |
| COO | https://github.com/rhobs/observability-operator | Manages monitoring-console-plugin |
| Perses | https://github.com/perses/perses | Dashboard engine |
| Console SDK | https://github.com/openshift/console | Plugin framework |

## Technical Documentation

### Console Plugin Framework
- Plugin SDK: https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk
- Extensions docs: https://github.com/openshift/console/blob/main/frontend/packages/console-dynamic-plugin-sdk/docs/console-extensions.md
- Example plugin: https://github.com/openshift/console/tree/main/dynamic-demo-plugin

### Operator Integration
- **CMO (monitoring-plugin)**: Integrated with cluster monitoring stack
- **COO (monitoring-console-plugin)**: Optional operator for extended features
- **UIPlugin CR example**:
```yaml
apiVersion: observability.openshift.io/v1alpha1
kind: UIPlugin
metadata:
  name: monitoring
spec:
  type: Monitoring
  monitoring:
    acm:
      enabled: true
      alertmanager:
        url: 'https://alertmanager.open-cluster-management-observability.svc:9095'
      thanosQuerier:
        url: 'https://rbac-query-proxy.open-cluster-management-observability.svc:8443'
    perses:
      enabled: true
    incidents:
      enabled: true
```

### Perses Integration Details
- **Core**: https://github.com/perses/perses
- **Plugins**: https://github.com/perses/plugins (chart specifications and datasources)
- **Operator**: https://github.com/perses/perses-operator (Red Hat fork: https://github.com/rhobs/perses)
- **Chart Engine**: ECharts (https://echarts.apache.org/)

### ACM Observability
- **Multi-cluster monitoring**: Centralized observability across managed clusters
- **Components**: Hub cluster Thanos, Grafana, Alertmanager + endpoint operators
- **Integration**: COO provides unified alerting UI for ACM environments
- **Features**: Cross-cluster silences, cluster-labeled alerts, centralized metrics

## Release & Testing

### Before submitting a PR run the following and address any errors:
```bash
make lint-frontend
make lint-backend
make test-translations
make test-backend
# Run cypress tests (see web/cypress/README.md)
```

### PR Requirements:
- **Title format**: `[JIRA_ISSUE]: Description`
- **Testing**: All linting and tests must pass
- **Translations**: Ensure i18next keys are properly added

### Release Pipeline:
- **Konflux**: Handles CI/CD and release automation
- **CMO releases**: Follow OpenShift release cycles
- **COO releases**: Independent release schedule

## Security & RBAC

### Plugin Security Model:
- Inherits OpenShift Console RBAC
- Respects cluster monitoring permissions
- ACM integration requires appropriate hub cluster access

### Development Security:
- No credentials in code
- Use cluster service accounts
- Follow OpenShift security guidelines

## Getting Help

| Topic | Channel/Resource |
|-------|-----------------|
| Console Plugins | OpenShift Console SDK documentation |
| Perses | Slack: Cloud Native Computing Foundation >> #perses-dev |
| COO | Slack: Internal Red Hat >> #forum-cluster-observability-operator |

## Additional Resources

### Development Tools & Scripts:
- **Monitoring Plugin**: https://github.com/observability-ui/development-tools/tree/main/monitoring-plugin
- **Perses**: https://github.com/observability-ui/development-tools/tree/main/perses
- **Wiki**: https://github.com/observability-ui/development-tools/tree/main/wiki

### Code Style & Standards:
- **TypeScript**: https://www.typescriptlang.org/
- **React**: https://react.dev/
- **Webpack**: https://webpack.js.org/
- **Go**: https://go.dev/ 
- **i18next**: https://www.i18next.com/

---
*This guide is optimized for AI agents and developers. For detailed setup instructions, also refer to README.md and Makefile.*
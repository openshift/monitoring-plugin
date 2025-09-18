import { WatchdogAlert } from "./constants";

export const alerts = {
    getWatchdogAlert: () => {
        cy.intercept('GET', '/api/prometheus/api/v1/rules?', {
            data: {
            groups: [
                {
                file: 'dummy-file',
                interval: 30,
                name: 'general.rules',
                rules: [
                    {
                    state: 'firing',
                    name: `${WatchdogAlert.ALERTNAME}`,
                    query: 'vector(1)',
                    duration: 0,
                    labels: {
                        // namespace: `${NAMESPACE}`,
                        prometheus: 'openshift-monitoring/k8s',
                        severity: `${WatchdogAlert.SEVERITY}`,
                    },
                    annotations: {
                        description:
                        `${WatchdogAlert.ALERT_DESC}`,
                        summary:
                        `${WatchdogAlert.ALERT_SUMMARY}`,
                    },
                    alerts: [
                        {
                        labels: {
                            alertname: `${WatchdogAlert.ALERTNAME}`,
                            namespace: `${WatchdogAlert.NAMESPACE}`,
                            severity: `${WatchdogAlert.SEVERITY}`,
                        },
                        annotations: {
                            description:
                            `${WatchdogAlert.ALERT_DESC}`,
                            summary:
                            `${WatchdogAlert.ALERT_SUMMARY}`,
                        },
                        state: 'firing',
                        activeAt: '2023-04-10T12:00:00.123456789Z',
                        value: '1e+00',
                        'partialResponseStrategy': 'WARN',
                        },
                    ],
                    health: 'ok',
                    type: 'alerting',
                    },
                ],
                },
            ],
            },
        }),
        cy.log('Watchdog alert loaded');
    },
};
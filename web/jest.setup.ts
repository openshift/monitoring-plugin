(global as any).window = {
  SERVER_FLAGS: {
    prometheusBaseURL: '/api/prometheus',
    prometheusTenancyBaseURL: '/api/prometheus-tenancy',
    alertManagerBaseURL: '/api/alertmanager',
  },
};

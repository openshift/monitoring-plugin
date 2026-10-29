import {
  Alert,
  AlertStates,
  PrometheusAlert,
  PrometheusRule,
  Rule,
  RuleStates,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

type AlertingData = {
  alerts: Alert[];
  rules: Rule[];
  silences: Silence[];
};

const cloneAlert = (alert: Alert): PrometheusAlert => ({
  ...alert,
  annotations: { ...alert.annotations },
  labels: { ...alert.labels },
  state: alert.state,
});

const cloneRule = (rule: Rule): Rule => ({
  ...rule,
  annotations: { ...rule.annotations },
  labels: { ...rule.labels },
  alerts: rule.alerts.map(cloneAlert),
});

const cloneAlertingData = ({ alerts, rules, silences }: AlertingData): AlertingData => {
  const clonedRules = rules.map(cloneRule);
  const ruleKey = (rule: Rule) => JSON.stringify([rule.sourceId ?? 'prometheus', rule.id]);
  const rulesBySource = new Map(
    clonedRules.map((rule, index) => [ruleKey(rule), clonedRules[index]]),
  );

  const getClonedRule = (rule: Rule) => {
    const key = ruleKey(rule);
    let clonedRule = rulesBySource.get(key);
    if (!clonedRule) {
      clonedRule = cloneRule(rule);
      rulesBySource.set(key, clonedRule);
    }
    return clonedRule;
  };

  return {
    rules: clonedRules,
    alerts: alerts.map((alert) => ({
      ...cloneAlert(alert),
      rule: getClonedRule(alert.rule),
    })),
    silences: silences.map((silence) => ({
      ...silence,
      matchers: silence.matchers.map((matcher) => ({ ...matcher })),
      status: { ...silence.status },
    })),
  };
};

// Apply silences to alerts and rules without modifying the data in place
export const applySilences = (data: AlertingData): AlertingData => {
  const { alerts, rules, silences } = cloneAlertingData(data);
  const firingAlerts = alerts.filter(isAlertFiring);
  const firingRules = rules.filter(isRuleFiring);

  applySilencesToAlerts({ silences, firingAlerts });
  applySilencesToRules({ silences, firingRules });

  return {
    alerts,
    rules,
    silences: silences.map((silence) => ({
      ...silence,
      firingAlerts: firingAlerts.filter((alert) => isAlertSilenced(alert, silence)),
    })),
  };
};

const applySilencesToAlerts = ({
  firingAlerts,
  silences,
}: {
  silences: Array<Silence>;
  firingAlerts: Array<Alert>;
}) => {
  firingAlerts.forEach((firingAlert) => {
    firingAlert.silencedBy = silences.filter(
      (silence) =>
        silence.status?.state === SilenceStates.Active && isAlertSilenced(firingAlert, silence),
    );

    if (firingAlert.silencedBy.length) {
      firingAlert.state = AlertStates.Silenced;

      firingAlert.rule.alerts.forEach((ruleAlert) => {
        if (firingAlert.silencedBy?.some((silence) => isAlertSilenced(ruleAlert, silence))) {
          ruleAlert.state = AlertStates.Silenced;
        }
      });

      if (
        firingAlert.rule.alerts.length !== 0 &&
        firingAlert.rule.alerts.every((alert) => alert.state === AlertStates.Silenced)
      ) {
        firingAlert.rule.state = RuleStates.Silenced;

        firingAlert.rule.silencedBy = silences.filter(
          (silence) =>
            silence.status?.state === SilenceStates.Active &&
            firingAlert.rule.alerts.some((alert) => isAlertSilenced(alert, silence)),
        );
      }
    }
  });

  return firingAlerts;
};

const applySilencesToRules = ({
  firingRules,
  silences,
}: {
  silences: Array<Silence>;
  firingRules: Array<Rule>;
}) => {
  firingRules.forEach((firingRule) => {
    firingRule.silencedBy = silences.filter(
      (silence) =>
        silence.status?.state === SilenceStates.Active && isRuleSilenced(firingRule, silence),
    );

    if (firingRule.silencedBy.length) {
      firingRule.state = RuleStates.Silenced;

      firingRule.alerts.forEach((ruleAlert) => {
        if (firingRule.silencedBy?.some((silence) => isAlertSilenced(ruleAlert, silence))) {
          ruleAlert.state = AlertStates.Silenced;
        }
      });

      if (
        firingRule.alerts.length !== 0 &&
        firingRule.alerts.every((alert) => alert.state === AlertStates.Silenced)
      ) {
        firingRule.state = RuleStates.Silenced;

        firingRule.silencedBy = silences.filter(
          (silence) =>
            silence.status?.state === SilenceStates.Active &&
            firingRule.alerts.some((alert) => isAlertSilenced(alert, silence)),
        );
      }
    }
  });

  return firingRules;
};

const isAlertFiring = (alert: PrometheusAlert) =>
  alert?.state === AlertStates.Firing || alert?.state === AlertStates.Silenced;

const isRuleFiring = (rule: PrometheusRule) =>
  rule?.state === RuleStates.Firing ||
  rule?.state === RuleStates.Silenced ||
  rule?.state === RuleStates.Pending;

const isAlertSilenced = (alert: PrometheusAlert, silence: Silence): boolean =>
  isAlertFiring(alert) &&
  silence.matchers.every((matcher) => {
    const alertValue = alert.labels[matcher.name] ?? '';
    const isMatch = matcher.isRegex
      ? new RegExp(`^${matcher.value}$`).test(alertValue)
      : alertValue === matcher.value;
    return matcher.isEqual === false && alertValue ? !isMatch : isMatch;
  });

export const isRuleSilenced = (rule: PrometheusRule, silence: Silence): boolean =>
  isRuleFiring(rule) && rule.alerts.every((alert) => isAlertSilenced(alert, silence));

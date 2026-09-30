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

export const applySilences = ({
  alerts,
  silences,
  rules,
}: {
  silences: Array<Silence>;
  alerts: Array<Alert>;
  rules: Array<Rule>;
}): { silences: Array<Silence>; alerts: Array<Alert>; rules: Array<Rule> } => {
  const firingAlerts = alerts.filter(isAlertFiring);
  applySilencesToAlerts({ firingAlerts, silences });

  const firingRules = rules.filter(isRuleFiring);
  applySilencesToRules({ firingRules, silences });

  const appliedSilences = silences.map((silence) => {
    silence.firingAlerts = firingAlerts.filter((firingAlert) =>
      isAlertSilenced(firingAlert, silence),
    );
    return silence;
  });
  return { alerts, silences: appliedSilences, rules };
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

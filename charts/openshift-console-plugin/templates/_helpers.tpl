{{/*
Expand the name of the chart.
*/}}
{{- define "openshift-console-plugin.name" -}}
{{- default (default .Chart.Name .Release.Name) .Values.plugin.name | trunc 63 | trimSuffix "-" }}
{{- end }}


{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "openshift-console-plugin.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "openshift-console-plugin.labels" -}}
helm.sh/chart: {{ include "openshift-console-plugin.chart" . }}
{{ include "openshift-console-plugin.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "openshift-console-plugin.selectorLabels" -}}
{{- if or (.Values.plugin.features.acm.enabled) (.Values.plugin.features.incidents.enabled) }}
app: {{ .Values.plugin.features.name }}
app.kubernetes.io/name: {{ .Values.plugin.features.name }}
app.kubernetes.io/component: {{ .Values.plugin.features.name }}
app.kubernetes.io/part-of: {{ .Values.plugin.features.name }}
{{- else }}
app: {{ include "openshift-console-plugin.name" . }}
app.kubernetes.io/component: {{ .Values.plugin.features.name }}
app.kubernetes.io/name: {{ include "openshift-console-plugin.name" . }}
app.kubernetes.io/part-of: {{ include "openshift-console-plugin.name" . }}
{{- end }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the list of the features
*/}}
{{- define "openshift-console-plugin.features" -}}
{{- if and (.Values.plugin.features.acm.enabled) (.Values.plugin.features.incidents.enabled) }}
{{- printf "%s" "acm-alerting,incidents" }}
{{- else if .Values.plugin.features.acm.enabled }}
{{- printf "%s" "acm-alerting" }}
{{- else if .Values.plugin.features.incidents.enabled }}
{{- printf "%s" "incidents" }}
{{- end }}
{{- end }}

{{/*
Create the name secret containing the certificate
*/}}
{{- define "openshift-console-plugin.certificateSecret" -}}
{{ default (printf "%s-cert" (include "openshift-console-plugin.name" .)) .Values.plugin.certificateSecretName }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "openshift-console-plugin.serviceAccountName" -}}
{{- if .Values.plugin.serviceAccount.create }}
{{- default (include "openshift-console-plugin.name" .) .Values.plugin.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "openshift-console-plugin.patcherServiceAccountName" -}}
{{- if .Values.plugin.patcherServiceAccount.create }}
{{- default (printf "%s-patcher" (include "openshift-console-plugin.name" .)) .Values.plugin.patcherServiceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.patcherServiceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the patcher
*/}}
{{- define "openshift-console-plugin.patcherName" -}}
{{- printf "%s-patcher" (include "openshift-console-plugin.name" .) }}
{{- end }}

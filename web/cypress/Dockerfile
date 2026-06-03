# This Dockerfile is used by OpenShift CI for running the Monitorung UI plugin tests
FROM quay.io/redhat-distributed-tracing-qe/cypress-base:latest

COPY --from=quay.io/operator-framework/operator-sdk:v1.42.0 /usr/local/bin/operator-sdk /usr/local/bin/operator-sdk

# Copy current context and set working directory
COPY . /tmp/monitoring-plugin
RUN chmod -R 777 /tmp/monitoring-plugin
WORKDIR /tmp/monitoring-plugin/web/cypress
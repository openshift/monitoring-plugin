# This Dockerfile is used by OpenShift CI for running the Monitorung UI plugin tests
FROM quay.io/redhat-distributed-tracing-qe/cypress-base:latest

# Copy current context and set working directory
COPY . /tmp/monitoring-plugin
RUN chmod -R 777 /tmp/monitoring-plugin
WORKDIR /tmp/monitoring-plugin/web/cypress
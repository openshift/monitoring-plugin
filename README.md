# OpenShift Monitoring Plugin

This plugin enables frontend UI based on feature flags passed to the backend. These features are generally grouped under two sets, those deployed by the [Cluster Monitoring Operator](https://github.com/openshift/cluster-monitoring-operator) (alerting, dashboards, metrics and targets) and those deployed by the [Cluster Observability Operator](https://github.com/rhobs/observability-operator) (ACM Alerting, Perses Dashboards, Incidents). CMO is included and enabled by default on most installations of OpenShift so observability signals needed for these features are expected to be present in any cluster, while the COO features utilize optional observability signals which are installed through COO. Information on running the plugin as it if were deployed through CMO can be found under the [monitoring-plugin](#monitoring-plugin) heading and the other set can be found under the [monitoring-console-plugin](#monitoring-console-plugin) heading.

## Feature Flags

Feature flags should be added to the Feature enum [here](pkg/server/server.go) and to the useFeatures hook [here](web/src/shared/hooks/useFeatures.ts). Whenever a feature is enabled, a set of related feature extension points is included in the plugin-manifest.json served by the backend. These feature extension points are created through the use of [json-patches](https://datatracker.ietf.org/doc/html/rfc6902), such as the `acm-alerting` patch [here](config/acm-alerting.patch.json). The server looks for a patch in the format of `{feature-flag-name}.patch.json` to apply. Some feature flags, such as `acm-alerting` require other flags to be set such as `alertmanager` and `thanos-querier` to instruct the backend how to communicate with the observability signals they utilize

| Feature           | OCP Version |
|-------------------|-------------|
| acm-alerting      | 4.14+       |
| perses-dashboards | 4.14+       |
| incidents         | 4.17+       |
| alerting          | 5.0+        |
| legacy-dashboards | 5.0+        |
| metrics           | 5.0+        |
| targets           | 5.0+        |


## monitoring-plugin

This section describes knowledge helpful to development of the default monitoring-plugin.

### Docker image

Before you can deploy the plugin on a cluster, you must build an image and push it to an image registry.

1. Build the image:

   ```sh
   docker build -t quay.io/my-repositroy/my-plugin:latest .
   ```

2. Run the image:

   ```sh
   docker run -it --rm -d -p 9001:80 quay.io/my-repository/my-plugin:latest
   ```

3. Push the image:

   ```sh
   docker push quay.io/my-repository/my-plugin:latest
   ```

NOTE: If you have a Mac with Apple silicon, you will need to add the flag `--platform=linux/amd64` when building the image to target the correct platform to run in-cluster. We recommend utilizing the `make build-image` action to build and push the image.

### Deployment on cluster

A [Helm](https://helm.sh) chart is available to deploy the plugin to an OpenShift environment.

The following Helm parameters are required:

`plugin.image`: The location of the image containing the plugin that was previously pushed

Additional parameters can be specified if desired. Consult the chart [values](charts/openshift-console-plugin/values.yaml) file for the full set of supported parameters.

#### Installing the Helm Chart

Install the chart into a new namespace or an existing namespace as specified by the `my-plugin-namespace` parameter and providing the location of the image within the `plugin.image` parameter by using the following command:

```shell
helm upgrade -i monitoring-plugin charts/openshift-console-plugin -n my-plugin-namespace --create-namespace --set plugin.image=my-plugin-image-location
```

### Running using Devspace

Install the [devspace](https://www.devspace.sh/docs/getting-started/installation) cli.

1. Install the frontend dependencies running `make install-frontend`.
2. Start the frontend `make start-frontend`.
4. Select the namespace the monitoring-plugin is located in `devspace use namespace openshift-monitoring`.
5. In a different terminal start the devspace sync `devspace dev`.

When running the `devspace dev` command, the pipeline will run the `scale_down_cmo` function to prevent CMO from fighting over control of the pod. After CMO has been scaled down, devspace will "take over" the monitoring-plugin pod, grabbing all of the certificates and backend binary and configuration to run in the devspace pod. The backend will stay the same as what is built in the Dockerfile.devspace file, only the frontend changes will be reflected live in cluster.

After the pod has been "taken over" Devspace begins a sync process which will mirror changes from you local `./web/dist` folder into the `/opt/app-root/web/dist` folder in the devspace pod. You can then make changes to your frontend files locally which will trigger the locally running webpack dev server to rebuild the `./web/dist` folder, which will trigger Devspace to re-synced. You can then reload your console webpage to see your local changes running in the cluster.

The devspace command will enable all features from a single deployment for easy development, however it does not install other needed observability signals, which will need to be created through COO.

After development you can run `devspace purge` which will cleanup and then call the `scale_up_cmo` pipeline.

### Local Development

#### Dependencies

1. [Node.js 22+](https://nodejs.org/en/) and [npm](https://www.npmjs.com/) are required
2. [oc](https://mirror.openshift.com/pub/openshift-v4/clients/oc/4.4/)
3. [podman 3.2.0+](https://podman.io) or [Docker](https://www.docker.com)
4. An OpenShift cluster

#### Running Locally

```
# Login to an OpenShift cluster
$ oc login <clusterAddress> -u <username> -p <password>

# Start podman (or Docker)
$ podman machine init
$ podman machine start

# Install dependencies
$ make install

# Run the frontend
$ make start-frontend
# In a separate terminal
# Run the backend
$ make start-backend
# In a separate terminal
$ make start-console
```

The application will be running at [localhost:9000](http://localhost:9000/).

#### Local Development Troubleshooting

1. Disable cache. Select 'disable cache' in your browser's DevTools > Network > 'disable cache'. Or use private/incognito mode in your browser.
2. Enable higher log verbosity by setting `-log-level=trace` when starting the plugin backend. For more options to set log level see [logrus documentation](https://github.com/sirupsen/logrus?tab=readme-ov-file#level-logging).

## monitoring-console-plugin (mcp)

### Dependencies
1. [Local Development Dependencies](README#Dependencies)
2. [yq](https://github.com/mikefarah/yq) for acm deployment
3. sed ([gnu-sed](https://formulae.brew.sh/formula/gnu-sed) for mac, with sed being aliased to that gnu-sed)


### Building an image
Images for the mcp can be built by running the following command. Due to the limitation of linux/amd64 image builds on Apple Silicon Macs's, some of the changes are run locally and not just in the Dockerfiles. If you are on a Mac, it is not suggested to cancel the exection of this scipt part way through

```bash
make build-dev-mcp-image
```

#### ACM

Due to the extensive number of items which would need to be run to locally run the ACM perspective, the suggested development pattern is instead repeat installations with helm. A small number of scripts have been put together to help you deploy the monitoring-plugin in its `acm-alerting` configuration. REGISTRY_ORG and TAG variables are available to adjust the quay image generated and used for deployment. Certain build time changes to the codebase are created when running these scripts.

```bash
make deploy-acm
```

Once the code has been updated, make sure to update the helm chart and variables ([variable example](https://github.com/openshift/monitoring-plugin/blob/main/charts/openshift-console-plugin/values.yaml#L32), [chart example](https://github.com/openshift/monitoring-plugin/blob/main/charts/openshift-console-plugin/templates/deployment.yaml#L49)) for ease of deployment of your feature.

### Redux Store

Since the store for the `monitoring-plugin` is stored in the `openshift/console` codebase and updates to the store that are aren't tied directly to the OCP are needed, when the default extension points are removed due to the presence of a feature flag a duplicate store is created at the `.state.plugins.mcp` path. A combination of the `useFeatures` hook and the `getLegacyObserveState` (which is dependent on the perspective) can be used to retrieve the state from the redux store based on the mode the plugin was deployed in.

### Local Development

```
# Login to an OpenShift cluster
$ oc login <clusterAddress> -u <username> -p <password>

# Start podman (or Docker) - Linux machines can skip this part 
$ podman machine init
$ podman machine start

# Install dependencies
$ make install

# Run the application
$ make start-frontend

# In a separate terminal
$ make start-console

# In a separate terminal
$ make start-coo-backend
```

`make start-coo-backend` will inject the `alerting,targets,legacy-dashboards,metrics,incidents,perses-dashboards` features.

#### Local Development with Perses Proxy
The bridge script `start-console.sh` is configured to proxy to a local Perses instance running at port `:8080`. To run the local Perses instance you will need to clone the [perses/perses](https://github.com/perses/perses) repository and follow the start up instructions in [ui/README.md](https://github.com/perses/perses/blob/63601751674403f626d1dea3dec168bdad0ef1c7/ui/README.md) :

```
# Clone the perses/perses repo
$ git clone https://github.com/perses/perses.git
$ cd perses

# Follow the instructions in ui/README.md
$ cd ui
$ npm install
$ npm run build
$ ./scripts/api_backend_dev.sh

# Lastly navigate to http://localhost:8080/ to see Perses app running
```

##### Install COO && Perses Datasource && Perses Sample Dashboard 
1. Install COO through the OpenShift UI > OperatorHub > Cluster Observability Operator 
2. Install UIPlugin > monitoring 
3. oc apply -f <PERSES_DATASOURCE_YAML>
   - See sample yaml [here](https://github.com/observability-ui/development-tools/blob/main/monitoring-plugin/monitoring-console-plugin/perses/thanos-querier-datasource.yaml) 
4. oc apply -f <PERSES_DASHBOARD_YAML>
   - See sample yaml  [here](https://github.com/observability-ui/development-tools/blob/main/monitoring-plugin/monitoring-console-plugin/perses/perses-dashboard.yaml)

##### Port forward Perses Datasource 
To use the PERSES_DATASOURCE you deployed above, you'll need to forward it to your local machine then proxy it using the local Perses Instance. 

```
# Forward cluster Prometheus Instance to localhost:9090
oc port-forward -n openshift-monitoring service/prometheus-operated 9090:9090

# Test is port-forward returns Prometheus data from query 'up'
curl "http://localhost:9090/api/v1/query?query=up"
```

Adjust Perses local instance http://localhost:8080/ to use the a proxy to http://localhost:9090/ instead of http://demo.prometheus.io.

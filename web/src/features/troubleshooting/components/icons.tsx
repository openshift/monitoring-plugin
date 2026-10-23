import { IconDefinition } from '@fortawesome/fontawesome-common-types';
import {
  faChartGantt,
  faChartLine,
  faCircle,
  faCircleDot,
  faClockRotateLeft,
  faClone,
  faCube,
  faFileLines,
  faFileShield,
  faFolder,
  faHexagonNodes,
  faListCheck,
  faNetworkWired,
  faServer,
  faShuffle,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  AttentionBellIcon,
  ClusterIcon,
  OutlinedHddIcon,
  ServiceIcon,
} from '@patternfly/react-icons';
import { Class } from '../korrel8r/types';
import { KubernetesIcon } from './KubernetesIcon';
import { ReactElement } from 'react';

export type IconType = ReactElement;
export type IconMap = { [key: string]: IconType };

const props = { width: 25, height: 25 };

const fa = (icon: IconDefinition): IconType => <FontAwesomeIcon icon={icon} {...props} />;

export const domainIcons: IconMap = {
  alert: <AttentionBellIcon {...props} />,
  k8s: <KubernetesIcon {...props} />,
  log: fa(faFileLines),
  metric: fa(faChartLine),
  netflow: fa(faNetworkWired),
  trace: fa(faChartGantt),
};

export const classIcons: IconMap = {
  'k8s:ConfigMap.v1': fa(faSliders),
  'k8s:CronJob.v1': fa(faClockRotateLeft),
  'k8s:Deployment.v1.apps': fa(faServer),
  'k8s:DaemonSet.v1': fa(faServer),
  'k8s:StatefulSet.v1': fa(faServer),
  'k8s:Endpoints.v1': fa(faHexagonNodes),
  'k8s:EndpointSlice.v1.discovery.k8s.io': fa(faHexagonNodes),
  'k8s:Event.v1': fa(faListCheck),
  'k8s:Event.v1.events.k8s.io': fa(faListCheck),
  'k8s:Namespace.v1': fa(faFolder),
  'k8s:Node.v1': <OutlinedHddIcon {...props} />,
  'k8s:Secret.v1': fa(faFileShield),
  'k8s:ReplicaSet.v1.apps': fa(faClone),
  'k8s:PersistentVolume.v1': fa(faCircleDot),
  'k8s:PersistentVolumeClaim.v1': fa(faCircle),
  'k8s:Pod.v1': fa(faCube),
  'k8s:Route.v1.route.openshift.io': fa(faShuffle),
  'k8s:Gateway.v1.gateway.networking.k8s.io': fa(faShuffle),
  'k8s:Ingress.v1.networking.k8s.io': fa(faShuffle),
  'k8s:Service.v1': <ServiceIcon {...props} />,
};

export const fallbackIcon: IconType = <ClusterIcon {...props} />;

/**
 * Returns an icon for a korrel8r.Class.
 *
 * @param c - The Korrel8r class containing domain and name
 * @returns React icon element.
 */
export const getIcon = (c: Class): IconType => {
  return classIcons[c.toString()] || domainIcons[c.domain] || fallbackIcon;
};

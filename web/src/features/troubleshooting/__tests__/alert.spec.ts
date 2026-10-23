import { AlertDomain } from '../korrel8r/alert';
import { Query, URIRef } from '../korrel8r/types';

describe('AlertNode.fromURL', () => {
  it.each([
    {
      url:
        'monitoring/alerts/12345?prometheus=openshift-monitoring/k8s&severity=warning&alertname=KubePodCrashLooping&' +
        'container=bad-deployment&endpoint=https-main&job=kube-state-metrics&namespace=default&pod=bad-deployment&' +
        'reason=CrashLoopBackOff&service=kube-state-metrics&uid=00000000-0000-0000-0000-000000000000',
      query:
        'alert:alert:{"severity":"warning","alertname":"KubePodCrashLooping","container":"bad-deployment",' +
        '"endpoint":"https-main","job":"kube-state-metrics","namespace":"default","pod":"bad-deployment",' +
        '"reason":"CrashLoopBackOff","service":"kube-state-metrics","uid":"00000000-0000-0000-0000-000000000000"}',
    },
    { url: 'monitoring/alerts', query: 'alert:alert:{}' },
    {
      url: 'monitoring/alerts?alertname=KubePodCrashLooping&container=bad-deployment&namespace=default&pod=bad-pod',
      query:
        'alert:alert:{"alertname":"KubePodCrashLooping","container":"bad-deployment","namespace":"default","pod":"bad-pod"}',
    },
    {
      url: 'monitoring/alerts/12345',
      query: 'alert:alert:{"alertname":"FooAlert"}',
    },
    {
      url: 'monitoring/alertrules/12345',
      query: 'alert:alert:{"alertname":"FooAlert"}',
    },
    {
      url: 'monitoring/alertrules/12345?alertname=BarAlert',
      query: 'alert:alert:{"alertname":"BarAlert"}',
    },
    {
      url: 'monitoring/alerts/2848814126?managed_cluster=3f790d42-1f5b-4946-8bb2-ab4cfcbf255d&namespace=openshift-monitoring&severity=none&alertname=Watchdog',
      query:
        'alert:alert:{"namespace":"openshift-monitoring","severity":"none","alertname":"Watchdog"}',
    },
  ])('converts $url', ({ url, query }) => {
    const domain = new AlertDomain(new Map([['12345', 'FooAlert']]));
    expect(domain.linkToQuery(new URIRef(url)).toString()).toEqual(query);
  });
});

describe('AlertDomain.fromQuery', () => {
  it.each([
    {
      query:
        'alert:alert:{"alertname":"KubePodCrashLooping","container":"bad-deployment","namespace":"default","pod":"bad-deployment"}',
      url: 'monitoring/alerts/42?alertname=KubePodCrashLooping&container=bad-deployment&namespace=default&pod=bad-deployment',
      idToName: new Map([['42', 'KubePodCrashLooping']]),
    },
    { query: 'alert:alert:{}', url: 'monitoring/alerts' },
    {
      query: 'alert:alert:{"alertname":"FooAlert"}',
      url: 'monitoring/alertrules/12345',
      idToName: new Map([['12345', 'FooAlert']]),
    },
  ])('converts $query', ({ url, query, idToName }) => {
    expect(new AlertDomain(idToName).queryToLink(Query.parse(query))).toEqual(new URIRef(url));
  });

  it('Query => URL => Query for alerts with labels', () => {
    const domain = new AlertDomain(new Map([['42', 'KubePodCrashLooping']]));
    const query =
      'alert:alert:{"alertname":"KubePodCrashLooping","container":"bad-deployment","namespace":"default","pod":"bad-pod"}';
    const url =
      'monitoring/alerts/42?alertname=KubePodCrashLooping&container=bad-deployment&namespace=default&pod=bad-pod';
    const want = domain.queryToLink(Query.parse(query));
    expect(want).toEqual(new URIRef(url));
    expect(domain.linkToQuery(want)).toEqual(Query.parse(query));
  });

  it('Query => URL => Query for alertrules with only alertname', () => {
    const domain = new AlertDomain(new Map([['12345', 'FooAlert']]));
    const query = 'alert:alert:{"alertname":"FooAlert"}';
    const url = 'monitoring/alertrules/12345';
    const want = domain.queryToLink(Query.parse(query));
    expect(want).toEqual(new URIRef(url));
    expect(domain.linkToQuery(want)).toEqual(Query.parse(query));
  });
});

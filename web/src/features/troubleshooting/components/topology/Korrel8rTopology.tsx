import { Badge, Label, LabelGroup, Title, Tooltip } from '@patternfly/react-core';
import RetweetIcon from '@patternfly/react-icons/dist/dynamic/icons/retweet-icon';
import CrosshairsIcon from '@patternfly/react-icons/dist/dynamic/icons/crosshairs-icon';
import InfoCircleIcon from '@patternfly/react-icons/dist/dynamic/icons/info-circle-icon';
import {
  action,
  ComponentFactory,
  ContextMenuItem,
  createTopologyControlButtons,
  DagreLayout,
  Decorator,
  DEFAULT_DECORATOR_RADIUS,
  defaultControlButtonsOptions,
  DefaultEdge,
  DefaultGroup,
  DefaultNode,
  Edge,
  EdgeModel,
  EdgeStyle,
  ElementModel,
  getDefaultShapeDecoratorCenter,
  Graph,
  GraphComponent,
  GraphElement,
  Model,
  ModelKind,
  Node,
  NodeModel,
  NodeShape,
  NodeStatus,
  SELECTION_EVENT,
  TopologyControlBar,
  TopologyQuadrant,
  TopologyView,
  Visualization,
  VisualizationProvider,
  VisualizationSurface,
  withContextMenu,
  WithContextMenuProps,
  withDragNode,
  WithDragNodeProps,
  withPanZoom,
  withSelection,
  WithSelectionProps,
} from '@patternfly/react-topology';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useDomains } from '../../hooks/useDomains';
import { useLocationQuery } from '../../hooks/useLocationQuery';
import { useNavigateToQuery } from '../../hooks/useNavigateToQuery';
import * as korrel8r from '../../korrel8r/types';
import { LEFT_TO_RIGHT, TOP_TO_BOTTOM, setRankdir } from '../../redux-actions';
import { State } from '../../redux-reducers';
import { getIcon } from '../icons';
import './korrel8rtopology.css';
import { mergeStatusCounts, statusForNode, statusName, toStatus } from './status';

type TopologyNodeData = korrel8r.Node & { isStart?: boolean; label: string };

const nodeBadge = (node: korrel8r.Node): string => {
  if (node.queries?.length > 1) {
    return `${node.queries[0].count}/${node.count}`;
  }
  return `${node?.count ?? ''}`;
};

const statusTooltip = (statusCounts: korrel8r.StatusCount[]): React.ReactNode => {
  if (statusCounts.length === 0) return undefined;
  return (
    <LabelGroup>
      {statusCounts.map(({ status, count }) => (
        <Label key={status} status={statusName(toStatus(status))}>
          <Badge className="tp-plugin__topology_marker_badge">{count}</Badge> {status}
        </Label>
      ))}
    </LabelGroup>
  );
};

interface Korrel8rTopologyNodeProps {
  element: Node<NodeModel, TopologyNodeData>;
}

const NodeDecorator: FC<{
  show: boolean;
  quadrant: TopologyQuadrant;
  element: Node<NodeModel, TopologyNodeData>;
  tooltipContent: React.ReactNode;
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ show, quadrant, element, tooltipContent, icon, onClick }) => {
  const ref = useRef<SVGGElement>(null);
  if (!show) return null;
  const { x, y } = getDefaultShapeDecoratorCenter(quadrant, element);
  return (
    <Tooltip triggerRef={ref} content={tooltipContent}>
      <Decorator
        x={x}
        y={y}
        radius={DEFAULT_DECORATOR_RADIUS}
        showBackground
        onClick={onClick}
        icon={icon}
        innerRef={ref}
      />
    </Tooltip>
  );
};

const Korrel8rTopologyNode: FC<
  Korrel8rTopologyNodeProps & WithContextMenuProps & WithSelectionProps & WithDragNodeProps
> = ({ element, onSelect, selected, onContextMenu, contextMenuOpen, dragNodeRef }) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const node = element.getData();
  const [statusCounts, status] = mergeStatusCounts(node);
  const nodeStatus = node.disabled ? undefined : statusForNode(status);
  const tooltip = node.disabled ? undefined : statusTooltip(statusCounts);
  const isInfo = nodeStatus === NodeStatus.info;

  const topologyNode = (
    <DefaultNode
      element={element}
      onSelect={onSelect}
      selected={selected}
      onContextMenu={onContextMenu}
      contextMenuOpen={contextMenuOpen}
      dragNodeRef={dragNodeRef}
      hover={false}
      className={node.disabled ? 'tp-plugin__topology_node--disabled' : undefined}
      label={node.label}
      badge={nodeBadge(node)}
      badgeClassName="tp-plugin__topology_node_badge"
      hideContextMenuKebab={!!node?.disabled || node?.queries?.length === 1}
      onStatusDecoratorClick={(e) => onSelect(e)}
      nodeStatus={nodeStatus}
      showStatusDecorator={node.disabled ? true : !isInfo && !!nodeStatus}
      statusDecoratorTooltip={node.disabled ? node.disabled : !isInfo ? tooltip : undefined}
      attachments={
        <>
          <NodeDecorator
            show={isInfo && !!tooltip}
            quadrant={TopologyQuadrant.upperLeft}
            element={element}
            tooltipContent={tooltip}
            icon={
              <g className="pf-topology__node__decorator__status">
                <InfoCircleIcon className="pf-m-info" />
              </g>
            }
            onClick={(e) => onSelect(e)}
          />
          <NodeDecorator
            show={!!node.isStart && !node.disabled}
            quadrant={TopologyQuadrant.lowerRight}
            element={element}
            tooltipContent={t('Search started here')}
            icon={
              <g className="tp-plugin__topology_start_decorator">
                <CrosshairsIcon />
              </g>
            }
          />
        </>
      }
    >
      <g transform={`translate(25, 25)`}>{getIcon(node?.class)}</g>
    </DefaultNode>
  );
  if (node.disabled) {
    return (
      <g className="tp-plugin__topology_node--disabled">
        <title>{String(node.disabled)}</title>
        {topologyNode}
      </g>
    );
  }
  return topologyNode;
};

const Korrel8rEdge: FC<{ element: Edge<EdgeModel, { rules: korrel8r.Rule[] }> }> = ({
  element,
  ...rest
}) => {
  const rules = element.getData()?.rules ?? [];
  const ruleNames = rules.map((r) => r.name).join('\n');
  return (
    <DefaultEdge element={element} {...rest}>
      {ruleNames && <title>{ruleNames}</title>}
    </DefaultEdge>
  );
};

const NODE_SHAPE = NodeShape.ellipse;
const NODE_DIAMETER = 75;
const PADDING = 30;
const ANCHOR_ID = '__anchor__';

export const Korrel8rTopology: FC<{
  graph: korrel8r.Graph;
  startNode?: string;
  loggingAvailable: boolean;
  netobserveAvailable: boolean;
  constraint: korrel8r.Constraint;
}> = ({ graph, startNode, loggingAvailable, netobserveAvailable, constraint }) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const domains = useDomains();
  const navigateToQuery = useNavigateToQuery();
  const { query } = useLocationQuery();
  const dispatch = useDispatch();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rankdir: string = useSelector((s: State) => s.plugins?.tp?.get('rankdir')) ?? LEFT_TO_RIGHT;

  useEffect(() => {
    if (!query) {
      setSelectedIds([]);
      return;
    }
    const id = query.class.toString();
    setSelectedIds(graph.node(id) ? [id] : []);
  }, [graph, query]);

  const nodes: NodeModel[] = useMemo((): NodeModel[] => {
    const result: NodeModel[] = graph.nodes.map((node: korrel8r.Node) => {
      const label = node.class ? domains.classLabel(node.class) : `[${node.id}]`;
      const data: TopologyNodeData = { ...node, isStart: node.id === startNode, label };
      if (data.disabled) {
        // eslint-disable-next-line no-console
        console.warn(`korrel8r node: ${data.disabled}`);
        data.disabled = t('Unable to find Console Link');
      } else if (data.class.domain === 'log' && !loggingAvailable) {
        data.disabled = t('Logging Plugin Disabled');
      } else if (data.class.domain === 'netflow' && !netobserveAvailable) {
        data.disabled = t('Netflow Plugin Disabled');
      }
      return {
        id: data.id,
        type: 'node',
        width: NODE_DIAMETER,
        height: NODE_DIAMETER,
        shape: NODE_SHAPE,
        data,
      };
    });
    // Anchor and start nodes must be first so dagre's DFS cycle-breaker visits them before other
    // nodes, ensuring back-edges TO the start node are reversed (not edges FROM it).
    if (startNode && result.some((n) => n.id === startNode)) {
      const startIdx = result.findIndex((n) => n.id === startNode);
      const [start] = result.splice(startIdx, 1);
      result.unshift(
        {
          id: ANCHOR_ID,
          type: 'anchor',
          width: 1,
          height: 1,
          shape: NODE_SHAPE,
          data: {},
        },
        start,
      );
    }
    return result;
  }, [graph, startNode, loggingAvailable, netobserveAvailable, t, domains]);

  const edges = useMemo(() => {
    const result = graph.edges.map((edge: korrel8r.Edge) => {
      return {
        id: `edge:${edge.start.id} -${edge.goal.id} `,
        type: 'edge',
        source: edge.start.id,
        target: edge.goal.id,
        edgeStyle: EdgeStyle.default,
        data: { rules: edge.rules },
      };
    });
    if (startNode && nodes.some((n) => n.id === ANCHOR_ID)) {
      result.push({
        id: `edge:${ANCHOR_ID}-${startNode}`,
        type: 'anchor',
        source: ANCHOR_ID,
        target: startNode,
        edgeStyle: EdgeStyle.default,
        data: { rules: [] },
      });
    }
    return result;
  }, [graph, startNode, nodes]);

  const selectionAction = useCallback(
    (selected: Array<string>) => {
      const id = selected?.[0]; // Select only one at a time.
      setSelectedIds([id]);
      const node = graph.node(id);
      if (!node || node.disabled) return;
      navigateToQuery(node.queries?.[0]?.query, constraint);
    },
    [graph, navigateToQuery, setSelectedIds, constraint],
  );

  const nodeMenu = useCallback(
    (e: GraphElement<ElementModel, korrel8r.Node>): React.ReactElement[] => {
      const node: korrel8r.Node = e.getData();
      if (!!node.disabled || !node.class) {
        return [
          <ContextMenuItem isDisabled={true} key={node.id}>
            <Title headingLevel="h4">{node.id}</Title>
          </ContextMenuItem>,
        ];
      }
      const menu = [
        <ContextMenuItem isDisabled={true} key={node.class.toString()}>
          <Title headingLevel="h4">{node.class.toString()}</Title>
        </ContextMenuItem>,
      ];
      node?.queries?.forEach((qc) =>
        menu.push(
          <ContextMenuItem
            key={qc.query.toString()}
            onClick={() => {
              navigateToQuery(qc.query, constraint);
              setSelectedIds([node.id]);
              navigator.clipboard.writeText(qc.query.toString());
            }}
          >
            <Badge>{`${qc.count}`}</Badge> {qc.query.selector}
            {qc.statuses?.length > 0 && (
              <LabelGroup>
                {qc.statuses.map(({ status, count }) => (
                  <Label key={status} isCompact status={statusName(toStatus(status))}>
                    {status} {count}
                  </Label>
                ))}
              </LabelGroup>
            )}
          </ContextMenuItem>,
        ),
      );
      return menu;
    },
    [navigateToQuery, setSelectedIds, constraint],
  );

  const componentFactory: ComponentFactory = useCallback(
    (kind: ModelKind, type: string) => {
      if (type === 'group') return DefaultGroup;
      if (type === 'anchor') return () => null;
      switch (kind) {
        case ModelKind.graph:
          return withPanZoom()(GraphComponent);
        case ModelKind.node:
          return withDragNode()(withContextMenu(nodeMenu)(withSelection()(Korrel8rTopologyNode)));
        case ModelKind.edge:
          return Korrel8rEdge;
        default:
          return undefined;
      }
    },
    [nodeMenu],
  );

  const controller = useMemo(() => {
    const model: Model = {
      nodes,
      edges,
      graph: {
        id: 'korrel8r_graph',
        type: 'graph',
        layout: 'Dagre',
      },
    };

    const controller = new Visualization();
    controller.registerLayoutFactory(
      (_, graph: Graph) =>
        new DagreLayout(graph, {
          rankdir,
          ranksep: 10,
          nodeDistance: 15,
          edgesep: 5,
          ranker: 'network-simplex',
        }),
    );
    controller.fromModel(model, false);
    return controller;
  }, [nodes, edges, rankdir]);

  // NOTE: For some reason, the controller function above cannot depend on memoized functions
  // like selectionAction or componentfactory. Using a separate memo works. Strange.
  // The Visualization below must depend on controller 2.
  const controller2 = useMemo(() => {
    controller.addEventListener(SELECTION_EVENT, selectionAction);
    controller.registerComponentFactory(componentFactory);
    controller.setFitToScreenOnLayout(true, PADDING);
    return controller;
  }, [controller, selectionAction, componentFactory]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.getGraph().fit(PADDING), 150);
    });
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [controller]);

  return (
    <div
      ref={containerRef}
      className="tp-plugin__topology"
      style={{ width: '100%', height: '100%' }}
    >
      <TopologyView
        controlBar={
          <TopologyControlBar
            controlButtons={createTopologyControlButtons({
              ...defaultControlButtonsOptions,
              zoomInCallback: action(() => {
                controller.getGraph().scaleBy(4 / 3);
              }),
              zoomOutCallback: action(() => {
                controller.getGraph().scaleBy(0.75);
              }),
              fitToScreenCallback: action(() => {
                controller.getGraph().fit(PADDING);
              }),
              resetViewCallback: action(() => {
                controller.getGraph().reset();
                controller.getGraph().layout();
              }),
              legend: false,
              customButtons: [
                {
                  id: 'layout-direction',
                  icon: <RetweetIcon />,
                  tooltip: t('Toggle layout direction'),
                  ariaLabel: t('Toggle layout direction'),
                  callback: () =>
                    dispatch(setRankdir(rankdir === LEFT_TO_RIGHT ? TOP_TO_BOTTOM : LEFT_TO_RIGHT)),
                },
              ],
            })}
          />
        }
      >
        <VisualizationProvider controller={controller2}>
          <VisualizationSurface state={{ selectedIds }} />
        </VisualizationProvider>
      </TopologyView>
    </div>
  );
};

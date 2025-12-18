import { VictoryPortal } from 'victory';
import './incidents-styles.css';

const TOOLTIP_MAX_HEIGHT = 300;
const TOOLTIP_MAX_WIDTH = 650;
export const IncidentsTooltip = ({
  x,
  y,
  x0,
  text,
}: {
  x?: number;
  y?: number;
  x0?: number;
  text?: string | Array<string>;
}) => {
  const textArray: Array<string> = Array.isArray(text) ? text : [text];
  const posx = x - (x - x0) / 2 - TOOLTIP_MAX_WIDTH / 2;
  const tooltipHeight = textArray.length === 6 ? 165 : 145;
  const posy = y - tooltipHeight;

  return (
    <VictoryPortal>
      <foreignObject height={TOOLTIP_MAX_HEIGHT} width={TOOLTIP_MAX_WIDTH} x={posx} y={posy}>
        <div className="incidents__tooltip-wrap">
          <div className="incidents__tooltip">
            {textArray.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
          <div className="incidents__tooltip-arrow" />
        </div>
      </foreignObject>
    </VictoryPortal>
  );
};

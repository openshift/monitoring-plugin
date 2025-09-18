import { VictoryPortal } from 'victory';
import './incidents-styles.css';

const TOOLTIP_MAX_HEIGHT = 300;
const TOOLTIP_MAX_WIDTH = 500;
export const IncidentsTooltip = ({
  x,
  y,
  x0,
  height,
  text,
}: {
  x?: number;
  y?: number;
  x0?: number;
  height?: number;
  text?: string | Array<string>;
}) => {
  const posx = x - (x - x0) / 2 - TOOLTIP_MAX_WIDTH / 2;
  const posy = y - Math.min(height || 0, TOOLTIP_MAX_HEIGHT) / 2 - 20;
  const textArray: Array<string> = Array.isArray(text) ? text : [text];

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

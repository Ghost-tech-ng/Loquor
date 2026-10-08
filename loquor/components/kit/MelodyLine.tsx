import Svg, { Line, Polyline } from "react-native-svg";

import { AURORA, CHROME } from "../../theme";
import { semitones, type PitchPoint } from "../../features/games/pitch";

const W = 320;
const ST_LO = semitones(70);
const ST_HI = semitones(400);

function y(hz: number, h: number): number {
  const st = Math.max(ST_LO, Math.min(ST_HI, semitones(hz)));
  return h - ((st - ST_LO) / (ST_HI - ST_LO)) * h;
}

/**
 * The pitch contour of a take. With `window` it scrolls, showing the last
 * `window` seconds up to `until`; without it, the whole take fits the width
 * and `until` reveals it left to right, so it can draw in sync with a replay.
 */
export function MelodyLine({
  points,
  until,
  window,
  height = 120,
  color = AURORA.mint,
}: {
  points: readonly PitchPoint[];
  until?: number;
  window?: number;
  height?: number;
  color?: string;
}) {
  const end = points.length ? points[points.length - 1]!.t : 0;
  const span = window ?? Math.max(end, 1);
  const shownTo = until ?? end;
  const from = window ? Math.max(0, shownTo - window) : 0;
  const visible = points.filter((p) => p.t >= from && p.t <= shownTo && p.clarity >= 0.7);

  // Break the line wherever a gap means a new phrase, so silence reads as silence.
  const runs: string[] = [];
  let run: string[] = [];
  visible.forEach((p, i) => {
    if (i > 0 && p.t - visible[i - 1]!.t > 0.12) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
    }
    const x = ((p.t - from) / span) * W;
    run.push(`${x.toFixed(1)},${y(p.hz, height).toFixed(1)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
      {[110, 165, 220].map((hz) => (
        <Line key={hz} x1={0} x2={W} y1={y(hz, height)} y2={y(hz, height)} stroke={CHROME.carve} strokeWidth={0.5} />
      ))}
      {runs.map((pts, i) => (
        <Polyline
          key={i}
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

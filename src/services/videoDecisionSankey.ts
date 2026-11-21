import type { FlowColumn, FlowLink, ThemeEvolution } from "@/services/videoDecisionLog";

const TOP = 32;
const GAP = 8;
const NODE_W = 10;
const LEFT = 210;
const RIGHT_PAD = 240;

export interface SankeyNodeLayout {
  column: number;
  name: string;
  count: number;
  x: number;
  y: number;
  h: number;
}

export interface SankeyBandLayout {
  key: string;
  source: string;
  /** Null when the session has no next played video. The band stops beside the source. */
  target: string | null;
  count: number;
  column: number;
  x0: number;
  x1: number;
  sourceY: number;
  sourceH: number;
  targetY: number;
  targetH: number;
}

export interface SankeyLayout {
  width: number;
  height: number;
  columns: { label: string; x: number; nodes: SankeyNodeLayout[] }[];
  bands: SankeyBandLayout[];
}

export function videoFlowColumns(links: readonly FlowLink[], leftLabel: string, rightLabel: string): ThemeEvolution {
  const left = new Map<string, number>();
  const right = new Map<string, number>();
  for (const link of links) {
    left.set(link.source, (left.get(link.source) ?? 0) + link.count);
    right.set(link.target, (right.get(link.target) ?? 0) + link.count);
  }
  const nodes = (map: Map<string, number>) => [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
  if (links.length === 0) return { columns: [], steps: [] };
  return {
    columns: [
      { label: leftLabel, nodes: nodes(left) },
      { label: rightLabel, nodes: nodes(right) },
    ],
    steps: [[...links]],
  };
}

function placeColumn(column: FlowColumn, index: number, x: number, inner: number): SankeyNodeLayout[] {
  const sum = column.nodes.reduce((total, node) => total + node.count, 0) || 1;
  const usable = inner - GAP * Math.max(0, column.nodes.length - 1);
  let y = TOP;
  return column.nodes.map((node) => {
    const h = (usable * node.count) / sum;
    const placed = { column: index, name: node.name, count: node.count, x, y, h };
    y += h + GAP;
    return placed;
  });
}

/**
 * Bands leave each source stacked across its whole height, in proportion to the counts.
 * A session that stops keeps the remaining height as a short band that does not reach the next column.
 */
export function layoutSankey(flow: ThemeEvolution): SankeyLayout {
  if (flow.columns.length === 0) return { width: 0, height: 0, columns: [], bands: [] };
  const tallest = Math.max(...flow.columns.map((column) => column.nodes.length), 1);
  const inner = Math.max(560, tallest * 34);
  const columnGap = flow.columns.length <= 2 ? 460 : 280;
  const columns = flow.columns.map((column, index) => {
    const x = LEFT + index * columnGap;
    return { label: column.label, x, nodes: placeColumn(column, index, x, inner) };
  });
  const nodeAt = (column: number, name: string) => columns[column]?.nodes.find((node) => node.name === name);
  const bands: SankeyBandLayout[] = [];

  for (let index = 0; index < columns.length - 1; index += 1) {
    const links = flow.steps[index] ?? [];
    const targetSlots = new Map<string, { y: number; h: number }>();
    for (const node of columns[index + 1].nodes) {
      const incoming = links
        .filter((link) => link.target === node.name)
        .sort((a, b) => (nodeAt(index, a.source)?.y ?? 0) - (nodeAt(index, b.source)?.y ?? 0) || a.source.localeCompare(b.source, "fr"));
      const sum = incoming.reduce((total, link) => total + link.count, 0) || 1;
      let y = node.y;
      for (const link of incoming) {
        const h = node.h * (link.count / sum);
        targetSlots.set(`${link.source}\0${link.target}`, { y, h });
        y += h;
      }
    }
    for (const node of columns[index].nodes) {
      const outgoing = links
        .filter((link) => link.source === node.name && nodeAt(index + 1, link.target))
        .sort((a, b) => (targetSlots.get(`${a.source}\0${a.target}`)?.y ?? 0) - (targetSlots.get(`${b.source}\0${b.target}`)?.y ?? 0));
      let y = node.y;
      let used = 0;
      for (const link of outgoing) {
        const sourceH = node.count > 0 ? node.h * (link.count / node.count) : 0;
        const slot = targetSlots.get(`${link.source}\0${link.target}`);
        const target = nodeAt(index + 1, link.target);
        bands.push({
          key: `${index}:${link.source}:${link.target}`,
          source: link.source,
          target: link.target,
          count: link.count,
          column: index,
          x0: node.x + NODE_W,
          x1: target?.x ?? node.x + columnGap,
          sourceY: y,
          sourceH,
          targetY: slot?.y ?? y,
          targetH: slot?.h ?? sourceH,
          });
        y += sourceH;
        used += link.count;
      }
      const rest = node.count - used;
      if (rest > 0.001) {
        const sourceH = node.h * (rest / node.count);
        bands.push({
          key: `${index}:${node.name}:end`,
          source: node.name,
          target: null,
          count: rest,
          column: index,
          x0: node.x + NODE_W,
          x1: node.x + NODE_W + 42,
          sourceY: y,
          sourceH,
          targetY: y,
          targetH: sourceH,
        });
      }
    }
  }

  const lastX = columns[columns.length - 1]?.x ?? LEFT;
  return {
    width: lastX + RIGHT_PAD,
    height: TOP + inner + 12,
    columns,
    bands,
  };
}

export function bandPath(band: Pick<SankeyBandLayout, "x0" | "x1" | "sourceY" | "sourceH" | "targetY" | "targetH">): string {
  const mid = (band.x0 + band.x1) / 2;
  const y0 = band.sourceY;
  const y1 = band.sourceY + band.sourceH;
  const z0 = band.targetY;
  const z1 = band.targetY + band.targetH;
  return `M ${band.x0} ${y0} C ${mid} ${y0}, ${mid} ${z0}, ${band.x1} ${z0} L ${band.x1} ${z1} C ${mid} ${z1}, ${mid} ${y1}, ${band.x0} ${y1} Z`;
}

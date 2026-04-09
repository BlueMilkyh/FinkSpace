export const AGENT_COLORS = [
  "#e74c3c", // red
  "#e67e22", // orange
  "#f1c40f", // yellow
  "#2ecc71", // green
  "#3498db", // blue
  "#9b59b6", // purple
  "#e91e63", // pink
  "#00bcd4", // cyan
];

let colorIndex = 0;

export function getNextColor(): string {
  const color = AGENT_COLORS[colorIndex % AGENT_COLORS.length];
  colorIndex++;
  return color;
}

export function resetColorIndex(): void {
  colorIndex = 0;
}

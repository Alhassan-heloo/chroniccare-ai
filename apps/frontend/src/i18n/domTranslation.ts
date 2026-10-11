export function updateTextIfChanged(
  node: { textContent: string | null },
  next: string,
) {
  if (node.textContent === next) return false;
  node.textContent = next;
  return true;
}

export function isInsideChart(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  return element ? element.closest(".recharts-wrapper") !== null : false;
}

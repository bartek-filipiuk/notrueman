/**
 * Emotion spider/radar chart — CSS-only with animated bars.
 * 7 dimensions: happiness, curiosity, anxiety, boredom, excitement, contentment, frustration.
 */

const DIMENSIONS = [
  { key: "happiness", label: "Happiness", color: "#f1c40f" },
  { key: "curiosity", label: "Curiosity", color: "#3498db" },
  { key: "anxiety", label: "Anxiety", color: "#e74c3c" },
  { key: "boredom", label: "Boredom", color: "#95a5a6" },
  { key: "excitement", label: "Excitement", color: "#e67e22" },
  { key: "contentment", label: "Contentment", color: "#2ecc71" },
  { key: "frustration", label: "Frustration", color: "#9b59b6" },
];

export function createEmotionChart(): {
  container: HTMLElement;
  update: (emotions: Record<string, number>) => void;
} {
  const container = document.createElement("div");
  container.className = "emotion-chart";

  const title = document.createElement("div");
  title.className = "emotion-chart-title";
  title.textContent = "Emotions";
  container.appendChild(title);

  const barsContainer = document.createElement("div");
  barsContainer.className = "emotion-bars";
  container.appendChild(barsContainer);

  function render(emotions: Record<string, number>): void {
    barsContainer.innerHTML = DIMENSIONS.map(dim => {
      const val = emotions[dim.key] ?? 0;
      const pct = Math.round(val * 100);
      return `<div class="ec-row">
        <span class="ec-label">${dim.label}</span>
        <div class="ec-track">
          <div class="ec-fill" style="width:${pct}%;background:${dim.color};box-shadow:0 0 6px ${dim.color}40"></div>
        </div>
        <span class="ec-value">${pct}%</span>
      </div>`;
    }).join("");
  }

  render({});

  return {
    container,
    update: render,
  };
}

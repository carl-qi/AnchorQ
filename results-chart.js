(() => {
  const chart = document.querySelector("#results-chart");
  if (!chart) return;

  // Values and p-values from the supplied results figure.
  const tasks = [
    { id: "stack-cups", label: "Stack Cups", successes: [13, 15, 18] },
    { id: "toast-bread", label: "Toast Bread", successes: [11, 14, 19] },
    { id: "hang-towel", label: "Hang Towel", successes: [9, 9, 15] },
  ];
  const methods = [
    { id: "pi05", label: "π₀.₅", html: "π<sub>0.5</sub>", description: "Frozen π₀.₅ (DROID)" },
    { id: "dsrl", label: "DSRL", html: "DSRL", description: "DSRL" },
    { id: "anchorq", label: "AnchorQ", html: "AnchorQ", description: "AnchorQ (ours)" },
  ];
  const trialsPerTask = 20;
  const average = {
    id: "average",
    label: "Average",
    successes: methods.map((_, index) =>
      tasks.reduce((total, task) => total + task.successes[index], 0)),
  };

  function percent(value) {
    return `${Number(value.toFixed(1))}%`;
  }

  // Wilson score interval, z = Φ⁻¹(0.975), with 60 trials in the aggregate.
  function wilsonInterval(successes, trials) {
    const z = 1.959963984540054;
    const p = successes / trials;
    const denominator = 1 + z * z / trials;
    const center = (p + z * z / (2 * trials)) / denominator;
    const radius = z * Math.sqrt(p * (1 - p) / trials +
      z * z / (4 * trials * trials)) / denominator;
    return [(center - radius) * 100, (center + radius) * 100];
  }

  const groups = [...tasks, average];
  const legend = methods.map((method) => `
    <li class="chart-method-${method.id}">
      <span class="chart-swatch" aria-hidden="true"></span>
      <span>${method.html}${method.id === "pi05" ? ' <span class="legend-detail">zero-shot</span>' : ""}
        ${method.id === "anchorq" ? '<span class="legend-detail">(ours)</span>' : ""}</span>
    </li>`).join("");

  function renderBar(group, method, index) {
    const aggregate = group.id === "average";
    const trials = trialsPerTask * (aggregate ? tasks.length : 1);
    const successes = group.successes[index];
    const rate = successes / trials * 100;
    const interval = aggregate ? wilsonInterval(successes, trials) : null;
    const labelPosition = interval ? interval[1] : rate;
    const description = `${group.label}, ${method.description}: ${percent(rate)}, ` +
      `${successes} successes out of ${trials}.` +
      (interval ? ` 95% Wilson confidence interval: ${percent(interval[0])} to ${percent(interval[1])}.` :
        " Show this task's rollouts.");

    return `
      <div class="chart-bar-slot chart-method-${method.id}">
        <button type="button" class="chart-bar"
          style="height: ${rate}%"
          data-chart-task="${group.id}" data-chart-method="${method.id}"
          aria-label="${description}" ${aggregate ? "" : 'aria-controls="results-video"'}>
        </button>
        <span class="chart-value" style="bottom: calc(${labelPosition}% + 7px)" aria-hidden="true">${Number(rate.toFixed(1))}</span>
        ${interval ? `
          <span class="chart-interval" aria-hidden="true"
            style="bottom: ${interval[0]}%; height: ${interval[1] - interval[0]}%">
          </span>` : ""}
      </div>`;
  }

  function renderPanel(group) {
    const aggregate = group.id === "average";
    return `
      <div class="chart-panel${aggregate ? " chart-panel-average" : ""}"
        role="group" aria-labelledby="chart-title-${group.id}">
        <h3 id="chart-title-${group.id}">${group.label}</h3>
        <div class="chart-plot">
          <div class="chart-grid" aria-hidden="true">
            ${[0, 25, 50, 75, 100].map((tick) => `
              <span style="bottom: ${tick}%"><span>${tick}</span></span>`).join("")}
          </div>
          <div class="chart-bars">
            ${methods.map((method, index) => renderBar(group, method, index)).join("")}
          </div>
        </div>
        ${aggregate ? `
          <div class="chart-average-context">
            <span class="chart-average-label">AnchorQ vs. baselines</span>
            <div><span>π<sub>0.5</sub></span><span><i>p</i> = 0.00034</span></div>
            <div><span>DSRL</span><span><i>p</i> = 0.00670</span></div>
          </div>` : ""}
      </div>`;
  }

  chart.innerHTML = `
    <div class="chart-toolbar">
      <span class="chart-axis-title">Success rate (%)</span>
      <ul class="chart-legend" aria-label="Methods">${legend}</ul>
    </div>
    <div class="chart-panels">${groups.map(renderPanel).join("")}</div>
    <p class="chart-hint">Select a task bar to watch its rollouts.</p>
    <div id="chart-tooltip" class="chart-tooltip" role="tooltip" hidden></div>`;
  chart.hidden = false;

  const dataDetails = document.querySelector("#chart-data");
  dataDetails.querySelector(".chart-table-wrap").innerHTML = `
    <table>
      <caption class="sr-only">Success rates and aggregate confidence intervals</caption>
      <thead><tr><th scope="col">Task</th>${methods.map((method) =>
        `<th scope="col">${method.html}</th>`).join("")}</tr></thead>
      <tbody>${groups.map((group) => {
        const trials = trialsPerTask * (group.id === "average" ? tasks.length : 1);
        return `<tr><th scope="row">${group.label}</th>${group.successes.map((count) =>
          `<td>${percent(count / trials * 100)} <span>(${count}/${trials})</span></td>`).join("")}</tr>`;
      }).join("")}
      <tr><th scope="row">Average 95% CI</th>${average.successes.map((count) => {
        const interval = wilsonInterval(count, trialsPerTask * tasks.length);
        return `<td>${percent(interval[0])}–${percent(interval[1])}</td>`;
      }).join("")}</tr></tbody>
    </table>`;
  dataDetails.hidden = false;

  const tooltip = chart.querySelector("#chart-tooltip");
  let activeBar = null;

  function hideTooltip() {
    if (activeBar) activeBar.removeAttribute("aria-describedby");
    activeBar = null;
    tooltip.hidden = true;
  }

  function showTooltip(bar) {
    hideTooltip();
    activeBar = bar;
    const group = groups.find((item) => item.id === bar.dataset.chartTask);
    const methodIndex = methods.findIndex((item) => item.id === bar.dataset.chartMethod);
    const method = methods[methodIndex];
    const aggregate = group.id === "average";
    const successes = group.successes[methodIndex];
    const trials = trialsPerTask * (aggregate ? tasks.length : 1);
    const interval = aggregate ? wilsonInterval(successes, trials) : null;
    tooltip.innerHTML = `
      <strong>${group.label} · ${method.html}</strong>
      <span>${successes} / ${trials} successes · ${percent(successes / trials * 100)}</span>
      ${interval ? `<span>95% CI: ${percent(interval[0])}–${percent(interval[1])}</span>` :
        "<span class=\"chart-tooltip-action\">Watch rollouts ↗</span>"}`;
    tooltip.hidden = false;
    bar.setAttribute("aria-describedby", tooltip.id);

    const bounds = chart.getBoundingClientRect();
    const target = bar.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const left = target.left - bounds.left + target.width / 2 - width / 2;
    tooltip.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, left))}px`;
    tooltip.style.top = `${Math.max(8, target.top - bounds.top - tooltip.offsetHeight - 16)}px`;
  }

  chart.querySelectorAll(".chart-bar").forEach((bar) => {
    bar.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") showTooltip(bar);
    });
    bar.addEventListener("pointerleave", () => {
      if (document.activeElement !== bar) hideTooltip();
    });
    bar.addEventListener("focus", () => showTooltip(bar));
    bar.addEventListener("blur", hideTooltip);
    bar.addEventListener("click", () => {
      if (bar.dataset.chartTask === "average") {
        showTooltip(bar);
        return;
      }
      selectedTask = bar.dataset.chartTask;
      selectedMethod = bar.dataset.chartMethod;
      updateResults();
      hideTooltip();
      resultsVideo.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "center",
      });
      resultsVideo.focus({ preventScroll: true });
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".chart-bar")) hideTooltip();
  });
  window.addEventListener("resize", hideTooltip);
})();

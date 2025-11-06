/* global d3 */
(async function () {
  const file = "data/scenarios_global_annual.csv"; // columns: year, scenario, anom_c

  const rows = await d3.csv(file, d3.autoType);
  console.log("scenarios loaded rows:", rows.length, rows[0]);

  const raw = rows.map(d => ({
    year: +d.year,
    scenario: d.scenario,
    anom: +((d.anom_c ?? d.anomaly_c ?? d.anom))
  })).filter(d => Number.isFinite(d.year) && Number.isFinite(d.anom) && d.scenario);

  const svg = d3.select("#scenarios");
  const W = +svg.attr("width"), H = +svg.attr("height");
  const M = { top: 28, right: 130, bottom: 44, left: 58 };
  const innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  if (!raw.length) {
    g.append("text").attr("x", 0).attr("y", 16).text("No data loaded. Check CSV path/columns.");
    return;
  }

  const scenarios = Array.from(new Set(raw.map(d => d.scenario)));
  const color = d3.scaleOrdinal().domain(scenarios).range(["#4c78a8", "#f58518", "#e45756"]);

  const x = d3.scaleLinear().domain(d3.extent(raw, d => d.year)).nice().range([0, innerW]);
  const y = d3.scaleLinear().domain(d3.extent(raw, d => d.anom)).nice().range([innerH, 0]);

  g.append("g").attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
  g.append("g")
    .call(d3.axisLeft(y))
    .append("text").attr("x", -40).attr("y", -10).attr("fill", "#555").text("Anomaly (°C)");

  // Paris thresholds
  [1.5, 2.0].forEach(t => {
    g.append("line")
      .attr("x1", 0).attr("x2", innerW).attr("y1", y(t)).attr("y2", y(t))
      .attr("stroke", "#999").attr("stroke-dasharray", "6,4");
    g.append("text").attr("x", 6).attr("y", y(t) - 6).attr("fill", "#666").text(`${t} °C`);
  });

  const line = d3.line().x(d => x(d.year)).y(d => y(d.anom));

  scenarios.forEach(s => {
    const data = raw.filter(d => d.scenario === s).sort((a, b) => a.year - b.year);
    if (!data.length) return;
    g.append("path")
      .datum(data)
      .attr("fill", "none").attr("stroke", color(s)).attr("stroke-width", 2.5)
      .attr("d", line);

    const last = data[data.length - 1];
    g.append("text")
      .attr("x", x(last.year) + 6).attr("y", y(last.anom))
      .attr("alignment-baseline", "middle")
      .attr("fill", color(s))
      .style("font-weight", 600)
      .text(s);
  });
})();

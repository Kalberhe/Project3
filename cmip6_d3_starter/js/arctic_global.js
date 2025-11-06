/* global d3 */
(async function () {
  // ✅ relative path (no leading slash)
  const file = "data/arctic_global_annual.csv"; // columns: year, region, anom_c

  // Load + coerce types; accept anom_c or anomaly_c just in case
  const rows = await d3.csv(file, d3.autoType);
  console.log("arctic_global loaded rows:", rows.length, rows[0]);

  const raw = rows.map(d => ({
    year: +d.year,
    region: d.region,
    anom: +((d.anom_c ?? d.anomaly_c ?? d.anom))
  })).filter(d => Number.isFinite(d.year) && Number.isFinite(d.anom) && d.region);

  const svg = d3.select("#arcticGlobal");
  const W = +svg.attr("width"), H = +svg.attr("height");
  const M = { top: 28, right: 120, bottom: 44, left: 58 };
  const innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  if (!raw.length) {
    g.append("text").attr("x", 0).attr("y", 16).text("No data loaded. Check CSV path/columns.");
    return;
  }

  const regions = Array.from(new Set(raw.map(d => d.region)));
  const color = d3.scaleOrdinal().domain(regions).range(["#1b9e77", "#d95f02"]);

  const x = d3.scaleLinear().domain(d3.extent(raw, d => d.year)).nice().range([0, innerW]);
  const y = d3.scaleLinear().domain(d3.extent(raw, d => d.anom)).nice().range([innerH, 0]);

  g.append("g").attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
  g.append("g")
    .call(d3.axisLeft(y))
    .append("text").attr("x", -40).attr("y", -10).attr("fill", "#555").text("Anomaly (°C)");

  // zero reference
  g.append("line")
    .attr("x1", 0).attr("x2", innerW).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#aaa").attr("stroke-dasharray", "4,4");

  const line = d3.line().x(d => x(d.year)).y(d => y(d.anom));

  regions.forEach(r => {
    const data = raw.filter(d => d.region === r).sort((a, b) => a.year - b.year);
    if (!data.length) return;
    g.append("path")
      .datum(data)
      .attr("fill", "none").attr("stroke", color(r)).attr("stroke-width", 2.5)
      .attr("d", line);

    const last = data[data.length - 1];
    g.append("text")
      .attr("x", x(last.year) + 6).attr("y", y(last.anom))
      .attr("alignment-baseline", "middle")
      .attr("fill", color(r))
      .style("font-weight", 600)
      .text(r);
  });
})();

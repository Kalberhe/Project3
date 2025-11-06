/* global d3 */
(async function () {
  const FILE = "data/scenarios_global_annual.csv"; // columns: year,scenario,anom_c|anomaly_c|anom

  // -------- load & tidy
  const rows = await d3.csv(FILE, d3.autoType);
  const all = rows
    .map(d => ({
      year: +d.year,
      scenario: String(d.scenario ?? "").trim(),
      anom: +((d.anom_c ?? d.anomaly_c ?? d.anom))
    }))
    .filter(d => Number.isFinite(d.year) && Number.isFinite(d.anom) && d.scenario === "Historical")
    .sort((a, b) => a.year - b.year);

  if (!all.length) { alert("Historical series not found in scenarios_global_annual.csv"); return; }

  const yearsAll = all.map(d => d.year);
  const yearMin = d3.min(yearsAll), yearMax = d3.max(yearsAll);

  // -------- UI refs
  const startSel = d3.select("#startYear");
  const showRM   = d3.select("#showRM");
  const showThr  = d3.select("#showThr");
  const resetBtn = d3.select("#resetBtn");
  const tip = d3.select("#tip");

  // Dropdown behaves as short, scrollable list (≈3 items) while open; collapses after pick
  {
    const selNode = startSel.node();
    selNode.size = 1; // collapsed by default
    selNode.addEventListener("mousedown", () => { selNode.size = 3; });
    selNode.addEventListener("focus",     () => { selNode.size = 3; });
    selNode.addEventListener("change",    () => { selNode.size = 1; selNode.blur(); });
    selNode.addEventListener("blur",      () => { selNode.size = 1; });
  }

  // -------- populate dropdown with decade ranges "1850–1860", ...
  const decadeRanges = [];
  for (let y = Math.floor(yearMin / 10) * 10; y < yearMax; y += 10) {
    const end = Math.min(y + 10, yearMax);
    decadeRanges.push({ start: y, end });
  }

  startSel.selectAll("option")
    .data(["all", ...decadeRanges])
    .enter().append("option")
    .attr("value", d => (d === "all" ? "all" : d.start))
    .text(d => d === "all" ? `All years (${yearMin}–${yearMax})` : `${d.start}–${d.end}`);

  // -------- SVG scaffolding
  const svg = d3.select("#hist");
  const W = +svg.attr("width"), H = +svg.attr("height");
  const M = { top: 26, right: 26, bottom: 46, left: 64 };
  const innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;

  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const gGrid = g.append("g").attr("class", "grid");
  const gy = g.append("g");

  // defs for fills
  const defs = svg.append("defs");
  const gradCool = defs.append("linearGradient").attr("id", "gradCool").attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
  gradCool.append("stop").attr("offset", "0%").attr("stop-color", "#6b8fb6").attr("stop-opacity", 0.9);
  gradCool.append("stop").attr("offset", "100%").attr("stop-color", "#6b8fb6").attr("stop-opacity", 0.15);
  const gradWarm = defs.append("linearGradient").attr("id", "gradWarm").attr("x1", "0").attr("x2", "0").attr("y1", "1").attr("y2", "0");
  gradWarm.append("stop").attr("offset", "0%").attr("stop-color", "#f59f80").attr("stop-opacity", 0.15);
  gradWarm.append("stop").attr("offset", "100%").attr("stop-color", "#f59f80").attr("stop-opacity", 0.9);

  // scales
  const x0 = d3.scaleLinear().domain([yearMin, yearMax]).range([0, innerW]); // base for zoom
  let x = x0.copy();
  let y = d3.scaleLinear().range([innerH, 0]);

  // generators
  const curve = d3.curveCatmullRom.alpha(0.35);
  const line   = d3.line().curve(curve).x(d => x(d.year)).y(d => y(d.anom));
  const lineRM = d3.line().curve(curve).x(d => x(d.year)).y(d => y(d.rm));
  const areaPos = d3.area().curve(curve).x(d => x(d.year)).y0(() => y(0)).y1(d => y(Math.max(0, d.anom)));
  const areaNeg = d3.area().curve(curve).x(d => x(d.year)).y0(() => y(0)).y1(d => y(Math.min(0, d.anom)));

  // layers
  const pos = g.append("path").attr("fill", "url(#gradWarm)");
  const neg = g.append("path").attr("fill", "url(#gradCool)");
  const zero = g.append("line").attr("stroke", "#c9c9c9").attr("stroke-dasharray", "4,4");
  const path = g.append("path").attr("fill", "none").attr("stroke", "#3a6aa6").attr("stroke-width", 2);
  const pathRM = g.append("path").attr("fill", "none").attr("stroke", "#cf4a4a").attr("stroke-width", 2);
  const thrG = g.append("g").attr("opacity", 0.9);

  // hover rule + dot
  const hoverG = g.append("g").style("display", "none");
  const vRule = hoverG.append("line").attr("stroke", "#888").attr("y1", 0).attr("y2", innerH).attr("stroke-dasharray", "3,3");
  const dot = hoverG.append("circle").attr("r", 4).attr("fill", "#3a6aa6").attr("stroke", "#fff").attr("stroke-width", 1.5);

  // capture rect for hover + touch + wheel zoom
  const overlay = g.append("rect")
    .attr("x", 0).attr("y", 0).attr("width", innerW).attr("height", innerH)
    .attr("fill", "transparent").style("cursor", "crosshair");

  // y grid + bottom grid as axis with tickSize
  function drawAxes() {
    gGrid.selectAll("*").remove();
    gGrid.append("g").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickSize(-innerH).tickFormat(d3.format("d")))
      .call(g => g.select(".domain").remove())
      .selectAll("line").attr("stroke", "#eee");
    gy.call(d3.axisLeft(y).ticks(6).tickSize(-innerW))
      .call(g => g.select(".domain").remove())
      .selectAll(".tick line").attr("stroke", "#eee");
  }

  function rollingMean(arr, k = 11) {
    const h = Math.floor(k / 2);
    return arr.map((d, i) => {
      const a = Math.max(0, i - h), b = Math.min(arr.length - 1, i + h);
      return { year: d.year, rm: d3.mean(arr.slice(a, b + 1), s => s.anom) };
    });
  }

  function render(withT = false) {
    const [xmin, xmax] = x.domain();
    const view = all.filter(d => d.year >= xmin && d.year <= xmax);

    // --- compute y domain (include guides if requested)
    const vmin = d3.min(view, d => d.anom);
    const vmax = d3.max(view, d => d.anom);
    let ymin = vmin, ymax = vmax;
    if (showThr.property("checked")) {
      ymin = Math.min(ymin, 0);
      ymax = Math.max(ymax, 2.0);
    }
    const pad = Math.max(0.15, (ymax - ymin) * 0.12);
    y.domain([ymin - pad, ymax + pad]).nice();

    drawAxes();

    const t = withT ? g.transition().duration(400).ease(d3.easeCubicOut) : null;

    zero.attr("x1", 0).attr("x2", innerW).attr("y1", y(0)).attr("y2", y(0));
    (withT ? pos.transition(t) : pos).datum(view).attr("d", areaPos);
    (withT ? neg.transition(t) : neg).datum(view).attr("d", areaNeg);
    (withT ? path.transition(t) : path).datum(view).attr("d", line);

    const rm = rollingMean(view);
    if (showRM.property("checked")) {
      (withT ? pathRM.transition(t) : pathRM).datum(rm).attr("d", lineRM).style("opacity", 1);
    } else {
      pathRM.style("opacity", 0);
    }

    thrG.selectAll("*").remove();
    if (showThr.property("checked")) {
      [1.5, 2.0].forEach(v => {
        thrG.append("line")
            .attr("x1", 0).attr("x2", innerW)
            .attr("y1", y(v)).attr("y2", y(v))
            .attr("stroke", "#7a7a7a").attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "6,4");
        thrG.append("text")
            .attr("x", 8).attr("y", y(v) - 6)
            .style("font-size", "12px").style("fill", "#555")
            .text(`${v} °C`);
      });
    }
  }

  // --------- zoom + pan
  const zoom = d3.zoom()
    .scaleExtent([1, 30])
    .translateExtent([[0, 0], [innerW, innerH]])
    .on("zoom", (ev) => {
      x = ev.transform.rescaleX(x0);
      render();
    });

  svg.call(zoom).on("dblclick.zoom", null);

  // hover (pointer for mouse+touch)
  overlay.on("pointermove", (ev) => {
      const [mx] = d3.pointer(ev, g.node());
      const yr = Math.round(x.invert(mx));
      const [xmin, xmax] = x.domain();
      const inView = all.filter(d => d.year >= xmin && d.year <= xmax);
      if (!inView.length) return;
      const d = inView.reduce((a, b) => Math.abs(b.year - yr) < Math.abs(a.year - yr) ? b : a, inView[0]);
      hoverG.style("display", null);
      vRule.attr("x1", x(d.year)).attr("x2", x(d.year));
      dot.attr("cx", x(d.year)).attr("cy", y(d.anom));
      tip.style("display", null)
         .style("left", (ev.clientX + 12) + "px")
         .style("top",  (ev.clientY + 12) + "px")
         .html(`<div style="font-weight:600;margin-bottom:4px;">${d.year}</div>
                <div>Anomaly: <b>${d.anom.toFixed(2)} °C</b></div>`);
    })
    .on("pointerleave", () => { tip.style("display", "none"); hoverG.style("display", "none"); });

  // --------- UI hooks
  startSel.on("change", () => {
    const v = startSel.property("value");
    const a = (v === "all") ? yearMin : Math.max(yearMin, +v);
    x0.domain([a, yearMax]);            // update base domain
    const t = d3.zoomIdentity;          // reset zoom transform on base change
    svg.transition().duration(350).call(zoom.transform, t);
    x = x0.copy();
    render(true);
  });
  showRM.on("change", () => render());
  showThr.on("change", () => render());
  resetBtn.on("click", () => {
    x0.domain([yearMin, yearMax]);
    svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
    x = x0.copy();
    startSel.property("value", "all");
    render(true);
  });

  // --------- first draw
  startSel.property("value", "all");
  render();
})();

/* global d3 */
(async function () {
  const FILE = "data/scenarios_global_annual.csv"; // year, scenario, anom_c|anomaly_c
  const rows = await d3.csv(FILE, d3.autoType);
  if (!rows?.length) { alert("No data loaded"); return; }

  // --- tidy + filter Historical
  const all = rows.map(d => ({
      year: +d.year,
      scenario: String(d.scenario ?? "").trim(),
      anom: +((d.anom_c ?? d.anomaly_c ?? d.anom))
    }))
    .filter(d => Number.isFinite(d.year) && Number.isFinite(d.anom) && d.scenario === "Historical")
    .sort((a,b)=>a.year-b.year);

  const yearsAll = all.map(d => d.year);
  const yearMin = d3.min(yearsAll), yearMax = d3.max(yearsAll);

  // --- UI refs
  const startSel = d3.select("#startYear");
  const showRM   = d3.select("#showRM");
  const showThr  = d3.select("#showThr");
  const resetBtn = d3.select("#resetBtn");
  const tip = d3.select("#tip");

  // populate a clean **years list**: "All years", then every decade start + a few commons
  const decadeStarts = Array.from(new Set(yearsAll.map(y => Math.floor(y/10)*10))).sort(d3.ascending);
  const staples = [1950, 1970, 1990, 2000, 2010];
  const menuYears = Array.from(new Set(["all", ...decadeStarts, ...staples.filter(y=>y>=yearMin && y<=yearMax)])).sort((a,b)=>{
    if (a==="all") return -1; if (b==="all") return 1; return a-b;
  });

  startSel.selectAll("option").data(menuYears).enter().append("option")
    .attr("value", d => d).text(d => d==="all" ? `All years (${yearMin}–${yearMax})` : `Since ${d}`);

  // --- SVG
  const svg = d3.select("#hist");
  const W = +svg.attr("width"), H = +svg.attr("height");
  const M = { top: 26, right: 26, bottom: 46, left: 64 };
  const innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;

  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const gx = g.append("g").attr("transform", `translate(0,${innerH})`);
  const gy = g.append("g");
  const gGrid = g.append("g").attr("class","grid");

  // defs for fancy gradients (cool/warm) and hover marker
  const defs = svg.append("defs");

  const gradCool = defs.append("linearGradient").attr("id","gradCool").attr("x1","0").attr("x2","0").attr("y1","0").attr("y2","1");
  gradCool.append("stop").attr("offset","0%").attr("stop-color","#6b8fb6").attr("stop-opacity",0.9);
  gradCool.append("stop").attr("offset","100%").attr("stop-color","#6b8fb6").attr("stop-opacity",0.15);

  const gradWarm = defs.append("linearGradient").attr("id","gradWarm").attr("x1","0").attr("x2","0").attr("y1","1").attr("y2","0");
  gradWarm.append("stop").attr("offset","0%").attr("stop-color","#f59f80").attr("stop-opacity",0.15);
  gradWarm.append("stop").attr("offset","100%").attr("stop-color","#f59f80").attr("stop-opacity",0.9);

  // scales
  let x = d3.scaleLinear().domain([yearMin, yearMax]).range([0, innerW]);
  let y = d3.scaleLinear().range([innerH, 0]);

  // generators
  const line = d3.line().x(d => x(d.year)).y(d => y(d.anom)).curve(d3.curveCatmullRom.alpha(0.4));
  const lineRM = d3.line().x(d => x(d.year)).y(d => y(d.rm)).curve(d3.curveCatmullRom.alpha(0.4));
  const areaPos = d3.area().x(d => x(d.year)).y0(() => y(0)).y1(d => y(Math.max(0, d.anom))).curve(d3.curveCatmullRom.alpha(0.4));
  const areaNeg = d3.area().x(d => x(d.year)).y0(() => y(0)).y1(d => y(Math.min(0, d.anom))).curve(d3.curveCatmullRom.alpha(0.4));

  // layers
  const pos = g.append("path").attr("fill","url(#gradWarm)");
  const neg = g.append("path").attr("fill","url(#gradCool)");
  const zero = g.append("line").attr("stroke","#c9c9c9").attr("stroke-dasharray","4,4");
  const path = g.append("path").attr("fill","none").attr("stroke","#3a6aa6").attr("stroke-width",2);
  const pathRM = g.append("path").attr("fill","none").attr("stroke","#cf4a4a").attr("stroke-width",2);
  const thrG = g.append("g").attr("opacity",0.85);

  // hover rule + dot
  const hoverG = g.append("g").style("display","none");
  const vRule = hoverG.append("line").attr("stroke","#888").attr("y1",0).attr("y2",innerH).attr("stroke-dasharray","3,3");
  const dot = hoverG.append("circle").attr("r",4).attr("fill","#3a6aa6").attr("stroke","#fff").attr("stroke-width",1.5);

  // brush (x zoom)
  const brush = d3.brushX().extent([[0,0],[innerW, innerH]]).on("end", ({selection}) => {
    if (!selection) return;
    const [x0, x1] = selection.map(x.invert);
    setDomain(Math.round(x0), Math.round(x1));
    g.select(".brush").call(brush.move, null);
  });
  g.append("g").attr("class","brush").call(brush);

  resetBtn.on("click", () => setDomain(yearMin, yearMax));

  startSel.on("change", () => {
    const v = startSel.property("value");
    const a = (v === "all") ? yearMin : Math.max(yearMin, +v);
    setDomain(a, yearMax);
  });
  showRM.on("change", render);
  showThr.on("change", render);

  function rollingMean(arr, k=11) {
    const half = Math.floor(k/2);
    return arr.map((d,i) => {
      const a = Math.max(0, i-half), b = Math.min(arr.length-1, i+half);
      const slice = arr.slice(a,b+1);
      return { year: d.year, rm: d3.mean(slice, s=>s.anom) };
    });
  }

  function setDomain(a, b) {
    x.domain([a, b]);
    render(true);
  }

  function drawAxes(view) {
    // grid
    gGrid.selectAll("*").remove();
    gGrid.append("g").attr("transform",`translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickSize(-innerH).tickFormat(d3.format("d")))
      .call(g=>g.selectAll(".tick text").attr("dy","1.2em"))
      .call(g=>g.select(".domain").remove())
      .selectAll("line").attr("stroke","#eee");

    gy.call(d3.axisLeft(y).ticks(6).tickSize(-innerW))
      .call(g=>g.select(".domain").remove())
      .selectAll(".tick line").attr("stroke","#eee");
    gx.selectAll("*").remove(); // we’re using the gridded bottom axis above
  }

  function render(withTransition=false) {
    const [a,b] = x.domain();
    const view = all.filter(d => d.year >= a && d.year <= b);

    const extent = d3.extent(view, d=>d.anom);
    const pad = Math.max(0.15, (extent[1]-extent[0]) * 0.12);
    y.domain([extent[0]-pad, extent[1]+pad]).nice();

    drawAxes(view);

    zero.attr("x1",0).attr("x2",innerW).attr("y1",y(0)).attr("y2",y(0));

    const t = withTransition ? g.transition().duration(500).ease(d3.easeCubicOut) : null;

    (withTransition ? pos.transition(t) : pos).datum(view).attr("d", areaPos);
    (withTransition ? neg.transition(t) : neg).datum(view).attr("d", areaNeg);
    (withTransition ? path.transition(t) : path).datum(view).attr("d", line);

    const rm = rollingMean(view, 11);
    if (showRM.property("checked")) {
      (withTransition ? pathRM.transition(t) : pathRM).datum(rm).attr("d", lineRM).style("opacity",1);
    } else {
      pathRM.style("opacity",0);
    }

    thrG.selectAll("*").remove();
    if (showThr.property("checked")) {
      [1.5, 2.0].forEach(tval => {
        thrG.append("line")
          .attr("x1",0).attr("x2",innerW).attr("y1",y(tval)).attr("y2",y(tval))
          .attr("stroke","#bdbdbd").attr("stroke-dasharray","6,4");
        thrG.append("text")
          .attr("x",6).attr("y",y(tval)-6).style("font-size","12px").style("fill","#777")
          .text(`${tval} °C`);
      });
    }

    // hover
    svg.on("mousemove", (ev) => {
      const [mx] = d3.pointer(ev, g.node());
      const yr = Math.round(x.invert(mx));
      const d = view.reduce((a,b)=> Math.abs(b.year-yr) < Math.abs(a.year-yr) ? b : a, view[0]);
      if (!d) return tip.style("display","none");
      hoverG.style("display", null);
      vRule.attr("x1", x(d.year)).attr("x2", x(d.year));
      dot.attr("cx", x(d.year)).attr("cy", y(d.anom));
      tip.style("display", null)
         .style("left", (ev.clientX+12)+"px")
         .style("top", (ev.clientY+12)+"px")
         .html(`<div style="font-weight:600;margin-bottom:4px;">${d.year}</div>
                <div>Anomaly: <b>${d.anom.toFixed(2)} °C</b></div>`);
    }).on("mouseleave", () => { tip.style("display","none"); hoverG.style("display","none"); });
  }

  // init
  startSel.property("value","all");
  render();
})();

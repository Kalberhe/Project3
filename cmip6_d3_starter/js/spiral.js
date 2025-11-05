const W = 600, H = 600, R = 250;
const svg = d3.select("#spiral").append("svg")
  .attr("width", W).attr("height", H);
const g = svg.append("g").attr("transform", `translate(${W/2},${H/2})`);

const tooltip = d3.select("body").append("div").attr("class","tooltip").style("opacity",0);

d3.csv("data/spiral_monthly_anom.csv", d3.autoType).then(data => {
  const years = Array.from(new Set(data.map(d => d.year))).sort(d3.ascending);
  const months = d3.range(1,13);
  const angle = d3.scaleLinear().domain([1,12]).range([0, 2*Math.PI]);
  const extent = d3.extent(data, d => d.anom_c);
  const r = d3.scaleLinear().domain(extent).range([R*0.4, R]);
  const color = d3.scaleDiverging().domain([extent[0], 0, extent[1]]).interpolator(d3.interpolateRdBu);

  // grid
  g.selectAll(".grid")
    .data([R*0.4, (R*0.4+R)/2, R])
    .join("circle")
    .attr("class", "grid")
    .attr("r", d => d)
    .attr("fill", "none")
    .attr("stroke", "#ddd");

  // month tick lines
  g.selectAll(".mtick")
    .data(months)
    .join("line")
    .attr("class", "mtick")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", d => Math.cos(angle(d)-Math.PI/2) * (R+10))
    .attr("y2", d => Math.sin(angle(d)-Math.PI/2) * (R+10))
    .attr("stroke", "#ccc");

  // path generator for a year
  function pathForYear(y) {
    const pts = months.map(m => {
      const d = data.find(e => e.year === y && e.month === m);
      const val = d ? d.anom_c : 0;
      const rr = r(val);
      return [Math.cos(angle(m)-Math.PI/2)*rr, Math.sin(angle(m)-Math.PI/2)*rr, val, m];
    });
    const line = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRom.alpha(0.7));
    return {points: pts, d: line(pts)};
  }

  const yrRange = d3.select("#yearRange").attr("min", 0).attr("max", years.length-1).attr("value", 0);
  const yrLabel = d3.select("#yearLabel").text(years[0]);

  let currentIdx = 0, timer = null;

  const yearPath = g.append("path").attr("fill","none").attr("stroke","#333").attr("stroke-width",1.5);
  const dots = g.append("g");

  function render(idx) {
    const y = years[idx];
    yrLabel.text(y);
    const p = pathForYear(y);
    yearPath.attr("d", p.d);
    const sel = dots.selectAll("circle").data(p.points);
    sel.join("circle")
      .attr("r", 3)
      .attr("cx", d => d[0]).attr("cy", d => d[1])
      .attr("fill", d => color(d[2]))
      .on("mousemove", (ev, d) => {
        tooltip.style("opacity",1)
          .html(`Year ${y}, Month ${d[3]}<br/>Anom: ${d[2].toFixed(2)} °C`)
          .style("left", (ev.pageX+10)+"px")
          .style("top", (ev.pageY-28)+"px");
      })
      .on("mouseout", () => tooltip.style("opacity",0));
  }

  yrRange.on("input", (ev) => {
    currentIdx = +ev.target.value;
    render(currentIdx);
  });

  d3.select("#play").on("click", () => {
    if (timer) return;
    timer = d3.interval(() => {
      currentIdx = (currentIdx + 1) % years.length;
      yrRange.property("value", currentIdx);
      render(currentIdx);
    }, 800);
  });

  d3.select("#pause").on("click", () => { if (timer) { timer.stop(); timer = null; } });

  render(0);
});

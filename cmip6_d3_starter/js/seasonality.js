const margin = {top: 20, right: 20, bottom: 30, left: 44};
const width = 900, height = 420;

const svg = d3.select("#chart").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

d3.csv("data/decade_monthly.csv", d3.autoType).then(data => {
  const months = d3.range(1,13);
  const decades = Array.from(new Set(data.map(d => d.decade))).sort(d3.ascending);

  const x = d3.scaleLinear().domain([1,12]).range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.anom_c)).nice().range([height, 0]);
  const color = d3.scaleSequential().domain([decades[0], decades[decades.length-1]]).interpolator(d3.interpolateTurbo);

  svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(12).tickFormat(d => d));
  svg.append("g").call(d3.axisLeft(y));

  const line = d3.line().x(d => x(d.month)).y(d => y(d.anom_c)).curve(d3.curveMonotoneX);

  // Draw all decades
  const groups = d3.group(data, d => d.decade);
  const paths = svg.append("g").selectAll("path")
    .data(decades)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", d => color(d))
    .attr("stroke-width", 2)
    .attr("opacity", 0.9)
    .attr("d", d => line(months.map(m => ({month: m, anom_c: (groups.get(d).find(x => x.month===m) || {anom_c: 0}).anom_c }))));

  // Interactive legend (toggle decade visibility)
  const legend = d3.select("#legend");
  decades.forEach(d => {
    const item = legend.append("label").style("display","inline-flex").style("align-items","center").style("gap",".3rem");
    const cb = item.append("input").attr("type","checkbox").attr("checked", true).attr("data-decade", d);
    item.append("span").style("background", color(d)).style("width","12px").style("height","12px").style("display","inline-block");
    item.append("span").text(`${d}s`);
  });

  legend.selectAll("input[type=checkbox]").on("change", function() {
    const d = +this.getAttribute("data-decade");
    const visible = this.checked;
    paths.filter(p => p === d).attr("display", visible ? null : "none");
  });
});

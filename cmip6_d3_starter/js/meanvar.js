const margin = {top: 20, right: 20, bottom: 40, left: 50};
const width = 900, height = 420;

const svg = d3.select("#chart").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body").append("div").attr("class","tooltip").style("opacity",0);

d3.csv("data/meanvar_by_decade.csv", d3.autoType).then(data => {
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.mean_c)).nice().range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.std_c)).nice().range([height, 0]);
  const color = d3.scaleSequential().domain(d3.extent(data, d => d.decade)).interpolator(d3.interpolateTurbo);

  svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
  svg.append("g").call(d3.axisLeft(y));

  const nodes = svg.selectAll("circle").data(data).join("circle")
    .attr("cx", d => x(d.mean_c))
    .attr("cy", d => y(d.std_c))
    .attr("r", 6)
    .attr("fill", d => color(d.decade))
    .on("mousemove", (ev, d) => {
      tooltip.style("opacity",1)
        .html(`${d.decade}s<br/>mean: ${d.mean_c.toFixed(2)} °C<br/>std: ${d.std_c.toFixed(2)} °C`)
        .style("left", (ev.pageX+10)+"px")
        .style("top", (ev.pageY-28)+"px");
    }).on("mouseout", () => tooltip.style("opacity",0));

  // dropdown
  const sel = d3.select("#sel");
  const decades = data.map(d => d.decade);
  decades.forEach(d => sel.append("option").attr("value", d).text(`${d}s`));

  sel.on("change", function() {
    const dec = +this.value;
    nodes.attr("stroke", d => d.decade===dec ? "#000" : null)
         .attr("stroke-width", d => d.decade===dec ? 2 : null);
  });
});

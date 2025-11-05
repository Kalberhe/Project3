const margin = {top: 20, right: 20, bottom: 30, left: 50};
const width = 900, height = 420;

const svg = d3.select("#chart").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

d3.csv("data/milestone.csv", d3.autoType).then(data => {
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.rolling11_anom_c)).nice().range([height, 0]);

  svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
  svg.append("g").call(d3.axisLeft(y));

  const line = d3.line().x(d => x(d.year)).y(d => y(d.rolling11_anom_c)).curve(d3.curveMonotoneX);
  const path = svg.append("path").datum(data).attr("fill","none").attr("stroke","#333").attr("stroke-width",2).attr("d", line);

  const thrLine = svg.append("line").attr("stroke","tomato").attr("stroke-dasharray","4 4").attr("x1",0).attr("x2",width);
  const marker = svg.append("line").attr("stroke","steelblue").attr("stroke-width",2).attr("y1",0).attr("y2",height).style("display","none");
  const label = d3.select("#first");

  const thrInput = d3.select("#thr");
  const thrLabel = d3.select("#thrLabel");

  function updateThreshold() {
    const thr = +thrInput.property("value");
    thrLabel.text(thr.toFixed(1) + " °C");
    thrLine.attr("y1", y(thr)).attr("y2", y(thr));
    // first crossing year
    const idx = data.findIndex(d => d.rolling11_anom_c >= thr);
    if (idx >= 0) {
      marker.style("display", null).attr("x1", x(data[idx].year)).attr("x2", x(data[idx].year));
      label.text("First crossing: " + data[idx].year);
    } else {
      marker.style("display","none");
      label.text("No crossing");
    }
  }

  thrInput.on("input", updateThreshold);
  updateThreshold();
});

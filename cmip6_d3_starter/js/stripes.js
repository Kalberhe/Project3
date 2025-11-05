const margin = {top: 20, right: 20, bottom: 30, left: 40};
const width = 900, height = 140;

const histH = 180, histW = 900;
const histMargin = {top: 10, right: 20, bottom: 30, left: 40};

const svg = d3.select("#chart").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const hist = d3.select("#hist").append("svg")
  .attr("width", histW + histMargin.left + histMargin.right)
  .attr("height", histH + histMargin.top + histMargin.bottom)
  .append("g")
  .attr("transform", `translate(${histMargin.left},${histMargin.top})`);

const tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);

d3.csv("data/stripes.csv", d3.autoType).then(data => {
  data.sort((a,b) => d3.ascending(a.year, b.year));

  const years = data.map(d => d.year);
  const anoms = data.map(d => d.anom_c);

  const x = d3.scaleBand().domain(years).range([0, width]).padding(0);
  const y = d3.scaleLinear().domain([0,1]).range([height,0]); // dummy

  const extent = d3.extent(anoms);
  const c = d3.scaleDiverging().domain([extent[0], 0, extent[1]]).interpolator(d3.interpolateRdBu).unknown("#ccc");

  svg.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", d => x(d.year))
    .attr("y", 0)
    .attr("width", x.bandwidth())
    .attr("height", height)
    .attr("fill", d => c(d.anom_c))
    .on("mousemove", (event, d) => {
      tooltip.style("opacity", 1)
        .html(`<b>${d.year}</b><br/>Anomaly: ${d.anom_c.toFixed(2)} °C`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  svg.append("g").call(d3.axisBottom(d3.scaleLinear().domain(d3.extent(years)).range([0, width])).ticks(10))
    .attr("transform", `translate(0,${height})`);

  // Brush for selecting year range
  const brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on("brush end", brushed);

  svg.append("g").attr("class", "brush").call(brush);

  // Initialize histogram
  function updateHist(selected) {
    hist.selectAll("*").remove();
    const bins = d3.bin().domain(d3.extent(selected)).thresholds(12)(selected);
    const yH = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([histH, 0]);
    const xH = d3.scaleLinear().domain(d3.extent(selected)).nice().range([0, histW]);

    hist.append("g").call(d3.axisLeft(yH));
    hist.append("g").attr("transform", `translate(0,${histH})`).call(d3.axisBottom(xH));

    hist.selectAll("rect").data(bins).join("rect")
      .attr("x", d => xH(d.x0) + 1)
      .attr("y", d => yH(d.length))
      .attr("width", d => Math.max(0, xH(d.x1) - xH(d.x0) - 2))
      .attr("height", d => yH(0) - yH(d.length))
      .attr("fill", "#69b3a2");
  }

  function brushed(event) {
    const sel = event.selection;
    if (!sel) return;
    const [x0, x1] = sel;
    const selectedYears = years.filter(y => {
      const center = x(y) + x.bandwidth()/2;
      return center >= x0 && center <= x1;
    });
    const selectedAnoms = data.filter(d => selectedYears.includes(d.year)).map(d => d.anom_c);
    updateHist(selectedAnoms);
  }

  // initial hist with all data
  updateHist(data.map(d => d.anom_c));
});

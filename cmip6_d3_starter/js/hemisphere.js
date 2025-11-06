const margin = {top: 40, right: 40, bottom: 60, left: 60};
const width = 900;
const height = 500;

const brushHeight = 80;
const brushMargin = {top: 10, right: 40, bottom: 30, left: 60};

// Main chart SVG
const svg = d3.select("#chart").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Brush chart SVG (for time selection)
const brushSvg = d3.select("#brush").append("svg")
  .attr("width", width + brushMargin.left + brushMargin.right)
  .attr("height", brushHeight + brushMargin.top + brushMargin.bottom)
  .append("g")
  .attr("transform", `translate(${brushMargin.left},${brushMargin.top})`);

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

let allData = [];
let filteredData = [];
let xScale, yScale, xBrushScale, yBrushScale;
let xAxis, yAxis, xBrushAxis;
let lineNorthern, lineSouthern;
let currentExtent = null;

// Load data
d3.csv("data/hemisphere_anomalies.csv", d3.autoType).then(data => {
  allData = data;
  filteredData = data;
  
  // Separate data by hemisphere
  const northernData = data.filter(d => d.hemisphere === "Northern").sort((a, b) => a.year - b.year);
  const southernData = data.filter(d => d.hemisphere === "Southern").sort((a, b) => a.year - b.year);
  
  // Set up scales
  const years = data.map(d => d.year);
  const anomalies = data.map(d => d.anom_c);
  const yearExtent = d3.extent(years);
  const anomExtent = d3.extent(anomalies);
  
  // Add padding to anomaly extent
  const anomPadding = (anomExtent[1] - anomExtent[0]) * 0.1;
  anomExtent[0] -= anomPadding;
  anomExtent[1] += anomPadding;
  
  // Main chart scales
  xScale = d3.scaleLinear()
    .domain(yearExtent)
    .range([0, width]);
  
  yScale = d3.scaleLinear()
    .domain(anomExtent)
    .range([height, 0]);
  
  // Brush chart scales
  xBrushScale = d3.scaleLinear()
    .domain(yearExtent)
    .range([0, width]);
  
  yBrushScale = d3.scaleLinear()
    .domain(anomExtent)
    .range([brushHeight, 0]);
  
  // Create axes
  xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d3.format("d"));
  yAxis = d3.axisLeft(yScale).ticks(8);
  xBrushAxis = d3.axisBottom(xBrushScale).ticks(10).tickFormat(d3.format("d"));
  
  // Create line generators
  lineNorthern = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.anom_c))
    .curve(d3.curveMonotoneX);
  
  lineSouthern = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.anom_c))
    .curve(d3.curveMonotoneX);
  
  // Draw initial chart
  drawChart(northernData, southernData);
  drawBrushChart(northernData, southernData);
  
  // Set up controls
  setupControls(northernData, southernData, yearExtent);
});

function drawChart(northernData, southernData) {
  // Clear previous content
  svg.selectAll("*").remove();
  
  // Draw grid lines
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(10).tickSize(-height).tickFormat(""))
    .style("stroke-dasharray", "3,3")
    .style("opacity", 0.2);
  
  svg.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(8).tickSize(-width).tickFormat(""))
    .style("stroke-dasharray", "3,3")
    .style("opacity", 0.2);
  
  // Draw zero line
  svg.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", yScale(0))
    .attr("y2", yScale(0))
    .attr("stroke", "#000")
    .attr("stroke-dasharray", "2,2")
    .attr("opacity", 0.3);
  
  // Draw Northern Hemisphere line
  const pathNorthern = svg.append("path")
    .datum(northernData)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2.5)
    .attr("d", lineNorthern)
    .attr("class", "line-northern")
    .style("opacity", 1);
  
  // Draw Southern Hemisphere line
  const pathSouthern = svg.append("path")
    .datum(southernData)
    .attr("fill", "none")
    .attr("stroke", "#ff7f0e")
    .attr("stroke-width", 2.5)
    .attr("d", lineSouthern)
    .attr("class", "line-southern")
    .style("opacity", 1);
  
  // Draw circles for data points (for interactivity)
  const allPoints = [
    ...northernData.map(d => ({...d, hemisphere: "Northern"})), 
    ...southernData.map(d => ({...d, hemisphere: "Southern"}))
  ];
  
  const circles = svg.selectAll("circle")
    .data(allPoints)
    .join("circle")
    .attr("cx", d => xScale(d.year))
    .attr("cy", d => yScale(d.anom_c))
    .attr("r", 3)
    .attr("fill", d => d.hemisphere === "Northern" ? "#1f77b4" : "#ff7f0e")
    .attr("opacity", 0.6)
    .attr("class", d => `circle-${d.hemisphere.toLowerCase()}`)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 5).attr("opacity", 1);
      tooltip.style("opacity", 1)
        .html(`<b>${d.hemisphere} Hemisphere</b><br/>Year: ${d.year}<br/>Anomaly: ${d.anom_c.toFixed(4)} °C`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 3).attr("opacity", 0.6);
      tooltip.style("opacity", 0);
    });
  
  // Add axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);
  
  svg.append("g")
    .call(yAxis);
  
  // Add labels
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("Temperature Anomaly (°C)");
  
  svg.append("text")
    .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
    .style("text-anchor", "middle")
    .text("Year");
}

function drawBrushChart(northernData, southernData) {
  // Clear previous content
  brushSvg.selectAll("*").remove();
  
  // Draw brush chart lines
  const brushLineNorthern = d3.line()
    .x(d => xBrushScale(d.year))
    .y(d => yBrushScale(d.anom_c))
    .curve(d3.curveMonotoneX);
  
  const brushLineSouthern = d3.line()
    .x(d => xBrushScale(d.year))
    .y(d => yBrushScale(d.anom_c))
    .curve(d3.curveMonotoneX);
  
  brushSvg.append("path")
    .datum(northernData)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 1.5)
    .attr("d", brushLineNorthern)
    .attr("opacity", 0.7);
  
  brushSvg.append("path")
    .datum(southernData)
    .attr("fill", "none")
    .attr("stroke", "#ff7f0e")
    .attr("stroke-width", 1.5)
    .attr("d", brushLineSouthern)
    .attr("opacity", 0.7);
  
  // Add brush
  const brush = d3.brushX()
    .extent([[0, 0], [width, brushHeight]])
    .on("brush", brushed)
    .on("end", brushed);
  
  brushSvg.append("g")
    .attr("class", "brush")
    .call(brush);
  
  // Add axis
  brushSvg.append("g")
    .attr("transform", `translate(0,${brushHeight})`)
    .call(xBrushAxis);
}

function brushed(event) {
  if (!event.selection) return;
  
  const [x0, x1] = event.selection;
  const startYear = Math.round(xBrushScale.invert(x0));
  const endYear = Math.round(xBrushScale.invert(x1));
  
  // Update main chart
  xScale.domain([startYear, endYear]);
  
  // Get filtered data for the selected range
  const filteredNorthern = allData.filter(d => 
    d.hemisphere === "Northern" && d.year >= startYear && d.year <= endYear
  ).sort((a, b) => a.year - b.year);
  
  const filteredSouthern = allData.filter(d => 
    d.hemisphere === "Southern" && d.year >= startYear && d.year <= endYear
  ).sort((a, b) => a.year - b.year);
  
  // Update anomaly extent for filtered data
  const filteredAnoms = [...filteredNorthern, ...filteredSouthern].map(d => d.anom_c);
  const anomExtent = d3.extent(filteredAnoms);
  const anomPadding = (anomExtent[1] - anomExtent[0]) * 0.1;
  anomExtent[0] -= anomPadding;
  anomExtent[1] += anomPadding;
  yScale.domain(anomExtent);
  
  // Redraw chart
  drawChart(filteredNorthern, filteredSouthern);
  
  // Update year range controls
  document.getElementById("yearStart").value = startYear;
  document.getElementById("yearEnd").value = endYear;
  document.getElementById("startYearDisplay").textContent = startYear;
  document.getElementById("endYearDisplay").textContent = endYear;
  
  currentExtent = [startYear, endYear];
}

function setupControls(northernData, southernData, yearExtent) {
  // Toggle checkboxes
  document.getElementById("toggleNorthern").addEventListener("change", function() {
    const show = this.checked;
    svg.selectAll(".line-northern").style("opacity", show ? 1 : 0);
    svg.selectAll(".circle-northern").style("opacity", show ? 0.6 : 0);
  });
  
  document.getElementById("toggleSouthern").addEventListener("change", function() {
    const show = this.checked;
    svg.selectAll(".line-southern").style("opacity", show ? 1 : 0);
    svg.selectAll(".circle-southern").style("opacity", show ? 0.6 : 0);
  });
  
  // Year range sliders
  const yearStartSlider = document.getElementById("yearStart");
  const yearEndSlider = document.getElementById("yearEnd");
  const startYearDisplay = document.getElementById("startYearDisplay");
  const endYearDisplay = document.getElementById("endYearDisplay");
  
  yearStartSlider.addEventListener("input", function() {
    const start = parseInt(this.value);
    if (start >= parseInt(yearEndSlider.value)) {
      this.value = parseInt(yearEndSlider.value) - 1;
      return;
    }
    startYearDisplay.textContent = this.value;
    updateZoom();
  });
  
  yearEndSlider.addEventListener("input", function() {
    const end = parseInt(this.value);
    if (end <= parseInt(yearStartSlider.value)) {
      this.value = parseInt(yearStartSlider.value) + 1;
      return;
    }
    endYearDisplay.textContent = this.value;
    updateZoom();
  });
  
  function updateZoom() {
    const start = parseInt(yearStartSlider.value);
    const end = parseInt(yearEndSlider.value);
    
    // Update main chart
    xScale.domain([start, end]);
    
    // Get filtered data
    const filteredNorthern = allData.filter(d => 
      d.hemisphere === "Northern" && d.year >= start && d.year <= end
    ).sort((a, b) => a.year - b.year);
    
    const filteredSouthern = allData.filter(d => 
      d.hemisphere === "Southern" && d.year >= start && d.year <= end
    ).sort((a, b) => a.year - b.year);
    
    // Update anomaly extent
    const filteredAnoms = [...filteredNorthern, ...filteredSouthern].map(d => d.anom_c);
    const anomExtent = d3.extent(filteredAnoms);
    const anomPadding = (anomExtent[1] - anomExtent[0]) * 0.1;
    anomExtent[0] -= anomPadding;
    anomExtent[1] += anomPadding;
    yScale.domain(anomExtent);
    
    // Redraw chart
    drawChart(filteredNorthern, filteredSouthern);
    
    // Update brush
    const brush = d3.brushX()
      .extent([[0, 0], [width, brushHeight]])
      .on("brush", brushed)
      .on("end", brushed);
    
    brushSvg.select(".brush").call(brush.move, [
      xBrushScale(start),
      xBrushScale(end)
    ]);
    
    currentExtent = [start, end];
  }
  
  // Reset zoom button
  document.getElementById("resetZoom").addEventListener("click", function() {
    yearStartSlider.value = yearExtent[0];
    yearEndSlider.value = yearExtent[1];
    startYearDisplay.textContent = yearExtent[0];
    endYearDisplay.textContent = yearExtent[1];
    
    xScale.domain(yearExtent);
    const anoms = allData.map(d => d.anom_c);
    const anomExtent = d3.extent(anoms);
    const anomPadding = (anomExtent[1] - anomExtent[0]) * 0.1;
    anomExtent[0] -= anomPadding;
    anomExtent[1] += anomPadding;
    yScale.domain(anomExtent);
    
    drawChart(northernData, southernData);
    
    const brush = d3.brushX()
      .extent([[0, 0], [width, brushHeight]])
      .on("brush", brushed)
      .on("end", brushed);
    
    brushSvg.select(".brush").call(brush.clear);
    currentExtent = null;
  });
}

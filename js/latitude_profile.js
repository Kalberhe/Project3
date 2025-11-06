const margin = {top: 40, right: 40, bottom: 60, left: 80};
const width = 900;
const height = 500;

const svg = d3.select("#chart").append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

let allData = [];
let data = [];
let xScale, yScale;
let zoom;
let availableDecades = [];

// Load data
d3.csv("data/latitude_profile.csv", d3.autoType)
  .then(csvData => {
    if (!csvData || csvData.length === 0) {
      console.error("No data loaded");
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "red")
        .text("Error: No data found. Please run Cell 23 in the notebook first.");
      return;
    }
    
    allData = csvData;
    
    // Get available decades
    if (allData[0].decade) {
      // New format with decade column
      availableDecades = [...new Set(allData.map(d => d.decade))].sort();
      
      // Set default to most recent decade
      const defaultDecade = availableDecades[availableDecades.length - 1];
      data = allData.filter(d => d.decade === defaultDecade).sort((a, b) => b.lat - a.lat);
      
      // Populate decade dropdown
      const select = d3.select("#decadeSelect");
      select.selectAll("option").remove();
      
      // Add "All Time" option first
      select.append("option")
        .attr("value", "all-time")
        .text("All Time");
      
      // Add decade options
      availableDecades.forEach(decade => {
        select.append("option")
          .attr("value", decade)
          .text(decade)
          .property("selected", decade === defaultDecade);
      });
    } else {
      // Old format (single period) - for backward compatibility
      availableDecades = ["All Data"];
      data = allData.sort((a, b) => b.lat - a.lat);
      const select = d3.select("#decadeSelect");
      select.selectAll("option").remove();
      select.append("option")
        .attr("value", "all-time")
        .text("All Time")
        .property("selected", true);
    }
    
    console.log("Data loaded:", allData.length, "total points");
    console.log("Available decades:", availableDecades);
    console.log("Current data:", data.length, "points");
    console.log("Sample data:", data.slice(0, 5));
    
    // Initialize scales
    updateScales();
    
    // Draw initial chart
    drawChart();
    
    // Set up zoom
    setupZoom();
    
    // Set up controls
    setupControls();
  })
  .catch(error => {
    console.error("Error loading data:", error);
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "red")
      .text("Error loading data. Please check if latitude_profile.csv exists.");
  });

function updateScales() {
  if (data.length === 0) return;
  
  const lats = data.map(d => d.lat);
  const temps = data.map(d => d.temp_c);
  const latExtent = d3.extent(lats);
  const tempExtent = d3.extent(temps);
  
  // Add padding to temperature extent
  const tempPadding = (tempExtent[1] - tempExtent[0]) * 0.1;
  tempExtent[0] -= tempPadding;
  tempExtent[1] += tempPadding;
  
  xScale = d3.scaleLinear()
    .domain(latExtent)
    .range([0, width]);
  
  yScale = d3.scaleLinear()
    .domain(tempExtent)
    .range([height, 0]);
}

function drawChart() {
  // Clear previous content (except zoom rect)
  svg.selectAll("g, path, circle, line, text").filter(function() {
    return !d3.select(this).classed("zoom-rect");
  }).remove();
  
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
  
  // Create line generator
  const line = d3.line()
    .x(d => xScale(d.lat))
    .y(d => yScale(d.temp_c))
    .curve(d3.curveMonotoneX);
  
  // Draw area if enabled
  const showRange = document.getElementById("showRange").checked;
  if (showRange) {
    const area = d3.area()
      .x(d => xScale(d.lat))
      .y0(yScale(d3.min(data, d => d.temp_c)))
      .y1(d => yScale(d.temp_c))
      .curve(d3.curveMonotoneX);
    
    svg.append("path")
      .datum(data)
      .attr("fill", "steelblue")
      .attr("opacity", 0.2)
      .attr("d", area);
  }
  
  // Draw line
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#2c3e50")
    .attr("stroke-width", 3)
    .attr("d", line)
    .attr("class", "temperature-line");
  
  // Draw circles for data points
  svg.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => xScale(d.lat))
    .attr("cy", d => yScale(d.temp_c))
    .attr("r", 4)
    .attr("fill", d => {
      // Color based on temperature
      const tempRange = d3.extent(data, d => d.temp_c);
      const t = (d.temp_c - tempRange[0]) / (tempRange[1] - tempRange[0]);
      return d3.interpolateViridis(t);
    })
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .attr("opacity", 0.8)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 6).attr("opacity", 1);
      tooltip.style("opacity", 1)
        .html(`<b>Latitude: ${d.lat.toFixed(1)}°</b><br/>Temperature: ${d.temp_c.toFixed(2)} °C`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 4).attr("opacity", 0.8);
      tooltip.style("opacity", 0);
    });
  
  // Add axes with classes for easy updates
  const xAxis = d3.axisBottom(xScale)
    .ticks(10)
    .tickFormat(d => d + "°");
  
  const yAxis = d3.axisLeft(yScale)
    .ticks(8)
    .tickFormat(d => d + "°C");
  
  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);
  
  svg.append("g")
    .attr("class", "y-axis")
    .call(yAxis);
  
  // Add labels with classes for easy updates
  svg.append("text")
    .attr("class", "y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Temperature [°C]");
  
  svg.append("text")
    .attr("class", "x-axis-label")
    .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
    .style("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Latitude [degrees_north]");
  
  // Add equator line
  svg.append("line")
    .attr("x1", xScale(0))
    .attr("x2", xScale(0))
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#e74c3c")
    .attr("stroke-dasharray", "3,3")
    .attr("opacity", 0.5)
    .attr("stroke-width", 2);
  
  svg.append("text")
    .attr("x", xScale(0) + 5)
    .attr("y", 15)
    .style("font-size", "11px")
    .style("fill", "#e74c3c")
    .text("Equator (0°)");
  
  // Add period label
  const decadeSelect = document.getElementById("decadeSelect");
  if (decadeSelect && decadeSelect.value) {
    const currentPeriod = decadeSelect.value === "all-time" ? "All Time" : decadeSelect.value;
    svg.append("text")
      .attr("class", "period-label")
      .attr("x", width - 10)
      .attr("y", 20)
      .style("text-anchor", "end")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text(`Period: ${currentPeriod}`);
  }
  
  // Re-add zoom rect at the end (so it's on top)
  if (zoom) {
    svg.selectAll("rect.zoom-rect").remove();
    svg.append("rect")
      .attr("class", "zoom-rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .call(zoom);
  }
}

function setupZoom() {
  if (!xScale || !yScale) {
    console.warn("Scales not initialized yet");
    return;
  }
  
  // Remove existing zoom rect if any
  svg.selectAll("rect.zoom-rect").remove();
  
  zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .extent([[0, 0], [width, height]])
    .on("zoom", zoomed);
  
  const zoomRect = svg.append("rect")
    .attr("class", "zoom-rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .call(zoom);
  
  function zoomed(event) {
    const {transform} = event;
    const newXScale = transform.rescaleX(xScale);
    const newYScale = transform.rescaleY(yScale);
    
    // Update line
    const newLine = d3.line()
      .x(d => newXScale(d.lat))
      .y(d => newYScale(d.temp_c))
      .curve(d3.curveMonotoneX);
    
    svg.select(".temperature-line")
      .attr("d", newLine);
    
    // Update circles
    svg.selectAll("circle")
      .attr("cx", d => newXScale(d.lat))
      .attr("cy", d => newYScale(d.temp_c));
    
    // Update grid lines
    svg.select("g.grid[transform]")
      .call(d3.axisBottom(newXScale).ticks(10).tickSize(-height).tickFormat(""));
    svg.select("g.grid:not([transform])")
      .call(d3.axisLeft(newYScale).ticks(8).tickSize(-width).tickFormat(""));
    
    // Update axes (remove old, add new to avoid overlap)
    svg.select(".x-axis").remove();
    svg.select(".y-axis").remove();
    
    const xAxis = d3.axisBottom(newXScale)
      .ticks(10)
      .tickFormat(d => d + "°");
    
    const yAxis = d3.axisLeft(newYScale)
      .ticks(8)
      .tickFormat(d => d + "°C");
    
    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);
    
    svg.append("g")
      .attr("class", "y-axis")
      .call(yAxis);
    
    // Update equator line if it exists
    const equatorLine = svg.select("line[stroke='#e74c3c']");
    if (!equatorLine.empty()) {
      equatorLine
        .attr("x1", newXScale(0))
        .attr("x2", newXScale(0));
    }
    
    // Update period label position if exists
    const periodLabel = svg.select(".period-label");
    if (!periodLabel.empty()) {
      // Keep label at same position (top right)
      periodLabel.attr("x", width - 10);
    }
  }
  
  // Axes are already added in drawChart, so we don't need to add them here
}

function setupControls() {
  // Decade selector
  const decadeSelect = document.getElementById("decadeSelect");
  if (decadeSelect) {
    decadeSelect.addEventListener("change", function() {
      const selectedDecade = this.value;
      if (selectedDecade && allData.length > 0) {
        if (selectedDecade === "all-time") {
          // Show all time periods (average across all decades)
          // Group by latitude and average across all decades
          const latGroups = {};
          allData.forEach(d => {
            if (!latGroups[d.lat]) {
              latGroups[d.lat] = [];
            }
            latGroups[d.lat].push(d.temp_c);
          });
          data = Object.keys(latGroups).map(lat => ({
            lat: parseFloat(lat),
            temp_c: latGroups[lat].reduce((a, b) => a + b, 0) / latGroups[lat].length
          })).sort((a, b) => b.lat - a.lat);
        } else if (allData[0].decade) {
          // Filter by decade
          data = allData.filter(d => d.decade === selectedDecade).sort((a, b) => b.lat - a.lat);
        } else {
          // Old format - use all data
          data = allData.sort((a, b) => b.lat - a.lat);
        }
        
        console.log(`Selected period: ${selectedDecade}, data points: ${data.length}`);
        
        // Update scales
        updateScales();
        
        // Redraw chart
        drawChart();
        
        // Reset zoom
        if (zoom) {
          svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
        }
      }
    });
  }
  
  // Toggle area fill
  const showRangeCheckbox = document.getElementById("showRange");
  if (showRangeCheckbox) {
    showRangeCheckbox.addEventListener("change", function() {
      if (data.length > 0) {
        drawChart();
        setupZoom();
      }
    });
  }
  
  // Reset zoom button
  const resetZoomBtn = document.getElementById("resetZoom");
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener("click", function() {
      if (zoom) {
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity);
      }
    });
  }
  
  // Double-click to reset
  svg.on("dblclick", function() {
    if (zoom) {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    }
  });
}

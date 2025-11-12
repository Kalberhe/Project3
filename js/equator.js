import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"

// Configuration
const url = "data/equator_belt_longitude_decadal.csv"
const margin = { top: 20, right: 70, bottom: 60, left: 80 }
const width = 980, height = 520
const innerW = width - margin.left - margin.right
const innerH = height - margin.top - margin.bottom

// Setup SVG
const svg = d3.select("#equator-heatmap").append("svg").attr("viewBox", [0, 0, width, height])
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`).classed("hover-target", true)

// Load and prepare data
const data = await d3.csv(url, d => ({ decade: +d.decade, lon: +d.lon, val: +d.tas_anom_c_mean }))

if (!data.some(d => d.lon === 180)) {
  const neg180 = data.filter(d => d.lon === -180)
  data.push(...neg180.map(d => ({ ...d, lon: 180 })))
}

const decades = Array.from(new Set(data.map(d => d.decade))).sort(d3.ascending)
const lons = Array.from(new Set(data.map(d => d.lon))).sort(d3.ascending)

// Filtered data state
let filteredData = [...data]
let filteredLons = [...lons]
let filteredDecades = [...decades]

// Scales
const x = d3.scaleBand().domain(lons).range([0, innerW])
const y = d3.scaleBand().domain(decades).range([innerH, 0])

// Color scale
const extent = d3.extent(data, d => d.val)
const dataMin = extent[0] ?? 0
const dataMax = extent[1] ?? 0
const lim = Math.max(Math.abs(dataMin), Math.abs(dataMax)) || 1e-6

let colorMin = -lim
let colorMax = lim
let color = d3.scaleDiverging(d3.interpolateRdBu).domain([colorMax, 0, colorMin])

function updateColorScale() {
  color = d3.scaleDiverging(d3.interpolateRdBu).domain([colorMax, 0, colorMin])
  updateColorLegend()
  redrawHeatmap()
  if (typeof updateVisualization === 'function') updateVisualization()
}

// Color scale controls
const colorMinSlider = d3.select("#colorMinSlider")
const colorMaxSlider = d3.select("#colorMaxSlider")

colorMinSlider.attr("min", Math.min(-5, Math.floor(dataMin))).attr("max", 0).attr("value", -lim)
colorMaxSlider.attr("min", 0).attr("max", Math.max(5, Math.ceil(dataMax))).attr("value", lim)

d3.select("#colorMinDisplay").text(colorMin.toFixed(1))
d3.select("#colorMaxDisplay").text(colorMax.toFixed(1))

colorMinSlider.on("input", function() {
  colorMin = +this.value
  if (colorMin >= colorMax) colorMin = colorMax - 0.1
  d3.select("#colorMinDisplay").text(colorMin.toFixed(1))
  updateColorScale()
})

colorMaxSlider.on("input", function() {
  colorMax = +this.value
  if (colorMax <= colorMin) colorMax = colorMin + 0.1
  d3.select("#colorMaxDisplay").text(colorMax.toFixed(1))
  updateColorScale()
})

d3.select("#resetColorScale").on("click", function() {
  colorMin = -lim
  colorMax = lim
  colorMinSlider.property("value", -lim)
  colorMaxSlider.property("value", lim)
  d3.select("#colorMinDisplay").text(colorMin.toFixed(1))
  d3.select("#colorMaxDisplay").text(colorMax.toFixed(1))
  updateColorScale()
})

// Filtering
function applyFilters() {
  try {
    const lonFilterValue = d3.select("#lonFilter").property("value")
    
    if (lonFilterValue === "0-90") {
      filteredData = data.filter(d => d.lon >= 0 && d.lon <= 90)
    } else if (lonFilterValue === "90-180") {
      filteredData = data.filter(d => d.lon >= 90 && d.lon <= 180)
    } else {
      filteredData = [...data]
    }
    
    if (filteredData.length === 0) return
    
    filteredLons = Array.from(new Set(filteredData.map(d => d.lon))).sort(d3.ascending)
    filteredDecades = Array.from(new Set(filteredData.map(d => d.decade))).sort(d3.ascending)
    
    if (filteredLons.length === 0 || filteredDecades.length === 0) return
    
    x.domain(filteredLons)
    y.domain(filteredDecades)
    
    currentXDomain = [...filteredLons]
    currentYDomain = [...filteredDecades]
    xOriginal.domain(filteredLons)
    yOriginal.domain(filteredDecades)
    
    redrawHeatmap()
  } catch (error) {
    console.error("Error in applyFilters:", error)
  }
}

// Drawing functions
function redrawHeatmap() {
  try {
    if (!filteredData || filteredData.length === 0 || !filteredLons || filteredLons.length === 0 || !filteredDecades || filteredDecades.length === 0) return
    
    g.selectAll("rect.heatmap-cell").remove()
    g.selectAll(".axis").remove()
    g.selectAll("text").filter(function() {
      const text = d3.select(this).text()
      return text === "Longitude" || text === "Decade"
    }).remove()
    
    g.selectAll("rect.heatmap-cell")
      .data(filteredData)
      .enter()
      .append("rect")
      .attr("class", "heatmap-cell")
      .attr("x", d => x(d.lon) || 0)
      .attr("y", d => y(d.decade) || 0)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.val))
      .style("cursor", "crosshair")
    
    const lonTicksFiltered = desiredTicks.filter(v => filteredLons.includes(v))
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(lonTicksFiltered.length > 0 ? lonTicksFiltered : filteredLons.filter((_, i) => i % Math.ceil(filteredLons.length / 12) === 0)).tickFormat(degLabel).tickSizeOuter(0))
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(filteredDecades).tickSizeOuter(0))
    
    g.append("text").attr("x", innerW / 2).attr("y", innerH + 44).attr("text-anchor", "middle").text("Longitude")
    g.append("text").attr("transform", `rotate(-90)`).attr("x", -innerH / 2).attr("y", -56).attr("text-anchor", "middle").text("Decade")
    
    if (typeof brush !== 'undefined') {
      brush.extent([[0, 0], [innerW, innerH]])
      g.select(".brush").remove()
      const brushG = g.append("g").attr("class", "brush").call(brush)
      brushG.select(".overlay")
        .style("cursor", "crosshair")
        .style("pointer-events", "all")
        .on("dblclick.brush", function(event) {
          event.stopPropagation()
          resetZoom()
        })
    }
  } catch (error) {
    console.error("Error in redrawHeatmap:", error)
  }
}

// Axis helpers
const desiredTicks = d3.range(-180, 181, 30)
const degLabel = d => d === 0 ? "0°" : (d < 0 ? `${Math.abs(d)}°W` : `${d}°E`)

// Zoom state
const xOriginal = x.copy()
const yOriginal = y.copy()
let currentXDomain = [...filteredLons]
let currentYDomain = [...filteredDecades]

// Brush for zoom
let isDragging = false
const brush = d3.brush()
  .extent([[0, 0], [innerW, innerH]])
  .on("start", () => { isDragging = true })
  .on("end", brushed)

const brushG = g.append("g").attr("class", "brush").call(brush)
brushG.select(".overlay")
  .style("cursor", "crosshair")
  .style("pointer-events", "all")
  .on("dblclick.brush", function(event) {
    event.stopPropagation()
    resetZoom()
  })

// Filter event listeners
d3.select("#lonFilter").on("change", applyFilters)
d3.select("#resetFilters").on("click", function() {
  d3.select("#lonFilter").property("value", "all")
  applyFilters()
  resetZoom()
})

// Legend
const legendH = innerH
const legendW = 14
const legendX = margin.left + innerW + 16
const legendY = margin.top

const defs = svg.append("defs")
const gradId = "grad-eq-vertical"
const grad = defs.append("linearGradient")
  .attr("id", gradId)
  .attr("x1", "0%").attr("x2", "0%")
  .attr("y1", "100%").attr("y2", "0%")

d3.range(0, 1.0001, 0.1).forEach(t => {
  const value = d3.interpolateNumber(colorMin, colorMax)(t)
  grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(value))
})

svg.append("rect")
  .attr("x", legendX).attr("y", legendY)
  .attr("width", legendW).attr("height", legendH)
  .attr("fill", `url(#${gradId})`).attr("stroke", "#ccc")

let legendScale = d3.scaleLinear().domain([colorMin, colorMax]).range([legendY + legendH, legendY])
let legendAxis = d3.axisRight(legendScale).ticks(6)
let legendG = svg.append("g").attr("transform", `translate(${legendX + legendW},0)`).call(legendAxis)
svg.append("text").attr("x", legendX + legendW + 34).attr("y", legendY - 6).attr("text-anchor", "end").text("Anomaly (°C)")

function updateColorLegend() {
  grad.selectAll("stop").remove()
  d3.range(0, 1.0001, 0.1).forEach(t => {
    const value = d3.interpolateNumber(colorMin, colorMax)(t)
    grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(value))
  })
  
  legendScale = d3.scaleLinear().domain([colorMin, colorMax]).range([legendY + legendH, legendY])
  legendAxis = d3.axisRight(legendScale).ticks(6)
  legendG.call(legendAxis)
}

// Tooltip
const tip = svg.append("g").attr("class", "tooltip").style("display", "none")
tip.append("rect").attr("width", 190).attr("height", 46).attr("fill", "white").attr("stroke", "#ccc").attr("rx", 4)
const ttext = tip.append("text").attr("x", 6).attr("y", 16).style("font-size", 12)
const idx = d3.index(data, d => d.decade, d => d.lon)

// Zoom functions
function brushed(event) {
  try {
    isDragging = false
    if (!event.selection) return
    
    const [[x0, y0], [x1, y1]] = event.selection
    const selX0 = Math.min(x0, x1)
    const selX1 = Math.max(x0, x1)
    const selY0 = Math.min(y0, y1)
    const selY1 = Math.max(y0, y1)
    
    const selectionWidth = selX1 - selX0
    const selectionHeight = selY1 - selY0
    if (selectionWidth < 10 || selectionHeight < 10) {
      g.select(".brush").call(brush.move, null)
      return
    }
    
    const selectedLons = currentXDomain.filter(lon => {
      const xPos = x(lon)
      if (xPos === undefined || isNaN(xPos)) return false
      return !(xPos + x.bandwidth() < selX0 || xPos > selX1)
    })
    
    const selectedDecades = currentYDomain.filter(decade => {
      const yPos = y(decade)
      if (yPos === undefined || isNaN(yPos)) return false
      return !(yPos + y.bandwidth() < selY0 || yPos > selY1)
    })
    
    if (selectedLons.length === 0 || selectedDecades.length === 0) {
      g.select(".brush").call(brush.move, null)
      return
    }
    
    currentXDomain = selectedLons
    currentYDomain = selectedDecades
    x.domain(currentXDomain)
    y.domain(currentYDomain)
    
    updateVisualization()
    g.select(".brush").call(brush.move, null)
  } catch (error) {
    console.error("Error in brush zoom:", error)
  }
}

function resetZoom() {
  currentXDomain = [...xOriginal.domain()]
  currentYDomain = [...yOriginal.domain()]
  x.domain(currentXDomain)
  y.domain(currentYDomain)
  updateVisualization()
  g.select(".brush").call(brush.move, null)
}

function updateVisualization() {
  try {
    const visibleData = filteredData.filter(d => 
      currentXDomain.includes(d.lon) && currentYDomain.includes(d.decade)
    )
    
    if (visibleData.length === 0) return
    
    g.selectAll("rect.heatmap-cell").remove()
    g.selectAll(".axis").remove()
    g.selectAll("text").filter(function() {
      const text = d3.select(this).text()
      return text === "Longitude" || text === "Decade"
    }).remove()
  
    g.selectAll("rect.heatmap-cell")
      .data(visibleData)
      .enter()
      .append("rect")
      .attr("class", "heatmap-cell")
      .attr("x", d => x(d.lon) || 0)
      .attr("y", d => y(d.decade) || 0)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.val))
      .style("cursor", "crosshair")
    
    const lonTicksFiltered = desiredTicks.filter(v => currentXDomain.includes(v))
    
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(lonTicksFiltered.length > 0 ? lonTicksFiltered : currentXDomain.filter((_, i) => i % Math.ceil(currentXDomain.length / 8) === 0)).tickFormat(degLabel).tickSizeOuter(0))
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(currentYDomain).tickSizeOuter(0))
    
    g.append("text").attr("x", innerW / 2).attr("y", innerH + 44).attr("text-anchor", "middle").text("Longitude")
    g.append("text").attr("transform", `rotate(-90)`).attr("x", -innerH / 2).attr("y", -56).attr("text-anchor", "middle").text("Decade")
    
    brush.extent([[0, 0], [innerW, innerH]])
    g.select(".brush").remove()
    const brushG = g.append("g").attr("class", "brush").call(brush)
    brushG.select(".overlay")
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      .on("dblclick.brush", function(event) {
        event.stopPropagation()
        resetZoom()
      })
  } catch (error) {
    console.error("Error updating visualization:", error)
  }
}

// Mouse wheel zoom
g.on("wheel", function(event) {
  try {
    event.preventDefault()
    if (isDragging) return
    
    const [mx, my] = d3.pointer(event, this)
    const delta = -event.deltaY * 0.001
    const zoomFactor = Math.exp(delta)
    
    const centerLonIdx = Math.max(0, Math.min(currentXDomain.length - 1, Math.floor(mx / x.bandwidth())))
    const centerDecadeIdx = Math.max(0, Math.min(currentYDomain.length - 1, Math.floor(my / y.bandwidth())))
    const centerLon = currentXDomain[centerLonIdx]
    const centerDecade = currentYDomain[centerDecadeIdx]
    
    const fullLonIdx = lons.indexOf(centerLon)
    const fullDecadeIdx = decades.indexOf(centerDecade)
    
    if (fullLonIdx === -1 || fullDecadeIdx === -1) return
    
    const newLonCount = Math.max(2, Math.min(lons.length, Math.round(currentXDomain.length / zoomFactor)))
    const newDecadeCount = Math.max(2, Math.min(decades.length, Math.round(currentYDomain.length / zoomFactor)))
    
    const lonStartIdx = Math.max(0, Math.floor(fullLonIdx - newLonCount / 2))
    const lonEndIdx = Math.min(lons.length, lonStartIdx + newLonCount)
    const newLonDomain = lons.slice(lonStartIdx, lonEndIdx)
    
    const decStartIdx = Math.max(0, Math.floor(fullDecadeIdx - newDecadeCount / 2))
    const decEndIdx = Math.min(decades.length, decStartIdx + newDecadeCount)
    const newDecadeDomain = decades.slice(decStartIdx, decEndIdx)
    
    if (newLonDomain.length === 0 || newDecadeDomain.length === 0) return
    
    currentXDomain = newLonDomain
    currentYDomain = newDecadeDomain
    x.domain(currentXDomain)
    y.domain(currentYDomain)
    
    updateVisualization()
  } catch (error) {
    console.error("Error in wheel zoom:", error)
  }
})

// Tooltip
g.on("mousemove", function (event) {
  const [mx, my] = d3.pointer(event, this)
  
  if (mx < 0 || mx > innerW || my < 0 || my > innerH) {
    tip.style("display", "none")
    return
  }
  
  const ix = Math.max(0, Math.min(x.domain().length - 1, Math.floor(mx / x.bandwidth())))
  const dLon = x.domain()[ix]
  
  let dDec = null
  for (const decade of y.domain()) {
    const yPos = y(decade)
    if (yPos === undefined || isNaN(yPos)) continue
    const yEnd = yPos + y.bandwidth()
    if (my >= yPos && my < yEnd) {
      dDec = decade
      break
    }
  }
  
  if (dDec === null) {
    const normalizedY = innerH - my
    const iy = Math.max(0, Math.min(y.domain().length - 1, Math.floor(normalizedY / y.bandwidth())))
    dDec = y.domain()[iy]
  }
  
  const d = idx.get(dDec)?.get(dLon)
  if (!d) {
    tip.style("display", "none")
    return
  }
  
  const labelLon = degLabel(dLon)
  const lines = [`Decade ${dDec}`, `Lon ${labelLon}, ${d.val.toFixed(2)} °C`]
  ttext.selectAll("tspan").data(lines).join("tspan")
    .attr("x", 6)
    .attr("dy", (_, i) => i === 0 ? 0 : 14)
    .text(v => v)
  
  const tx = Math.min(mx + 10 + margin.left, width - 190)
  const ty = Math.max(margin.top, my - 24 + margin.top)
  tip.attr("transform", `translate(${tx},${ty})`).style("display", null)
}).on("mouseout", () => tip.style("display", "none"))

// Initial draw
applyFilters()

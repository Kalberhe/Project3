import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"

const url = "data/equator_belt_longitude_decadal.csv"

const margin = { top: 20, right: 120, bottom: 60, left: 80 }
const width = 1080
const height = 560

const innerW = width - margin.left - margin.right
const innerH = height - margin.top - margin.bottom

const svg = d3.select("#equator-heatmap")
  .append("svg")
  .attr("viewBox", [0, 0, width, height])

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`)
  .classed("hover-target", true)

let data = await d3.csv(url, d => ({
  decade: +d.decade,
  lon: +d.lon,
  val: +d.tas_anom_c_mean
}))

if (!data.some(d => d.lon === 180)) {
  const neg180 = data.filter(d => d.lon === -180)
  data.push(...neg180.map(d => ({ ...d, lon: 180 })))
}

const decades = Array.from(new Set(data.map(d => d.decade))).sort(d3.ascending)
const lons = Array.from(new Set(data.map(d => d.lon))).sort(d3.ascending)

let filteredData = [...data]
let filteredLons = [...lons]
let filteredDecades = [...decades]

const x = d3.scaleBand()
  .domain(lons)
  .range([0, innerW])

const y = d3.scaleBand()
  .domain(decades)
  .range([innerH, 0])

const extent = d3.extent(data, d => d.val)
const lim = Math.max(Math.abs(extent[0]), Math.abs(extent[1]))

let colorMin = -lim
let colorMax = lim

let color = d3.scaleDiverging(d3.interpolateRdBu)
  .domain([colorMax, 0, colorMin])

const desiredTicks = d3.range(-180, 181, 30)

const degLabel = d => {
  if (d === 0) return "0°"
  if (d < 0) return Math.abs(d) + "°W"
  return d + "°E"
}

const tip = svg.append("g")
  .attr("class", "tooltip")
  .style("display", "none")

tip.append("rect")
  .attr("width", 210)
  .attr("height", 83)
  .attr("fill", "white")
  .attr("stroke", "#ccc")
  .attr("rx", 4)

const ttext = tip.append("text")
  .attr("x", 6)
  .attr("y", 16)
  .style("font-size", 12)

const idx = d3.index(data, d => d.decade, d => d.lon)

function computeRegionalMeans(decade) {
  const rows = data.filter(d => d.decade === decade)

  const central = rows.filter(d => d.lon >= 0 && d.lon <= 90)
  const western = rows.filter(d => d.lon >= 90 && d.lon <= 180)

  const mean = arr => d3.mean(arr, d => d.val)

  return {
    c: mean(central),
    w: mean(western),
    diff: mean(central) - mean(western)
  }
}

function applyFilters() {
  const sel = d3.select("#lonFilter").property("value")

  if (sel === "0-90") {
    filteredData = data.filter(d => d.lon >= 0 && d.lon <= 90)
  } else if (sel === "90-180") {
    filteredData = data.filter(d => d.lon >= 90 && d.lon <= 180)
  } else {
    filteredData = [...data]
  }

  filteredLons = Array.from(new Set(filteredData.map(d => d.lon))).sort(d3.ascending)
  filteredDecades = Array.from(new Set(filteredData.map(d => d.decade))).sort(d3.ascending)

  x.domain(filteredLons)
  y.domain(filteredDecades)

  currentXDomain = [...filteredLons]
  currentYDomain = [...filteredDecades]

  redrawHeatmap()
}

d3.select("#lonFilter").on("change", applyFilters)

d3.select("#resetFilters").on("click", () => {
  d3.select("#lonFilter").property("value", "all")
  applyFilters()
  resetZoom()
})

function redrawHeatmap() {
  g.selectAll("rect.heatmap-cell").remove()
  g.selectAll(".axis").remove()
  g.selectAll(".axis-label").remove()

  g.selectAll("rect.heatmap-cell")
    .data(filteredData)
    .enter()
    .append("rect")
    .attr("class", "heatmap-cell")
    .attr("x", d => x(d.lon))
    .attr("y", d => y(d.decade))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.val))

  const lonTicks = desiredTicks.filter(v => filteredLons.includes(v))
  const bottomAxis = d3.axisBottom(x)
    .tickValues(lonTicks.length > 0 ? lonTicks : filteredLons)
    .tickFormat(degLabel)

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(bottomAxis)

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickValues(filteredDecades))

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerW / 2)
    .attr("y", innerH + 44)
    .attr("text-anchor", "middle")
    .text("Longitude")

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -56)
    .attr("text-anchor", "middle")
    .text("Decade")
}

g.on("mousemove", function (event) {
  const [mx, my] = d3.pointer(event, this)

  if (mx < 0 || mx > innerW || my < 0 || my > innerH) {
    tip.style("display", "none")
    return
  }

  const ix = Math.floor(mx / x.bandwidth())
  const lon = x.domain()[ix]

  let dec = null
  for (const d of y.domain()) {
    const y0 = y(d)
    if (my >= y0 && my < y0 + y.bandwidth()) {
      dec = d
      break
    }
  }

  if (dec === null) return

  const cell = idx.get(dec)?.get(lon)
  if (!cell) {
    tip.style("display", "none")
    return
  }

  const region = computeRegionalMeans(dec)

  const lines = [
    `Decade ${dec}`,
    `Lon ${degLabel(lon)}: ${cell.val.toFixed(2)} °C`,
    `Central mean: ${region.c.toFixed(2)} °C`,
    `Western mean: ${region.w.toFixed(2)} °C`,
    `Difference: ${region.diff.toFixed(2)} °C`
  ]

  ttext.selectAll("tspan")
    .data(lines)
    .join("tspan")
    .attr("x", 6)
    .attr("dy", (d, i) => i === 0 ? 0 : 14)
    .text(d => d)

  const lineHeight = 14
  const padding = 10
  const boxHeight = lines.length * lineHeight + padding

  tip.select("rect")
    .attr("height", boxHeight)

  const tx = Math.min(mx + margin.left + 16, width - 210)
  const ty = my + margin.top - 20

  tip.attr("transform", `translate(${tx},${ty})`)
    .style("display", null)
})

g.on("mouseout", () => tip.style("display", "none"))

const legendH = innerH
const legendW = 14
const legendX = margin.left + innerW + 24
const legendY = margin.top

const defs = svg.append("defs")
const gradId = "grad-eq-vertical"

const grad = defs.append("linearGradient")
  .attr("id", gradId)
  .attr("x1", "0%").attr("x2", "0%")
  .attr("y1", "100%").attr("y2", "0%")

function updateGradientStops() {
  grad.selectAll("stop").remove()

  d3.range(0, 1.0001, 0.1).forEach(t => {
    const value = d3.interpolateNumber(colorMin, colorMax)(t)
    grad.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(value))
  })
}

updateGradientStops()

const legendBar = svg.append("rect")
  .attr("x", legendX)
  .attr("y", legendY)
  .attr("width", legendW)
  .attr("height", legendH)
  .attr("fill", `url(#${gradId})`)
  .attr("stroke", "#ccc")

let legendScale = d3.scaleLinear()
  .domain([colorMin, colorMax])
  .range([legendY + legendH, legendY])

let legendAxis = d3.axisRight(legendScale).ticks(6)

let legendG = svg.append("g")
  .attr("transform", `translate(${legendX + legendW},0)`)
  .call(legendAxis)

svg.append("text")
  .attr("x", legendX + legendW + 32)
  .attr("y", legendY - 6)
  .attr("text-anchor", "end")
  .style("font-size", 12)
  .text("Anomaly (°C)")

const dimmerTop = svg.append("rect")
  .attr("x", legendX)
  .attr("y", legendY)
  .attr("width", legendW)
  .attr("height", 0)
  .attr("fill", "white")
  .attr("opacity", 0.8)
  .style("pointer-events", "none")

const dimmerBottom = svg.append("rect")
  .attr("x", legendX)
  .attr("y", legendY + legendH)
  .attr("width", legendW)
  .attr("height", 0)
  .attr("fill", "white")
  .attr("opacity", 0.8)
  .style("pointer-events", "none")

let filterTop = colorMax
let filterBottom = colorMin

const handleTop = svg.append("circle")
  .attr("cx", legendX + legendW / 2)
  .attr("cy", legendY)
  .attr("r", 6)
  .attr("fill", "#333")
  .attr("stroke", "white")
  .attr("stroke-width", 2)
  .style("cursor", "ns-resize")

const handleBottom = svg.append("circle")
  .attr("cx", legendX + legendW / 2)
  .attr("cy", legendY + legendH)
  .attr("r", 6)
  .attr("fill", "#333")
  .attr("stroke", "white")
  .attr("stroke-width", 2)
  .style("cursor", "ns-resize")

function applyVolumeFilter() {
  const reset =
    Math.abs(filterTop - colorMax) < 0.1 &&
    Math.abs(filterBottom - colorMin) < 0.1

  g.selectAll("rect.heatmap-cell")
    .attr("opacity", d => {
      if (reset) return 1
      const lo = Math.min(filterTop, filterBottom)
      const hi = Math.max(filterTop, filterBottom)
      return d.val >= lo && d.val <= hi ? 1 : 0.05
    })
}

const dragBehavior = d3.drag()
  .on("drag", function (event) {
    const isTop = this === handleTop.node()

    let yPos = Math.max(legendY, Math.min(legendY + legendH, event.y))

    const topY = +handleTop.attr("cy")
    const bottomY = +handleBottom.attr("cy")

    if (isTop && yPos > bottomY) yPos = bottomY
    if (!isTop && yPos < topY) yPos = topY

    if (isTop) {
      handleTop.attr("cy", yPos)
      dimmerTop.attr("height", yPos - legendY)
      filterTop = legendScale.invert(yPos)
    } else {
      handleBottom.attr("cy", yPos)
      dimmerBottom
        .attr("y", yPos)
        .attr("height", (legendY + legendH) - yPos)
      filterBottom = legendScale.invert(yPos)
    }

    applyVolumeFilter()
  })

handleTop.call(dragBehavior)
handleBottom.call(dragBehavior)

function resetSliders() {
  filterTop = colorMax
  filterBottom = colorMin

  handleTop.attr("cy", legendY)
  handleBottom.attr("cy", legendY + legendH)

  dimmerTop.attr("height", 0)
  dimmerBottom.attr("y", legendY + legendH).attr("height", 0)

  applyVolumeFilter()
}

function updateColorLegend() {
  color = d3.scaleDiverging(d3.interpolateRdBu)
    .domain([colorMax, 0, colorMin])

  updateGradientStops()

  legendScale = d3.scaleLinear()
    .domain([colorMin, colorMax])
    .range([legendY + legendH, legendY])

  legendAxis = d3.axisRight(legendScale).ticks(6)
  legendG.call(legendAxis)

  resetSliders()
}

d3.select("#colorMinSlider").on("input", function () {
  colorMin = +this.value
  if (colorMin >= colorMax) colorMin = colorMax - 0.1
  d3.select("#colorMinDisplay").text(colorMin.toFixed(1))
  updateColorLegend()
})

d3.select("#colorMaxSlider").on("input", function () {
  colorMax = +this.value
  if (colorMax <= colorMin) colorMax = colorMin + 0.1
  d3.select("#colorMaxDisplay").text(colorMax.toFixed(1))
  updateColorLegend()
})

d3.select("#resetColorScale").on("click", () => {
  colorMin = -lim
  colorMax = lim
  d3.select("#colorMinSlider").property("value", -lim)
  d3.select("#colorMaxSlider").property("value", lim)
  d3.select("#colorMinDisplay").text(colorMin.toFixed(1))
  d3.select("#colorMaxDisplay").text(colorMax.toFixed(1))
  updateColorLegend()
})

let currentXDomain = [...filteredLons]
let currentYDomain = [...filteredDecades]

let isDragging = false

const brush = d3.brush()
  .extent([[0, 0], [innerW, innerH]])
  .on("start", () => { isDragging = true })
  .on("end", brushed)

const brushG = g.append("g")
  .attr("class", "brush")
  .call(brush)

brushG.select(".overlay")
  .style("cursor", "crosshair")
  .on("dblclick.brush", event => {
    event.stopPropagation()
    resetZoom()
  })

function brushed(event) {
  isDragging = false
  if (!event.selection) return

  const [[x0, y0], [x1, y1]] = event.selection

  if (x1 - x0 < 10 || y1 - y0 < 10) {
    g.select(".brush").call(brush.move, null)
    return
  }

  const selectedLons = currentXDomain.filter(lon => {
    const xPos = x(lon)
    return xPos + x.bandwidth() >= x0 && xPos <= x1
  })

  const selectedDec = currentYDomain.filter(decade => {
    const yPos = y(decade)
    return yPos + y.bandwidth() >= y0 && yPos <= y1
  })

  if (selectedLons.length === 0 || selectedDec.length === 0) {
    g.select(".brush").call(brush.move, null)
    return
  }

  currentXDomain = selectedLons
  currentYDomain = selectedDec

  x.domain(currentXDomain)
  y.domain(currentYDomain)

  updateVisualization()

  g.select(".brush").call(brush.move, null)
}

function resetZoom() {
  currentXDomain = [...filteredLons]
  currentYDomain = [...filteredDecades]

  x.domain(currentXDomain)
  y.domain(currentYDomain)

  updateVisualization()

  g.select(".brush").call(brush.move, null)
}

function updateVisualization() {
  g.selectAll("rect.heatmap-cell").remove()
  g.selectAll(".axis").remove()
  g.selectAll(".axis-label").remove()

  const visible = filteredData.filter(d =>
    currentXDomain.includes(d.lon) &&
    currentYDomain.includes(d.decade)
  )

  g.selectAll("rect.heatmap-cell")
    .data(visible)
    .enter()
    .append("rect")
    .attr("class", "heatmap-cell")
    .attr("x", d => x(d.lon))
    .attr("y", d => y(d.decade))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.val))

  const lonTicks = desiredTicks.filter(v => currentXDomain.includes(v))

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x)
      .tickValues(lonTicks.length > 0 ? lonTicks : currentXDomain)
      .tickFormat(degLabel))

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickValues(currentYDomain))

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerW / 2)
    .attr("y", innerH + 44)
    .attr("text-anchor", "middle")
    .text("Longitude")

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -56)
    .attr("text-anchor", "middle")
    .text("Decade")

  brush.extent([[0, 0], [innerW, innerH]])
  g.select(".brush").remove()
  const newBrush = g.append("g").attr("class", "brush").call(brush)
  newBrush.select(".overlay")
    .style("cursor", "crosshair")
    .on("dblclick.brush", event => {
      event.stopPropagation()
      resetZoom()
    })
}

g.on("wheel", function (event) {
  event.preventDefault()
  if (isDragging) return

  const [mx, my] = d3.pointer(event, this)
  const delta = -event.deltaY * 0.001
  const zoom = Math.exp(delta)

  const ix = Math.floor(mx / x.bandwidth())
  const iy = Math.floor(my / y.bandwidth())

  const centerLon = currentXDomain[ix]
  const centerDec = currentYDomain[iy]

  const fullLonIdx = lons.indexOf(centerLon)
  const fullDecIdx = decades.indexOf(centerDec)

  const lonCount = Math.max(2, Math.min(lons.length, Math.round(currentXDomain.length / zoom)))
  const decCount = Math.max(2, Math.min(decades.length, Math.round(currentYDomain.length / zoom)))

  const lonStart = Math.max(0, Math.floor(fullLonIdx - lonCount / 2))
  const lonEnd = Math.min(lons.length, lonStart + lonCount)

  const decStart = Math.max(0, Math.floor(fullDecIdx - decCount / 2))
  const decEnd = Math.min(decades.length, decStart + decCount)

  currentXDomain = lons.slice(lonStart, lonEnd)
  currentYDomain = decades.slice(decStart, decEnd)

  x.domain(currentXDomain)
  y.domain(currentYDomain)

  updateVisualization()
})

applyFilters()
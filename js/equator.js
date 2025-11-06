import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"

const url = "data/equator_belt_longitude_decadal.csv"
const margin = { top: 20, right: 70, bottom: 60, left: 80 }
const width = 980, height = 520
const innerW = width - margin.left - margin.right
const innerH = height - margin.top - margin.bottom

const svg = d3.select("#equator-heatmap").append("svg").attr("viewBox", [0, 0, width, height])
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`).classed("hover-target", true)

const data = await d3.csv(url, d => ({ decade: +d.decade, lon: +d.lon, val: +d.tas_anom_c_mean }))

if (!data.some(d => d.lon === 180)) {
  const neg180 = data.filter(d => d.lon === -180)
  data.push(...neg180.map(d => ({ ...d, lon: 180 })))
}

const decades = Array.from(new Set(data.map(d => d.decade))).sort(d3.ascending)
const lons = Array.from(new Set(data.map(d => d.lon))).sort(d3.ascending)

const x = d3.scaleBand().domain(lons).range([0, innerW])
const y = d3.scaleBand().domain(decades).range([innerH, 0])

const extent = d3.extent(data, d => d.val)
const lim = Math.max(Math.abs(extent[0] ?? 0), Math.abs(extent[1] ?? 0)) || 1e-6
const color = d3.scaleDiverging(d3.interpolateRdBu).domain([+lim, 0, -lim])

g.selectAll("rect").data(data).join("rect")
  .attr("x", d => x(d.lon)).attr("y", d => y(d.decade))
  .attr("width", x.bandwidth()).attr("height", y.bandwidth())
  .attr("fill", d => color(d.val))

const desiredTicks = d3.range(-180, 181, 30)
const lonTicks = desiredTicks.filter(v => lons.includes(v))
const degLabel = d => d === 0 ? "0°" : (d < 0 ? `${Math.abs(d)}°W` : `${d}°E`)

g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
  .call(d3.axisBottom(x).tickValues(lonTicks).tickFormat(degLabel).tickSizeOuter(0))
g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(decades).tickSizeOuter(0))

g.append("text").attr("x", innerW / 2).attr("y", innerH + 44).attr("text-anchor", "middle").text("Longitude")
g.append("text").attr("transform", `rotate(-90)`).attr("x", -innerH / 2).attr("y", -56).attr("text-anchor", "middle").text("Decade")

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
  const value = d3.interpolateNumber(-lim, lim)(t)
  grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(value))
})

svg.append("rect")
  .attr("x", legendX).attr("y", legendY)
  .attr("width", legendW).attr("height", legendH)
  .attr("fill", `url(#${gradId})`).attr("stroke", "#ccc")

const legendScale = d3.scaleLinear().domain([-lim, lim]).range([legendY + legendH, legendY])
const legendAxis = d3.axisRight(legendScale).ticks(6)
svg.append("g").attr("transform", `translate(${legendX + legendW},0)`).call(legendAxis)
svg.append("text").attr("x", legendX + legendW + 34).attr("y", legendY - 6).attr("text-anchor", "end").text("Anomaly (°C)")

const tip = g.append("g").attr("class", "tooltip").style("display", "none")
tip.append("rect").attr("width", 190).attr("height", 46).attr("fill", "white").attr("stroke", "#ccc").attr("rx", 4)
const ttext = tip.append("text").attr("x", 6).attr("y", 16).style("font-size", 12)
const idx = d3.index(data, d => d.decade, d => d.lon)

g.on("mousemove", function (event) {
  const [mx, my] = d3.pointer(event, this)
  const ix = Math.max(0, Math.min(x.domain().length - 1, Math.floor(mx / x.bandwidth())))
  const iy = Math.max(0, Math.min(y.domain().length - 1, Math.floor(my / y.bandwidth())))
  const dLon = x.domain()[ix]
  const dDec = y.domain()[iy]
  const d = idx.get(dDec)?.get(dLon)
  if (!d) return
  const labelLon = degLabel(dLon)
  const lines = [`Decade ${dDec}`, `Lon ${labelLon}, ${d.val.toFixed(2)} °C`]
  ttext.selectAll("tspan").data(lines).join("tspan")
    .attr("x", 6)
    .attr("dy", (_, i) => i === 0 ? 0 : 14)
    .text(v => v)
  const tx = Math.min(mx + 10, innerW - 190)
  const ty = Math.max(0, my - 24)
  tip.attr("transform", `translate(${tx},${ty})`).style("display", null)
}).on("mouseout", () => tip.style("display", "none"))

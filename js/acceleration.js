import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"

const url = "data/arctic_vs_global_ensemble_yearly.csv"
const margin = { top: 28, right: 220, bottom: 56, left: 64 }
const width = 1200, height = 420
const innerW = width - margin.left - margin.right
const innerH = height - margin.top - margin.bottom

const svg = d3.select("#acceleration").append("svg").attr("viewBox", [0, 0, width, height])
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`).classed("hover-target", true)

const raw = await d3.csv(url, d => ({ year: +d.year, val: +d.tas_anom_c, region: d.region }))
const nameMap = new Map([["Arctic_60N_90N", "Arctic 60°N to 90°N"], ["Global", "Global average"]])
raw.forEach(d => d.region = nameMap.get(d.region) ?? d.region)
const byRegion = d3.group(raw, d => d.region)

function toAccel(series) {
  const s = series.slice().sort((a, b) => d3.ascending(a.year, b.year))
  const out = []
  for (let i = 1; i < s.length; i++) {
    out.push({ year: s[i].year, val: s[i].val - s[i - 1].val, region: s[i].region })
  }
  return out
}

const acc = Array.from(byRegion.values()).flatMap(toAccel)

const x = d3.scaleLinear().domain(d3.extent(acc, d => d.year)).range([0, innerW])
const y = d3.scaleLinear().domain(d3.extent(acc, d => d.val)).nice().range([innerH, 0])

const color = new Map([["Arctic 60°N to 90°N", "#d62728"], ["Global average", "#1f77b4"]])

g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
  .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")))
g.append("g").attr("class", "axis").call(d3.axisLeft(y))

g.append("text").attr("x", innerW / 2).attr("y", innerH + 40).attr("text-anchor", "middle").text("Year")
g.append("text").attr("transform", `rotate(-90)`).attr("x", -innerH / 2).attr("y", -50).attr("text-anchor", "middle").text("Change in anomaly (°C per year)")

g.append("line").attr("x1", 0).attr("x2", innerW).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#aaa").attr("stroke-dasharray", "4,4")

const line = d3.line().x(d => x(d.year)).y(d => y(d.val))
const area = d3.area().x(d => x(d.year)).y0(y(0)).y1(d => y(d.val))

const accByRegion = d3.group(acc, d => d.region)
for (const [name, arr] of accByRegion) {
  const data = arr.slice().sort((a, b) => d3.ascending(a.year, b.year))
  g.append("path").attr("fill", color.get(name)).attr("opacity", 0.15).attr("d", area(data))
  g.append("path").attr("fill", "none").attr("stroke", color.get(name)).attr("stroke-width", 2).attr("d", line(data))
}

const tip = g.append("g").attr("class", "tooltip").style("display", "none")
tip.append("rect").attr("width", 230).attr("height", 44).attr("fill", "white").attr("stroke", "#ccc").attr("rx", 4)
const ttext = tip.append("text").attr("x", 6).attr("y", 16).style("font-size", 12)

for (const [name, arr] of accByRegion) {
  const data = arr.slice().sort((a, b) => d3.ascending(a.year, b.year))
  g.append("path")
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 14)
    .attr("pointer-events", "stroke")
    .attr("d", line(data))
    .on("mousemove", function(event) {
      const [mx] = d3.pointer(event, this)
      const yr = Math.round(x.invert(mx))
      const row = data.reduce((best, d) =>
        Math.abs(d.year - yr) < Math.abs((best?.year ?? Infinity) - yr) ? d : best, null)
      if (!row) return
      const lines = [`Year ${row.year}`, `${name}: ${row.val.toFixed(3)} °C per year`]
      ttext.selectAll("tspan").data(lines).join("tspan")
        .attr("x", 6)
        .attr("dy", (_, i) => i === 0 ? 0 : 14)
        .text(d => d)
      const tx = Math.min(x(row.year) + 12, innerW - 230)
      const ty = Math.max(4, Math.min(y(row.val) - 22, innerH - 44))
      tip.attr("transform", `translate(${tx},${ty})`).style("display", null)
    })
    .on("mouseout", () => tip.style("display", "none"))
}

const legend = svg.append("g").attr("class", "legend")
  .attr("transform", `translate(${width - margin.right + 8},${margin.top})`)
let i = 0
for (const name of accByRegion.keys()) {
  const yoff = i * 20
  legend.append("rect").attr("x", 0).attr("y", yoff - 8).attr("width", 12).attr("height", 12).attr("fill", color.get(name))
  legend.append("text").attr("x", 18).attr("y", yoff).attr("alignment-baseline", "middle").text(name)
  i++
}

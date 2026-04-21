let data = null;

async function loadDataset(dataset) {
  const response = await fetch(`${dataset}.json`);
  data = await response.json();
}

function updateUI(value = undefined) {
  const mode = d3.select("#mode").node().value;
  const param = d3.select("#param");
  if (mode === "k-nearest-neighbor") {
    param.attr("min", 3).attr("max", 50).attr("value", value || 15).attr("step", 1);
    d3.select("#label-for-param").text(`K: ${param.attr("value")}`);
  } else {
    param.attr("min", 0.5).attr("max", 10).attr("value", value || 0.5).attr("step", 0.001);
    d3.select("#label-for-param").text(`R: ${param.attr("value")}`);
  }
}

async function submit() {
  if (!data) return;
  const mode = d3.select("#mode").node().value;
  const param = +d3.select("#param").node().value;
  const req = { data };
  if (mode === "k-nearest-neighbor") {
    req.k = param;
  } else {
    req.r = param;
  }
  const response = await fetch("/isomap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const xy = await response.json();
  plot(xy);
}

function plot(xy) {
  const svg = d3.select("#main");
  svg.selectAll("*").remove();
  const xScale = d3.scaleLinear().domain(d3.extent(xy, d => d[0])).range([50, 450]);
  const yScale = d3.scaleLinear().domain(d3.extent(xy, d => d[1])).range([450, 50]);
  svg.selectAll("circle")
    .data(xy)
    .enter()
    .append("circle")
    .attr("cx", d => xScale(d[0]))
    .attr("cy", d => yScale(d[1]))
    .attr("r", 2)
    .attr("fill", "steelblue");
}

document.addEventListener("DOMContentLoaded", () => {
  loadDataset("swiss_roll");
  updateUI();
  d3.select("#dataset").on("change", function() {
    loadDataset(this.value);
  });
  d3.select("#mode").on("change", () => updateUI());
  d3.select("#param").on("input", () => {
    updateUI(d3.select("#param").node().value);
  });
  d3.select("#submit").on("click", submit);
});

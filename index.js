let datasetData = null;

async function loadDataset(datasetName) {
  try {
    const response = await fetch(`static/datasets/${datasetName}.json`);
    datasetData = await response.json();
    console.log("Data loaded successfully!");
  } catch (err) {
    console.error("Error loading dataset:", err);
  }
}

function updateUI(value) {
    const mode = d3.select("#mode").node().value;
    const param = d3.select("#param");
    
    param.property("value", value);
    d3.select("#param-num").property("value", value);
  
    if (mode === "k-nearest-neighbor") {
      param.attr("min", 3).attr("max", 50).attr("step", 1);
      // Just "K" to match the original
      d3.select("#label-for-param").text(`K`); 
    } else {
      param.attr("min", 0.1).attr("max", 10).attr("step", 0.1);
      // Just "R" to match the original
      d3.select("#label-for-param").text(`R`);
    }
  }

async function submit() {
    if (!datasetData) return;
    
    const mode = d3.select("#mode").node().value;
    const paramValue = +d3.select("#param").node().value;
    
    // Extract points and colors inside the scope of submit()
    const points3D = Array.isArray(datasetData) ? datasetData : datasetData.data;
    const colors = Array.isArray(datasetData) ? points3D.map((_, i) => i) : (datasetData.color || datasetData.target || points3D.map((_, i) => i));

    try {
        const response = await fetch("/isomap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: points3D,
                [mode === "k-nearest-neighbor" ? "k" : "r"]: paramValue
            }),
        });

        const projected2D = await response.json();

        if (projected2D.error || !Array.isArray(projected2D)) {
            console.error("Server-side Isomap Error:", projected2D.error);
            return;
        }

        console.log("Successfully received 2D points:", projected2D.length);
        console.log("Colors array check:", colors.length);

        // Pass BOTH arguments to the plotting functions
        plot3D(points3D, colors);
        plot2D(projected2D, colors);

    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

function plot3D(data, colors) {
    const trace = {
      x: data.map(d => d[0]),
      y: data.map(d => d[1]),
      z: data.map(d => d[2]),
      mode: 'markers',
      marker: {
        size: 2,
        color: colors,
        colorscale: 'Viridis',
        opacity: 0.8
      },
      type: 'scatter3d'
    };
  
    const layout = {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      autosize: true, // Let it fill the container
      paper_bgcolor: '#eee',
      scene: {
          xaxis: { title: '', showgrid: true, backgroundcolor: "#eee" },
          yaxis: { title: '', showgrid: true, backgroundcolor: "#eee" },
          zaxis: { title: '', showgrid: true, backgroundcolor: "#eee" }
      }
    };
  
    Plotly.newPlot('plot-3d', [trace], layout, {responsive: true});
  }

function plot2D(points, colors) {
    console.log("Plotting 2D points. Sample point:", points[0]);
    
    const svg = d3.select("#main");
    svg.selectAll("*").remove();
    
    if (!points || points.length === 0 || !colors) return;

    const width = +svg.attr("width") || 500;
    const height = +svg.attr("height") || 400;
    const padding = 50;

    const xExtent = d3.extent(points, d => d[0]);
    const yExtent = d3.extent(points, d => d[1]);

    const xScale = d3.scaleLinear().domain(xExtent).range([padding, width - padding]);
    const yScale = d3.scaleLinear().domain(yExtent).range([height - padding, padding]);

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
                         .domain(d3.extent(colors));

    // --- ADD AXES ---
    // X Axis
    svg.append("g")
        .attr("transform", `translate(0, ${height - padding})`)
        .call(d3.axisBottom(xScale).ticks(5));

    // Y Axis
    svg.append("g")
        .attr("transform", `translate(${padding}, 0)`)
        .call(d3.axisLeft(yScale).ticks(5));

    // Add Gridlines (Optional, but looks like the reference)
    svg.append("g")			
        .attr("class", "grid")
        .attr("transform", `translate(0, ${height - padding})`)
        .call(d3.axisBottom(xScale).tickSize(-height + 2 * padding).tickFormat(""));

    svg.append("g")			
        .attr("class", "grid")
        .attr("transform", `translate(${padding}, 0)`)
        .call(d3.axisLeft(yScale).tickSize(-width + 2 * padding).tickFormat(""));

    // Draw Circles
    svg.append("g")
        .selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d[0]))
        .attr("cy", d => yScale(d[1]))
        .attr("r", 3)
        .attr("fill", (d, i) => colorScale(colors[i]))
        .attr("stroke", "#fff") // Added a small white border like the reference
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.8);
}

document.addEventListener("DOMContentLoaded", () => {
    // Initial Load
    loadDataset(d3.select("#dataset").node().value).then(() => {
        updateUI(15);
        submit(); // Runs the first time so the screen isn't blank
    });

    // Listeners that replace the need for a button
    d3.select("#dataset").on("change", async function() {
        await loadDataset(this.value);
        submit();
    });

    d3.select("#mode").on("change", () => {
        const val = d3.select("#mode").node().value === "k-nearest-neighbor" ? 15 : 0.5;
        updateUI(val);
        submit();
    });

    d3.select("#param").on("change", () => {
        submit(); // Triggers math when user lets go of slider
    });

    d3.select("#param").on("input", function() {
        updateUI(this.value); // Just updates the label text while sliding
    });
});
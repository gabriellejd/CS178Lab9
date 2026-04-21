import numpy as np
from flask import Flask, render_template, request
from flask_cors import CORS
from scipy.sparse.csgraph import shortest_path

app = Flask(__name__)
CORS(app)

def euclidean_pairwise_distance(data):
    # Vectorized calculation: (a-b)^2 = a^2 + b^2 - 2ab
    sq_norms = np.sum(data**2, axis=1)
    dist_sq = sq_norms[:, np.newaxis] + sq_norms - 2 * np.dot(data, data.T)
    # Clip to 0 to avoid tiny negative numbers from floating point errors
    return np.sqrt(np.clip(dist_sq, 0, None))

def compute_graph(data, k=15, r=None):
    """
    Your verified implementation for graph construction.
    """
    n = data.shape[0]
    euclidean_pdist = euclidean_pairwise_distance(data)
    graph_adj_matrix = np.zeros([n, n]) 
    
    if r is not None:
        # r-ball mode
        mask = (euclidean_pdist <= r) & ~np.eye(n, dtype=bool)
        graph_adj_matrix[mask] = euclidean_pdist[mask]
    else:
        # k-nearest-neighbor mode
        for i in range(n):
            # Pick k+1 because the closest point is always itself
            knn_indices = np.argsort(euclidean_pdist[i])[:k+1]
            for j in knn_indices:
                if i != j:
                    graph_adj_matrix[i, j] = euclidean_pdist[i, j]
                    graph_adj_matrix[j, i] = euclidean_pdist[i, j]
    return graph_adj_matrix

def classical_mds(distances, n_components=2):
    n = distances.shape[0]
    # Double centering
    h = np.eye(n) - np.ones([n, n]) / n
    # Apply -0.5 * H * D^2 * H
    sim = -0.5 * h @ (distances ** 2) @ h
    u, s, vt = np.linalg.svd(sim)
    return u[:, :n_components] * np.sqrt(s[:n_components])

def isomap(data, k=15, r=None):
    # Step 1: Neighbor Graph
    graph = compute_graph(data, k=k, r=r)
    
    # Step 2: Shortest Path
    # This is the most likely spot for a crash if the graph is disconnected
    geodesic = shortest_path(graph, directed=False)
    
    # CRITICAL: Handle disconnected points (infinity)
    if np.isinf(geodesic).any():
        # Replace infinity with a very large value so MDS can still run
        valid_distances = geodesic[~np.isinf(geodesic)]
        fill_val = np.max(valid_distances) * 10 if valid_distances.size > 0 else 1e6
        geodesic[np.isinf(geodesic)] = fill_val
    
    # Step 3: MDS
    return classical_mds(geodesic, n_components=2)

@app.route("/")
def index():
    """Serves the front-end interface."""
    return render_template("index.html")

@app.route("/isomap", methods=["POST"])
def compute_isomap():
    req = request.get_json()
    
    # Safety check: make sure 'data' exists in the request
    if "data" not in req or not req["data"]:
        return {"error": "No data received"}, 400
        
    data = np.array(req["data"])
    
    # Check if data is at least 2D (rows, columns)
    if data.ndim < 2:
         return {"error": "Data must be a 2D array"}, 400

    k_val = req.get("k")
    r_val = req.get("r")
    
    try:
        if k_val is not None:
            xy = isomap(data, k=int(k_val), r=None)
        else:
            xy = isomap(data, k=None, r=float(r_val))
        return xy.tolist()
    except Exception as e:
        print(f"Isomap error: {e}")
        return {"error": str(e)}, 500

if __name__ == "__main__":
    # debug=True allows you to see python errors in the browser/terminal
    app.run(port=5001, debug=True)
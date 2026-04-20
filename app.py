import numpy as np
from flask import Flask, render_template, request
from flask_cors import CORS
from scipy.sparse.csgraph import shortest_path

app = Flask(__name__)
CORS(app)


def euclidean_pairwise_distance(data):
    diff = data[:, None, :] - data[None, :, :]
    return np.sqrt(np.sum(diff * diff, axis=2))


def compute_graph(data, k=15, r=None):
    n = data.shape[0]
    pdist = euclidean_pairwise_distance(data)
    graph = np.zeros([n, n], dtype=float)

    if r is not None:
        mask = (pdist <= r) & ~np.eye(n, dtype=bool)
        graph[mask] = pdist[mask]
    else:
        for i in range(n):
            knn_indices = np.argsort(pdist[i])[1 : k + 1]
            graph[i, knn_indices] = pdist[i, knn_indices]
            graph[knn_indices, i] = pdist[i, knn_indices]

    return graph


def classical_mds(distances, n_components=2):
    n = distances.shape[0]
    h = np.eye(n) - np.ones([n, n]) / n
    sim = -0.5 * h @ (distances ** 2) @ h
    u, s, vt = np.linalg.svd(sim)
    return u[:, :n_components] * np.sqrt(s[:n_components])


def isomap(data, k=15, r=None):
    graph = compute_graph(data, k=k, r=r)
    geodesic = shortest_path(graph, directed=False)
    return classical_mds(geodesic, n_components=2)


@app.route("/isomap", methods=["POST"])
def compute_isomap():
    req = request.get_json()
    data = np.array(req["data"])
    xy = None
    if "k" in req:
        xy = isomap(data, k=req["k"], r=None)
    elif "r" in req:
        xy = isomap(data, r=req["r"], k=None)
    return xy.tolist()


if __name__ == "__main__":
    app.run(port=5001)

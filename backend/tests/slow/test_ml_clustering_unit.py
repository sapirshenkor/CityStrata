"""
Slow tests for ML clustering helpers (sklearn/numpy import cost).

Excluded from default pytest run via ``pytest -m "not slow"``.
"""

import numpy as np
import pytest

from ML.clustering import PC_COLUMNS, PC_GROUPS


@pytest.mark.slow
def test_pc_columns_align_with_group_definitions():
    grouped = {col for cols in PC_GROUPS.values() for col in cols}
    assert grouped == set(PC_COLUMNS)


@pytest.mark.slow
def test_kmeans_labels_shape_for_toy_matrix():
    from sklearn.cluster import KMeans

    rng = np.random.default_rng(42)
    x = rng.normal(size=(20, len(PC_COLUMNS)))
    model = KMeans(n_clusters=4, n_init=10, random_state=42)
    labels = model.fit_predict(x)
    assert labels.shape == (20,)
    assert set(labels.tolist()) <= {0, 1, 2, 3}

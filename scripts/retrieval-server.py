"""Local embedding + rerank sidecar for NAVEXA retrieval.

ANVIL-SPEC.md §7.1 specifies bge-m3 embeddings and bge-reranker-v2-m3,
running locally via sentence-transformers. This is a small FastAPI service
that exposes:

  POST /embed   { "inputs": ["text", ...] } -> { "embeddings": [[float, ...]] }
  POST /rerank  { "query": "...", "passages": ["...", ...], "top_k": 5 }
                -> { "scores": [float, ...], "indices": [int, ...] }
  POST /warm    (no body)                    -> { "warm": true }

Run:
  pip install "fastapi[standard]" sentence-transformers FlagEmbedding torch
  uvicorn scripts.retrieval-server:app --host 127.0.0.1 --port 8765

Set EMBEDDING_URL, RERANKER_URL, and RETRIEVAL_WARM_URL to point at this
service (defaults already assume http://127.0.0.1:8765).
"""

from __future__ import annotations

from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="NAVEXA retrieval")

_embedder = None
_reranker = None


def _load_embedder():
    global _embedder
    if _embedder is None:
        from FlagEmbedding import BGEM3FlagModel
        _embedder = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
    return _embedder


def _load_reranker():
    global _reranker
    if _reranker is None:
        from FlagEmbedding import FlagReranker
        _reranker = FlagReranker("BAAI/bge-reranker-v2-m3", use_fp16=True)
    return _reranker


class EmbedRequest(BaseModel):
    inputs: List[str]


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]


class RerankRequest(BaseModel):
    query: str
    passages: List[str]
    top_k: int = 5


class RerankResponse(BaseModel):
    scores: List[float]
    indices: List[int]


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    model = _load_embedder()
    out = model.encode(req.inputs, batch_size=8, max_length=1024)
    dense = out["dense_vecs"]
    return EmbedResponse(embeddings=[v.tolist() for v in dense])


@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest) -> RerankResponse:
    reranker = _load_reranker()
    pairs = [(req.query, p) for p in req.passages]
    raw = reranker.compute_score(pairs, normalize=True)
    # FlagReranker returns a scalar for a single pair; wrap it for consistency.
    scores = [float(raw)] if isinstance(raw, float) else [float(s) for s in raw]
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[: req.top_k]
    return RerankResponse(scores=[scores[i] for i in ranked], indices=ranked)


@app.post("/warm")
def warm() -> dict:
    _load_embedder()
    _load_reranker()
    return {"warm": True}

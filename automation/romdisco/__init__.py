"""romdisco — ROM discovery / validation automation for CustomRom World.

Layers (each replaceable in isolation):
  source_registry  curated trust: exact host/path matching, source kinds
  models           dataclasses + JSON schema for the database
  search           search backends (DDG, Bing, fixtures) — discovery input only
  discovery        registry-driven query generation and candidate collection
  validation       strict per-candidate validation, verification, dedupe
  database         JSON database load/save/export
  cli              command line interface
  tests            deterministic self-tests
"""

from .models import Device, Rom, Candidate  # noqa: F401
from .source_registry import SourceRegistry, registry  # noqa: F401

__all__ = ["Device", "Rom", "Candidate", "SourceRegistry", "registry"]
__version__ = "2.0.0"

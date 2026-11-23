# Changelog

## 0.2.0 — 2026-11-23

- Target DSH Web 0.2.3-alpha.2 and declare the tested host version in engines.dsh.
- Restrict resource routes to the local owner and propagate temporary host authentication failures as HTTP 503.
- Update integration tests to the batch tool executor. The resource index and uploaded files retain their existing format and location.
- For DSH Web 0.2.0-rc.2, use plugin v0.1.2.

## 0.1.2 — 2026-10-08

First public release of DSH Project Space, an independently maintained community plugin for DSH Web 0.2.0-rc.2.

- Organize references and deliverables per workspace, with search, filtering, source-session links and conversation reuse.
- Preview text, images and PDFs; preserve files when removing resource records.
- Use a light gray, light blue and black interface with responsive cards and previews.
- Support uploads up to 20 MiB, including the fixed large-file Base64 validation.
- Preserve original Unicode display names while using bounded storage filenames.
- Include regression tests and an authenticated, restricted fixture for local DSH integration testing.

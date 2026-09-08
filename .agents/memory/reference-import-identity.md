---
name: Reference import identity
description: Why relative reimports use source-slot identity instead of names alone.
---

Treat a relative's original import position as identity, not its display name. Preserve that position even when other optional positions are empty.

**Why:** Different relatives can share a name, names can be corrected, and a later file can supply only an additional phone. Name-only matching either creates duplicates or updates the wrong person. Filtering empty form entries must not renumber the remaining people.

**How to apply:** Preserve this distinction when extending reference forms or import formats. Legacy name-based adoption is safe only for a unique match; ambiguous or unresolved nonempty reference data should produce an explicit row error, not silently discard supplied numbers.
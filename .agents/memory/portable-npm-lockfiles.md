---
name: Portable npm lockfiles
description: Prevent external deployment installers from depending on Replit-only package URLs.
---

Lockfiles intended for external builders must not contain `package-firewall.replit.local` resolved URLs. Keep package tarball URLs reachable from the target deployment environment.

**Why:** External builders cannot reach Replit's internal package firewall. npm may stall and then report an internal error such as “Exit handler never called,” obscuring the inaccessible dependency URLs.

**How to apply:** When an external npm install fails unexpectedly, inspect every lockfile `resolved` URL before changing npm versions, cache settings, or build commands. Repair private URLs without changing package versions or integrity hashes, then validate with clean `npm install` and `npm ci`.
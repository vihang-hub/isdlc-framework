# REQ-0109 — Roundtable confirmation state machine

Implement confirmation sequence as state machine: sequential presentation states (IDLE → PRESENTING_REQUIREMENTS → PRESENTING_ARCHITECTURE → PRESENTING_DESIGN → FINALIZING → COMPLETE), accept vs amend transitions, tier-dependent paths, amendment-cycle tracking, restart after amendment.

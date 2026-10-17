# Kept side by side so the Stale flag and the Flood Risk rule cannot drift apart (see Stale in CONTEXT.md).
STALE_AFTER_SECONDS = 15
# Nothing reads this until ticket 0021 makes a silent Node stop counting toward Flood Risk.
STOPS_COUNTING_AFTER_SECONDS = 60
# A Sensor following a replay track publishes this often (30 event seconds at x30), so even the
# shortest ramp in the timeline sends two readings before its Sensor goes silent.
REPLAY_PUBLISH_EVERY_SECONDS = 1

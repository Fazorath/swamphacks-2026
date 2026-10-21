# Kept side by side so the Stale flag and the Flood Risk rule cannot drift apart (see Stale in CONTEXT.md).
STALE_AFTER_SECONDS = 15
# A Node silent this long no longer counts toward Flood Risk or Community Warnings.
STOPS_COUNTING_AFTER_SECONDS = 60
# A Node silent this long is removed from the readings a snapshot lists; the registry keeps it.
DROPS_OFF_AFTER_SECONDS = 600
# While an Event plays, a Sensor publishes at least this often (30 event seconds at x30), so even the shortest ramp in
# an Event sends two readings while the water is rising.
REPLAY_PUBLISH_EVERY_SECONDS = 1

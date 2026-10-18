# 0081: Flood alert email from the Hub

**What to build:** When the Hub issues a new Community Warning during the demo, it also emails "ALERT OF FLOOD INCOMING!" to the team, through the team Gmail account (`stormshieldteam.uf@gmail.com`) over SMTP, within seconds of the warning showing on the Hub's dashboard. The email is optional: with no credentials set the Hub behaves exactly as before, and a failed send (no internet, wrong password) is logged and never delays or breaks the warning, the Mesh or the dashboard. The demo's internet cue at 09:20 comes after the first warning (08:37 Surge), so the email normally goes out while the internet is still up; after the cue it fails quietly.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** leonardorofaDV

**Assignee:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md` ("Flood alert email")

- [x] The Hub emails once per new Community Warning, not on the repeats the Hub sends every `warning_repeat_seconds`, and not again when a warning is only updated with its measured wave speed
- [x] The subject is `ALERT OF FLOOD INCOMING!`. The body names the Node that surged and its River km, the Event clock time of the Surge, says it is a Community Warning and not an official alert, and points to the dashboard and official sources. It does not order anyone to evacuate (the spec's rule)
- [x] Settings are `ALERT_EMAIL_FROM`, `ALERT_EMAIL_APP_PASSWORD` (secret) and `ALERT_EMAIL_TO` (comma-separated), read from the environment like `CARTO_API_KEY`; each is in `.env.example` with a blank value and a comment. The email is off unless all three are set
- [x] Sending runs off the thread that issues warnings, so a slow or hanging SMTP server cannot delay the warning; a failure logs the error type and the Node id, never the password or the server's reply text
- [x] Only the Hub emails; a Sensor with the same settings sends nothing
- [x] Tests (Seam A, SMTP mocked): one email per new warning with the subject and the Node, River km and time in the body; none for a repeat or a measured-speed update; none when a setting is blank; none on a Sensor; a failing send does not stop the warning from being issued and does not raise
- [x] `scripts/run-demo.sh` needs no change (it already loads `.env`); `docs/agents/lessons.md` says how to create the Gmail app password
- [x] All **Commands** pass

**Notes:** Gmail needs 2-step verification on, then an app password (Google Account → Security → App passwords); the normal password does not work for SMTP. The password lives only in `.env`. A real send was not testable without it: say so in the report and never claim it was.

**Built (2026-10-18):** `node/src/storm_shield/flood_email.py`, wired into the Hub's `warn_about_new_surges`. The tests replace `smtplib.SMTP_SSL`; **a real Gmail send was not run** because it needs the team account's app password in `.env`. After creating it (see `docs/agents/lessons.md`, "Flood alert email"), start the demo and press Start on the Hub Panel: the email should arrive within seconds of the Surge warning.

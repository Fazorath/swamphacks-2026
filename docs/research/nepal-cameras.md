# Live cameras in Nepal: which ones the demo can show

Ticket 0074. Checked on 2026-10-18 (first check, 07:37 UTC). **Result: no live camera qualifies. Every demo Node site uses a clip** (tickets 0075, 0076). No camera address is recorded in the repo, because none passed the terms.

A source qualifies only if all three hold: it needs no key we cannot keep secret, its terms allow showing it in the demo, and it stayed up. It must also work after the internet cue at 09:20, so the Node has to fetch the picture once and share it (the Cameras rule in `docs/specs/online-status-and-cameras.md`).

## Candidates

### Timure CCTV, Rasuwa (Water and Energy Commission Secretariat)

- **Address:** none published.
- **Shows:** the river and flood conditions in the Timure to Rasuwagadhi area, the exact reach the replay is about.
- **How it is read:** unknown. Gorkhapatra / Rising Nepal, 1 September 2026: "although the cameras have been installed, work is underway to manage the VSAT and communication systems to bring the system fully operational". The footage is to be "integrated with the 24-hour flood forecast and early warning service" (not stated to be public).
- **Terms:** none found.
- **Up checks:** nothing to open. Nothing newer than 1 September 2026 turned up in the 2026-10-18 searches.
- **Verdict:** does not qualify. Outreach drafted below.

### Two CCTVs on the Nepal-China border (Rasuwa)

- **Address:** none published.
- **Shows:** the lake formed after the flood. Ratopati, 31 August 2026: installation "has been started from today" by the Hydrology and Water Resources Research Center. No site is named.
- **How it is read:** unknown. The article says the cameras give "advance information to the public" but does not say anyone can watch the feed.
- **Terms:** none found.
- **Verdict:** does not qualify. Same outreach message.

### Webcam Nepal Live (YouTube, `@WEBCAMNEPAL`)

- **Address:** `https://www.youtube.com/@WEBCAMNEPAL` (public channel page; the streams are not recorded here).
- **Shows:** the 2026-10-18 stream list names Hotel Everest View (Syangboche, several views), Lukla (airport and Buddha Lodge), Namche Bazaar, Thame, Khare and Kote (Mera Peak), Lobuche, Pheriche, Annapurna Base Camp, Ghandruk, and a pond camera in London. All are in the Khumbu, Mera and Annapurna regions. **None is in the Trishuli valley and none looks at a flood river.** The channel lists no Rasuwa, Nuwakot or Betrawati site.
- **How it is read:** YouTube live streams, embed only.
- **Terms:** YouTube's Terms of Service (checked 2026-10-18) allow "show\[ing\] YouTube videos through the embeddable YouTube player" and forbid accessing, reproducing, downloading or broadcasting any part of the service by other means, and accessing it with automated tools except as YouTube allows. A Node cannot fetch a frame and share it over the Mesh without breaking that.
- **Up checks:** the channel page and its stream tab loaded (HTTP 200) and listed streams on 2026-10-18; picture age cannot be measured without playing the video.
- **Verdict:** does not qualify (wrong places, and embed-only, see below).

### iplivecams.com "Bagmati River" (Kathmandu)

- **Address:** `https://www.iplivecams.com/live-cams/bagmati-river-kathmandu-nepal/`.
- **Shows:** the Bagmati at Kathmandu, with the Bijuli Bazar arch bridge. It is a different river, in another valley from the Trishuli.
- **How it is read:** a third-party embed (`camstreamer.com/embed/...`), so only the Viewer's browser can show it.
- **Terms:** the site's Terms of Use (checked 2026-10-18) allow personal, non-commercial use and forbid copying, distributing, displaying, reproducing or reusing any image obtained from it without prior written authorisation.
- **Verdict:** does not qualify (wrong river, embed-only, terms forbid reuse).

### Aggregators (opencctv.org, geowebcams.com, earthlive.tv, webcamhopper.com)

- They list Nepal cameras (opencctv.org counts 9, mostly Kathmandu and Khumbu) but only re-publish other operators' feeds. No Trishuli, Rasuwa or Nuwakot camera appears. Not studied further because the operators behind them are the same few embed-only channels.
- **Verdict:** none qualify.

### DHM flood forecasting site (`dhm.gov.np`, `hydrology.gov.np`)

- Both answer HTTP 200 on 2026-10-18. The front pages contain no mention of "camera", "CCTV" or "webcam" and no camera links.
- **Verdict:** no camera. Bulletins only.

## YouTube and embed-only sources

- **Can the Node fetch it once and share it?** No. The Terms above forbid taking frames outside the embed player, and there is no keyless picture address to poll.
- **What it means with no internet at the Viewer:** an embed needs the Viewer's browser to reach YouTube or the embedding site, so the tile would go blank at the internet cue, which is the moment the demo needs it. The tile would behave differently from every clip tile (which goes Offline on the cue by design), so no online-only extra is used.

## Outreach

Draft, to be sent from the team address stormshieldteam.uf@gmail.com to the Centre for Hydrology and Water Resources Research and to the Water and Energy Commission Secretariat, Ministry of Energy, Water Resources and Irrigation. **Date sent: not yet sent. Answer: none.**

> Subject: May a hackathon demo show the Timure / border river cameras?
>
> Dear colleagues,
>
> We are a student team at the SwampHacks hackathon building Storm Shield, a community flood warning dashboard. We replay the 26 August 2026 Bhote Koshi flood to show how readings from river sensors can keep reaching a community over a local network when the internet is down. The demo is non-commercial and will be shown once to judges, with the source code published afterwards.
>
> Rising Nepal reported on 1 September that a real-time CCTV camera was installed at Timure, and Ratopati reported on 31 August that two cameras are being installed on the border. We would like to ask:
>
> 1. Is any of these camera feeds available to the public, and at what address and in what format?
> 2. If so, may we show it in a demo, credited to your Centre?
> 3. If not, may we say in the demo that a camera of this kind exists, without showing it?
>
> We will use only what you allow. Thank you for the work you did to keep people in the valley safe.
>
> The Storm Shield team (SwampHacks 2026), stormshieldteam.uf@gmail.com

## Decision

| Site | River km | Live source | Decision |
|---|---|---|---|
| Betrawati (Hub) | 45.6 | none found | clip |
| Timure | 3.4 | Timure CCTV: no public address | clip |
| Syabrubesi | 14.6 | none found | clip |
| Trishuli | 54.0 | none found | clip |
| Kathmandu-side and other demo sites | n/a | none in the Trishuli valley | clip |

The river km values are the spec's (Region and Nodes table in `docs/specs/flash-flood-replay.md`).

## Still open

- **Second check at least two days later.** The ticket asks for each candidate to be opened over two days or more. Today's check is the first; the verdict above cannot change from a second one for the embed-only and no-address rows, but if Timure or a border camera publishes an address, repeat the checks here before changing "clip".
- **Outreach not sent.** If a reply names a public feed, read its terms first, then add a row and re-run the qualifying test.
- Findings are from public pages and news reports; no camera's picture age was measured, because none could be opened.

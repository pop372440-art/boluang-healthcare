# Public health unit map layer

A checked “หน่วยบริการ” checkbox next to the boundary controls shows four public facility markers. Both anonymous visitors and authenticated dashboard users use the same layer. It loads during map initialization without an API request or patient session, so a failed patient sync does not hide it. Toggling it does not affect patient markers, privacy, filters, boundaries or base-map selection.

The popups show the unit name, location description, Google Maps directions and the coordinate source. Directions specify only the facility destination, never a patient coordinate or session token. The public facility count is separate from the patient count. No clinical data or new grants are exposed.

Coordinate references inspected 2026-10-23 (provider map points, not a new field survey):

| Unit | Latitude | Longitude | Source |
| --- | --- | --- | --- |
| Municipal public health department, municipal office reference | 18.1477924 | 98.3489706 | https://www.openstreetmap.org/node/3247319513 |
| Ban Na Fon | 18.09336 | 98.36518 | https://map.longdo.com/p/A00024559 |
| Ban Phui | 18.076099079 | 98.313300285 | https://map.longdo.com/p/A10308103 |
| Ban Bo Phawaen | 18.14915 | 98.35529 | https://map.longdo.com/p/A00024622 |

The municipal point is the municipal office, not a separately surveyed department entrance. Map sources can be corrected by updating the static HEALTH_UNITS records in lib/health-units.mjs; invalid numeric coordinates are skipped rather than replaced with village centroids. No live third-party geocoder or API key is required at page load. Registry names were cross-checked against MOPH HCODE pages for the three health promoting hospitals.

Validation covers public mounting, on/off restoration, independent patient layers, disabled initial state, invalid-coordinate rejection, source URL checks and popup injection safety. The existing presentation contract ignores only the newly authorized checkbox and earlier capture link; all other baseline HTML/CSS remains checked.

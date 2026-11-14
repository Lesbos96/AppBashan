---
paths:
  - "supabase/functions/route/**"
  - "supabase/functions/_shared/route/**"
  - "supabase/functions/quote/**"
  - "src/**"
---
# Karten

- Geocoding und Routing nur über die Edge Function `route` (Adapter, Anbieter austauschbar, Ergebnisse gecacht, Rate-Limit). Keine direkten Aufrufe öffentlicher OSM-Demo-Dienste aus der App.
- Wiener Stadtgrenze als PostGIS-Geometrie in der DB. Kilometer außerhalb Wiens per Geometrie-Schnitt.
- Einwilligung vor der Adressübermittlung und Bestätigung der gefundenen Adresse wie im Prototyp. Keine geschätzten Kilometer ohne berechnete Route.
- OpenStreetMap-Attribution sichtbar.

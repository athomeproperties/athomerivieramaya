# Direct booking setup (one time, about 20 minutes)

What this adds: a page for each rental at `/stay/<name>`, a calendar that reads Airbnb, a "Request to book"
form that emails you, and a calendar feed you paste into Airbnb so direct bookings block those dates there.

## 1. Upload the files to GitHub
Upload everything in this folder to the repo, keeping the folder structure
(GitHub > Add file > Upload files, then drag the folders in). New/changed files:

- `index.html` (updated: Rentals section, WhatsApp button, phone field)
- `property.html`, `properties.json`, `netlify.toml`, `package.json`, `.gitignore`
- `netlify/functions/*` (the server code)

Netlify redeploys on its own once the commit lands.

## 2. Create a free Resend account (sends you the request emails)
1. Sign up at resend.com **with athomerivieramaya@gmail.com**.
2. API Keys > Create API key. Copy it.
(Without your own domain verified, Resend only delivers to the email you signed up with, which is exactly what we need.)

## 3. Add settings in Netlify
Site configuration > Environment variables > Add. Names must match exactly:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the key from step 2 |
| `NOTIFY_EMAIL` | `athomerivieramaya@gmail.com` |
| `SITE_URL` | `https://athomerivieramaya.com` |
| `APPROVE_SECRET` | any long random text, 30+ characters (keep it private) |
| `CALENDAR_KEY` | any random text, e.g. 12 letters/numbers (goes in your Airbnb import links) |
| `ICAL_URLS` | see step 4 |

After saving, trigger a redeploy (Deploys > Trigger deploy).

## 4. Airbnb calendar -> website
For each listing: Airbnb > Calendar > Availability > Connect calendars > **Export calendar**. Copy the link.
Put all of them in `ICAL_URLS` as ONE line of JSON, using the names from `properties.json`:

    {"opal-304":"https://www.airbnb.com/calendar/ical/....ics?s=...","casa-cooper":"https://www.airbnb.com/calendar/ical/....ics?s=..."}

Keep these links in Netlify only (never in the code): anyone with a link can read that listing's calendar.
A property with no link in `ICAL_URLS` simply shows as fully open until you add it.

## 5. Website -> Airbnb
For each listing: Airbnb > Calendar > Availability > Connect calendars > **Import calendar**, paste:

    https://athomerivieramaya.com/calendar/opal-304.ics?k=YOUR_CALENDAR_KEY

(replace `opal-304` with that unit's name and `YOUR_CALENDAR_KEY` with the `CALENDAR_KEY` value).
Airbnb refreshes imported calendars every few hours, so blocks are not instant.

## 6. How a booking works day to day
1. A guest picks dates and sends the form. You get an email with their name, email, phone (WhatsApp link), dates and message. Hit Reply to answer them.
2. When you have agreed the booking with them, click **Block these dates** in the email, then confirm.
   The website calendar shows those nights as booked right away, and Airbnb picks them up on its next refresh.
3. Made a mistake or the guest cancels? The confirmation page has a "Release these dates" link.
   (If you also blocked them in Airbnb by hand, remove that block there too.)

## 7. Adding photos and details (properties.json)
Each property has `photos`, `amenities`, `airbnbUrl` and `minNights` fields. Example:

    "photos": [{"src": "https://res.cloudinary.com/.../opal1.jpg", "alt": "Living room"}],
    "amenities": {"en": ["Pool", "Air conditioning"], "es": ["Alberca", "Aire acondicionado"]},
    "airbnbUrl": "https://www.airbnb.com/rooms/123456",
    "minNights": 2

The first photo is also the card photo on the homepage. To add a new property, copy one block and give it a new
unique `slug` (that becomes its web address and its name in `ICAL_URLS` and the calendar links).

## Good to know
- Availability comes from Airbnb's calendar file, which Airbnb only refreshes every few hours. Two people can still
  request the same dates inside that window, which is why every request is a request you approve, not an instant booking.
- The form rejects dates that are already taken, so a double request for the same nights can't get through once the first one is blocked.
- Requests are also saved in Netlify Blobs (Netlify > Blobs) in case an email is ever lost.

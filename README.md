# Madam Marie Laveau Shop

A Halloween costume app for an Etsy witch. Pick a spell, then let people tap an NFC tag on the costume to watch it get cast and see the receipt.

| Page | What it's for |
| --- | --- |
| `/` | Spell form: Love, Money, New Job, Hex Someone, or a Custom Spell ($4.44 each) |
| `/cast` | The page the NFC tag opens: eerie flashing, "Bibbidi-Bobbidi-Boo, your spell has been cast", and a View Receipt button |
| `/receipt` | Receipt for the latest spell |

No dependencies. Needs Node 18+.

```bash
npm start   # http://localhost:3000
```

## Storage

Spells are saved in Supabase when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set, and in a local `latest-spell.json` file otherwise.

1. In the Supabase dashboard, open **SQL Editor** and run [`supabase.sql`](supabase.sql).
2. From **Project Settings → API**, copy the project URL and a secret key (or the legacy `service_role` key). Keep the secret key on the server only.

## Deploy on Render

1. On [render.com](https://render.com), choose **New → Blueprint** and pick this repo (it reads `render.yaml`).
2. When asked, fill in `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
3. Write `https://<your-app>.onrender.com/cast` to the NFC tag.

The free plan sleeps after 15 minutes without visits. The spell is safe in Supabase, but the first tap after a nap can take about a minute to load. To avoid that, point a free uptime monitor (for example UptimeRobot) at `https://<your-app>.onrender.com/receipt` every 5 minutes.

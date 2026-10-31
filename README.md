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

## Deploy on Render

1. On [render.com](https://render.com), choose **New → Blueprint** and pick this repo (it reads `render.yaml`).
2. Write `https://<your-app>.onrender.com/cast` to the NFC tag.

The free plan sleeps after 15 minutes without visits, and waking up clears the saved spell. Point a free uptime monitor (for example UptimeRobot) at `https://<your-app>.onrender.com/receipt` every 5 minutes to keep it awake.

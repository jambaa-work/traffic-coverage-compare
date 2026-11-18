<!--
  @file        docs/api-keys.md
  @author      jambaa
  @created     2026-11-18
  @description How to create, restrict, store and later revoke the provider API keys.
-->
# API keys

All keys are optional. Add only the providers you want to compare.

## Storing keys

```bash
cp .env.example .env.local    # fill in the keys
npm run check-keys            # one request per provider; keys are masked in the output
```

- Keep keys **only** in `.env.local`. It is git-ignored.
- Vite embeds every `VITE_*` variable in the browser bundle. Use only **public, browser-restricted** keys here,
  never secret tokens.
- Restrict every key to `localhost:5190`, the fixed dev server port.

## Short-lived keys

None of these providers offers a browser key that expires automatically after a day:

| Provider | Expiring key/token | Practical alternative |
| --- | --- | --- |
| Google | Not for API keys | Referrer restriction, quota cap, delete when done |
| TomTom | No | Domain whitelist, delete when done (free tier returns 429 instead of billing) |
| HERE | OAuth tokens last about 24 h but need a secret credential, so they are not suitable in a browser | API key, delete when done |
| Mapbox | Temporary `tk.` tokens last at most 1 h and need a secret token | URL-restricted public token, delete when done |

If you set `KEYS_CREATED_AT` in `.env.local`, `check-keys` reminds you to revoke the keys after 24 hours.

---

## 1. Google Maps (reference pane)

1. Go to https://console.cloud.google.com and create a project, for example `traffic-compare`.
2. Link a **billing account**. Maps Platform requires one, and the monthly free usage usually covers testing.
3. **APIs & Services → Library → Maps JavaScript API → Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Edit the key:
   - *Application restrictions* → **Websites** → `http://localhost:5190/*`
   - *API restrictions* → **Restrict key** → only **Maps JavaScript API**
6. (Cost protection) **Maps JavaScript API → Quotas** → lower "Map loads per day", for example to 500.
7. Put the key in `VITE_GOOGLE_MAPS_KEY`.

## 2. TomTom

1. Sign up at https://my.tomtom.com (formerly developer.tomtom.com). The freemium tier needs no card.
2. **Keys → Create key**, for example `traffic-compare`, with the **Traffic API** product.
3. **Domain whitelisting** → `localhost`.
4. Free tier: 50,000 tile requests and 2,500 non-tile requests per day. Requests above the limit return 429.
5. Put the key in `VITE_TOMTOM_KEY`.

## 3. HERE

1. Sign up at https://platform.here.com (Base/free plan).
2. **Access Manager → Apps → Register new app**, for example `traffic-compare`.
3. **Credentials → API Keys → Create API key**. An app can have up to 2 keys.
4. If available, add a **Trusted domains** restriction for `localhost`.
5. Put the key in `VITE_HERE_KEY`. The App ID is not needed.

## 4. Mapbox

1. Sign up at https://account.mapbox.com.
2. **Tokens → Create a token**, for example `traffic-compare`.
3. Keep only the default **public scopes**. Do **not** select secret scopes.
4. **URL restrictions** → `http://localhost:5190`. The default public token cannot be restricted, so create a new one.
5. Put the `pk.` token in `VITE_MAPBOX_TOKEN`.
6. Check whether Mapbox's terms allow its traffic tiles in MapLibre before any production use.

---

## Cleaning up

Order: (1) revoke keys → (2) run `npm run check-keys` and confirm every key returns 401/403 →
(3) close projects, apps or billing → (4) optionally delete accounts → (5) clean up local files.
Deleting an account cannot be undone. Stop at step 3 if you use the account for other work.

### Google Cloud

1. **APIs & Services → Credentials** → delete the key. It may keep working for about 30 minutes.
2. **Enabled APIs** → Maps JavaScript API → **Disable**.
3. If the project was created only for this test: **IAM & Admin → Settings → Shut down**. It can be restored for 30 days.
4. Close the billing account if you opened it only for this test, and remove the payment method.

### TomTom

1. **Keys** → delete the key. If the default key cannot be deleted, **Regenerate** it.
2. Remove any card you added. Deleting the account is optional; contact support if there is no delete button.

### HERE

1. **Access Manager → Apps → your app → Credentials** → delete both API keys and any OAuth credentials.
2. Disable or delete the app. Cancel any paid plan and remove payment methods.

### Mapbox

1. **Tokens** → delete your token. The default public token cannot be deleted, so **rotate** it if you used it.
2. Delete any secret (`sk.`) tokens. Check **Billing** for usage above the free tier.

### Local files

```bash
npm run check-keys   # every key should now fail
rm .env.local        # the only place the real keys were stored
rm -rf dist          # builds contain the keys
```

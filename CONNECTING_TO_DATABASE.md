# Connecting to the Render Database From Your Local PC

You have two separate needs, which use two different connection strings:

1. **Running scripts** (`seed_data.py`, one-off fixes, etc.) from your terminal
2. **Browsing/editing data visually** with a GUI tool (pgAdmin, DBeaver, TablePlus, etc.)

Both use the same **External Database URL** — the **Internal** one only works from
inside Render's own network and will fail with a "could not translate host name"
error if you try to use it locally.

---

## 1. Get the connection string

Render dashboard → your database → **Info** page → copy the **External Database URL**.
It looks like:

```
postgresql://arc_prod_db_user:SOME_PASSWORD@dpg-xxxxxxxxx-a.oregon-postgres.render.com/arc_prod_db
```

## 2. Running Python scripts locally (seeding, one-off fixes)

```cmd
cd backend
venv\Scripts\activate
set DATABASE_URL=postgresql+psycopg2://arc_prod_db_user:SOME_PASSWORD@dpg-xxxxxxxxx-a.oregon-postgres.render.com/arc_prod_db
python seed_data.py
```

**Important:** add `+psycopg2` right after `postgresql` — the URL Render gives you is
plain `postgresql://`, but SQLAlchemy (used by this backend) needs the driver name
included, or every command will fail with a confusing "connection to server at
localhost" error that has nothing to do with the real cause.

## 3. Connecting with a GUI tool (pgAdmin / DBeaver / TablePlus)

You don't need the full URL string for these — enter the pieces separately, all
visible on the same Render **Info** page:

| Field | Where to find it |
|---|---|
| Host | The part after `@` and before the next `/` or `:` in the External URL |
| Port | `5432` (shown directly on the Info page) |
| Database | Shown directly on the Info page (e.g. `arc_prod_db`) |
| Username | Shown directly on the Info page (e.g. `arc_prod_db_user`) |
| Password | Shown directly on the Info page (click the eye icon to reveal it) |
| SSL Mode | Set to **Require** — Render's Postgres requires an encrypted connection |

### pgAdmin steps
1. Right-click **Servers** → **Register** → **Server**
2. **General** tab: any name you like (e.g. "ARC Prod")
3. **Connection** tab: fill in Host/Port/Database/Username/Password from the table above
4. **Parameters** tab (or **SSL** tab depending on version): set **SSL mode** to `Require`
5. Save — you should now see all 54 tables under Databases → arc_prod_db → Schemas → public → Tables

### DBeaver steps
1. **New Database Connection** → PostgreSQL
2. Fill in Host/Port/Database/Username/Password
3. On the **SSL** tab, enable SSL and set mode to `require`
4. Test Connection → Finish

## 4. A note on Free-tier Postgres and idle connections

Render's free Postgres plan may briefly pause/reconnect on very first use after being
idle. If your very first connection attempt of the day times out, just retry once —
this is normal and not an error in your setup.

## 5. Safety reminder

This is your **live production database**. When connected via a GUI tool:
- Never run `DELETE`/`UPDATE`/`DROP` without a `WHERE` clause you've triple-checked
- Prefer read-only browsing unless you specifically intend to change data
- Consider taking a manual export/backup before any bulk edit (Render's free tier
  does not include automated backups — see the main README's "Known Gotchas" section)

# First VPS test run

This is a private smoke test using an SSH tunnel. Public HTTPS hosting comes later.
Use Docker Engine with a recent Compose v2 (additional build contexts required)
and Node 22/npm for the frontend. Commands below run on Ubuntu unless stated.

## Update the checkouts

Inside the existing Stonks clone, check `git status` before switching branches:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
cd ..
git clone git@github.com:avighnajha/stonks-simulation.git
cd Stonks
```

The private simulation repository needs GitHub authentication on the VPS. HTTPS
with an authenticated GitHub client is also fine. The two checkout directories
must be siblings named `Stonks` and `stonks-simulation`. If already cloned, update
the simulation checkout with `git -C ../stonks-simulation pull --ff-only` instead.

## Configure and start the backend

Create/edit `.env` in the Stonks root; preserve existing values if already configured.
Generate a different value with `openssl rand -hex 32` for each of these five keys:

```dotenv
JWT_SECRET=<random hex value>
INTERNAL_API_KEY=<different random hex value>
POSTGRES_PASSWORD=<different random hex value>
RESEARCH_WORKER_KEY=<different random hex value>
RESEARCH_DB_PASSWORD=<different random hex value>
```

Never commit `.env`. Hex passwords avoid URL-encoding issues. Existing database
volumes retain their original passwords; editing `.env` does not rotate them.

```sh
docker compose -f docker-compose.yml -f docker-compose.research.yml config --quiet
COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.yml -f docker-compose.research.yml build
docker compose -f docker-compose.yml -f docker-compose.research.yml up -d
docker compose -f docker-compose.yml -f docker-compose.research.yml ps
docker compose -f docker-compose.yml -f docker-compose.research.yml logs --tail=80 trading_service research_worker
```

For an empty database, the trading service runs schema migrations automatically.
The worker may be quiet until a run is queued. PostgreSQL, Redis and individual
services have no published ports; the gateway binds VPS loopback port 8080.

Run the packaged fixture without needing a browser account:

```sh
docker compose -f docker-compose.yml -f docker-compose.research.yml exec research_worker python -m stonks_sim.worker --manifest examples/smoke.json --output /tmp/smoke-result.json
docker compose -f docker-compose.yml -f docker-compose.research.yml exec research_worker python -c "import json; r=json.load(open('/tmp/smoke-result.json')); assert len(r['report']['trades']) == 1; print(r['economicHash'])"
```

## Start the frontend and open a tunnel

In another VPS terminal, from Stonks:

```sh
cd frontend
npm ci
VITE_API_URL='' npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Leave this running for the test. This development server proxies API/WebSocket
requests to the local gateway. Do not expose Vite as a public production server.

On your laptop, keep an SSH tunnel running (substitute your key path and VPS IP):

```sh
ssh -i /path/to/key -L 5173:127.0.0.1:5173 ubuntu@VPS_IP
```

Open `http://localhost:5173`. If your laptop already uses port 5173, change the
first port in `-L` to 5174 and open that address instead.

Register an account, open Research, and run a short experiment using private
assets and the idle fixture. Expect QUEUED -> RUNNING -> COMPLETED, reference
values but empty books. Idle does not trade. The packaged scripted fixture above
verifies an actual trade. Catalogue classification requires an administrator;
private experiment assets do not.

## Your Python strategies

Start with [the SDK guide](https://github.com/avighnajha/stonks-simulation/blob/main/docs/STRATEGY_GUIDE.md).
After adding a module to that checkout, add these root `.env` entries, using your names:

```dotenv
RESEARCH_STRATEGIES=my_strategy
STONKS_STRATEGY_REGISTRY={"my_strategy":"strategies.my_strategy:MyStrategy"}
```

Rebuild/recreate the research worker and recreate the trading service so both
load the new registry/allowlist:

```sh
docker compose -f docker-compose.yml -f docker-compose.research.yml up -d --build trading_service research_worker
```

Reload Research; the strategy should appear in the group selector. The worker
contains a copy of the Python checkout, so source edits need a worker rebuild.
No strategy upload or arbitrary code execution is exposed through the website.

Stop with `docker compose -f docker-compose.yml -f docker-compose.research.yml down`.
Do not add `-v` unless you intend to erase database volumes. Production reverse
proxy/TLS, backups and capacity checks are separate from this first test.

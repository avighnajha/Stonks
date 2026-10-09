# Public HTTPS

Point your domain's A record at the VPS public IP. Any AAAA record must also
reach this VPS. Allow inbound TCP 80/443 through the cloud and host firewalls.

Add `PUBLIC_DOMAIN=your.domain.example` to the root `.env` (hostname only, no
scheme or path). Caddy obtains and automatically renews a public certificate,
redirects HTTP to HTTPS, and forwards requests to the existing frontend proxy.
No certificate files or DNS-provider API token need to be copied into the repo.

```sh
sudo docker compose -f docker-compose.yml -f docker-compose.research.yml -f docker-compose.frontend.yml -f docker-compose.https.yml up -d https
sudo docker compose -f docker-compose.yml -f docker-compose.research.yml -f docker-compose.frontend.yml -f docker-compose.https.yml logs --tail=80 https
python3 deploy/check_frontend.py https://your.domain.example
```

Check that visiting `http://your.domain.example` redirects to HTTPS. Certificate
issuance may take a short time; connection timeouts during validation usually
mean DNS or firewall rules need attention. Do not repeatedly erase certificates
and retry: certificate authorities impose issuance limits.

Keep `caddy_data` and `caddy_config` volumes: they retain certificate/account state.
Do not use `down -v` for normal maintenance. Use all four Compose files in commands
that manage the whole deployment. PostgreSQL, Redis and internal service ports
stay private; the public entry point is Caddy on TCP 80/443. The existing SSH
tunnel on 5173 remains usable.

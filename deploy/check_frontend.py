"""Read-only smoke checks against the deployed frontend and gateway, no login needed."""
import base64
import json
import os
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"


def get(path, status=200):
    try:
        response = urllib.request.urlopen(base + path, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read().decode()
        assert response.status == status, (path, response.status, body[:200])
        return body, response.headers


html, _ = get("/")
assert '<div id="root"></div>' in html
scripts = re.findall(r'src="(/_static/[^\"]+\.js)"', html)
styles = re.findall(r'href="(/_static/[^\"]+\.css)"', html)
assert scripts and styles, "Missing compiled JavaScript/CSS"
for path in scripts + styles:
    _, headers = get(path)
    assert "immutable" in headers.get("Cache-Control", "")
assert get("/admin")[0] == html, "Admin page intercepted by API proxy"
get("/_static/missing.js", 404)
get("/healthz")
for path in ("/auth/me", "/research/experiments", "/admin/pending-assets"):
    body, _ = get(path, 401)
    json.loads(body)  # An API response, not the SPA fallback.
body, _ = get("/assets/approved")
json.loads(body)

# Exercise a real WebSocket upgrade through Nginx, without joining an auth namespace.
url = urllib.parse.urlsplit(base)
assert url.scheme in ("http", "https")
key = base64.b64encode(os.urandom(16)).decode()
connection = socket.create_connection((url.hostname, url.port or (443 if url.scheme == "https" else 80)), timeout=15)
if url.scheme == "https":
    connection = ssl.create_default_context().wrap_socket(connection, server_hostname=url.hostname)
with connection:
    request = (
        "GET /socket.io/?EIO=4&transport=websocket HTTP/1.1\r\n"
        f"Host: {url.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    )
    connection.sendall(request.encode())
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = connection.recv(4096)
        assert chunk, "WebSocket connection closed before upgrade"
        response += chunk
    assert response.startswith(b"HTTP/1.1 101 "), response[:200]
print("PASS: frontend, bundles, admin route, API proxy, authentication, WebSocket upgrade")

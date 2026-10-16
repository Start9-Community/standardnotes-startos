# Standard Notes Server

## Documentation

- [Standard Notes Help](https://standardnotes.com/help/*) — the upstream help center: using the apps, custom sync servers, and self-hosting.

## What you get on StartOS

A private sync server for the Standard Notes apps. It exposes one **Server API** address that the desktop and mobile apps connect to; there is no web page to open. Your encrypted notes, tags, uploaded files, and revision history are stored on your server.

## Getting set up

1. **Find this server's address.** Copy the **Server API** address from this service's page. The LAN address is served over HTTPS with your server's own root CA.
2. **Trust the certificate** on each device you connect from (see [Trusting the HTTPS certificate](#trusting-the-https-certificate) below). This is the most common cause of a "Failed to fetch" error.
3. **Point your Standard Notes app at it.** In the app's sign-in screen, open the advanced options, choose a custom sync server, and enter the address from step 1.
4. **Register your accounts.** Create each account from within the app. Your notes are encrypted on the device before they reach the server.
5. **Disable signups.** Run the **Disable Signups** task. Until you do, anyone who can reach the address can create an account on your server. The **Signups** health check stays failed while signups are open.
6. **Choose the files address** if you will upload files. Run **Set Files URL** and pick an address every device you use can reach.

Use the official desktop or mobile app. The hosted web app at app.standardnotes.com cannot connect to your server: its browser security policy only allows Standard Notes' own servers. A web app you host yourself works.

## Trusting the HTTPS certificate

The Server API LAN address uses an HTTPS certificate signed by your StartOS server's own root CA. Clients reject this certificate until they trust that CA, which shows up as **"Failed to fetch"** when you try to sign in. Download your server's root CA from StartOS (**System → Root CA**, "Download Certificate") and install it on each device you connect from.

- **Most browsers / OSes:** install the CA into the system or browser trust store.
- **Chromium / Electron on Linux** (this includes the **Standard Notes desktop app**): Chromium does not use the system CA store on Linux — it uses the NSS database. Add the CA with `certutil` (from `libnss3-tools`):

  ```sh
  certutil -d sql:"$HOME/.pki/nssdb" -A -t "C,," -n "StartOS Root CA" -i /path/to/root-ca.crt
  ```

  Fully quit and reopen the app afterward (Electron reads the trust store at startup).

- **Standard Notes installed as a snap:** snaps are confined and cannot read `~/.pki/nssdb`. Import the CA into the snap's own NSS database instead:

  ```sh
  certutil -d sql:"$HOME/snap/standard-notes/current/.pki/nssdb" -A -t "C,," \
    -n "StartOS Root CA" -i /path/to/root-ca.crt
  ```

  Note that snaps store this per revision, so the trust must be re-imported after the snap updates to a new revision.

To verify the certificate and address before touching the app:

```sh
curl --cacert /path/to/root-ca.crt https://<server-api-address>/healthcheck
```

A response with no certificate error means the server and CA are trusted; only the app's trust store remains.

## Actions

- **Disable Signups / Enable Signups:** closes or reopens registration. Existing accounts are unaffected. Reopen it briefly to add an account, then close it again.
- **Set Files URL:** chooses the address the apps send file uploads to. Pick one every device can reach — a domain or Tor address for devices away from home, not the `.local` address.
- **Activate Premium:** grants an account a premium subscription (see [Premium features](#premium-features)). Stop the service first; the action is available only while it is stopped.

## Premium features

Standard Notes' premium features (the Super editor, extra themes, nested tags, larger uploads, etc.) are gated by a **subscription role** on your account. This package can grant that role at no cost, but a limitation imposed by the **Standard Notes apps** — not by this package — restricts where it takes effect.

### The first-party host limitation

The official Standard Notes apps only honor an online subscription when connected to one of their **first-party** sync hosts, which are hardcoded in the app:

- `api.standardnotes.com`
- `sync.standardnotes.org`
- `localhost:3123`

Any other sync server — including this self-hosted one at its StartOS address or your own domain — is treated as a **third-party host**, and the apps **ignore the online subscription for premium unlocking**. Your notes still sync perfectly; only the premium editors and themes stay locked. This is a client-side design decision and cannot be changed from the server.

Because `localhost:3123` is on that list, the workaround is to make this server reachable at `https://localhost:3123` on your computer (see [Unlocking premium on desktop](#unlocking-premium-on-desktop)).

### Granting the subscription

1. Create the account in a Standard Notes app first.
2. Stop the service, run **Activate Premium**, and enter the account's email.
3. Start the service again.

The grant lasts until the year 2100 and survives restarts, updates, and backups. Running it again for the same account replaces the earlier grant. By itself it unlocks nothing in the app until the app is connected through a first-party host.

### Unlocking premium on desktop

Premium unlocks only when the desktop app reaches the server at `https://localhost:3123`. Run a local proxy on port `3123` that forwards to your server, then point the app at it. There are two ways to set up the proxy, depending on which certificate your server's address presents.

#### Option A — forward to the StartOS address (StartOS certificate)

Use this when you connect to the server's StartOS LAN/clearnet address, which serves a certificate signed by your StartOS root CA. That certificate already includes a `localhost` SAN, so a plain TCP passthrough validates once the root CA is trusted (see [Trusting the HTTPS certificate](#trusting-the-https-certificate)).

One-off (stops when the terminal closes):

```sh
socat TCP-LISTEN:3123,reuseaddr,fork TCP:<server-ip>:<server-port>
```

Persistent (Linux, systemd user service):

```sh
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/sn-tunnel.service <<'EOF'
[Unit]
Description=Standard Notes localhost:3123 tunnel to StartOS
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:3123,reuseaddr,fork TCP:<server-ip>:<server-port>
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now sn-tunnel.service
loginctl enable-linger "$USER"   # keep it running across logout/reboot
```

The drawback is that `<server-ip>:<server-port>` is the StartOS address, which can change; update the service and run `systemctl --user restart sn-tunnel.service` if it does.

#### Option B — forward to a public domain (its own TLS certificate)

Use this when you front the server with a public domain (for example `notes.example.com`) that serves its own certificate, such as Let's Encrypt. A plain passthrough fails here: the app connects to `https://localhost:3123` but is handed a certificate for the domain, so the hostname does not match. Instead, terminate TLS at the proxy — present a self-signed `localhost` certificate to the app, and have `socat` open its own TLS connection out to the domain. This is also more stable, since it does not depend on the changing StartOS LAN address.

1. Generate a self-signed `localhost` certificate (once; reuse the files on every desktop):

   ```sh
   mkdir -p ~/.config/sn-tunnel && cd ~/.config/sn-tunnel
   openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
     -keyout localhost.key -out localhost.crt \
     -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
   cat localhost.crt localhost.key > localhost.pem
   ```

2. Trust `localhost.crt` in the app's trust store (snap NSS database shown; use `~/.pki/nssdb` for a non-snap install), then fully quit and reopen the app:

   ```sh
   certutil -d sql:"$HOME/snap/standard-notes/current/.pki/nssdb" -A -t "C,," \
     -n "Local localhost proxy" -i ~/.config/sn-tunnel/localhost.crt
   ```

   This is your own `localhost` certificate, not the StartOS root CA — do not import the StartOS CA for this option.

3. Run the TLS-terminating proxy as a systemd user service (replace `<your-domain>`):

   ```sh
   mkdir -p ~/.config/systemd/user
   cat > ~/.config/systemd/user/sn-tunnel.service <<'EOF'
   [Unit]
   Description=Standard Notes localhost:3123 TLS tunnel
   After=network-online.target
   Wants=network-online.target

   [Service]
   ExecStart=/usr/bin/socat OPENSSL-LISTEN:3123,reuseaddr,fork,cert=%h/.config/sn-tunnel/localhost.pem,verify=0 OPENSSL:<your-domain>:443,verify=1
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=default.target
   EOF
   systemctl --user daemon-reload
   systemctl --user enable --now sn-tunnel.service
   loginctl enable-linger "$USER"
   ```

4. Verify the proxy (validating against your own certificate):

   ```sh
   curl --cacert ~/.config/sn-tunnel/localhost.crt https://localhost:3123/healthcheck
   ```

   An `OK` response means the proxy presents your `localhost` certificate and reaches the server.

With either option, set the desktop app's custom sync server to `https://localhost:3123`, sign out fully, and sign back in — the premium editors unlock. Sessions are bound to the address, so a session created against another address (the LAN or public domain) will not carry the unlock; sign in fresh on `localhost:3123`.

> `systemctl --user enable --now` does **not** restart an already-running service. If you change the unit file, run `systemctl --user restart sn-tunnel.service`. With a snap install, re-run the `certutil` import after each snap revision update.

### Limitations

- **Mobile and other devices:** there is no `localhost` server on a phone, so the tunnel cannot work there. Premium on the official mobile apps against a self-hosted server is not achievable.
- **Custom public domains (direct connection):** pointing the app straight at a domain such as `notes.example.com` is still a third-party host, so premium stays locked; sync works. You can, however, use that domain as the upstream for a `localhost:3123` tunnel (see **Option B** above), which does unlock premium.
- **Offline activation does not work here:** the home server's offline-features endpoint cannot identify the user in single-process mode, and the apps only accept `localhost` as an offline features host, so this path is a dead end.
- The only way to get tunnel-free premium (including on mobile) is to run a **patched Standard Notes app** that adds your host to its first-party allowlist — a separate project outside this package.

## Listing accounts

The server has no admin page or API for listing accounts. To see who has registered, SSH into your StartOS server, open a shell in the service, and query its database (read-only, safe while the server is running):

```sh
sudo start-cli package attach standardnotes-server -n standardnotes-server
cd /opt/server/packages/auth && yarn node -e 'const s=require("sqlite3");const db=new s.Database("/data/database/home_server.sqlite",s.OPEN_READONLY);db.all("SELECT u.email, u.created_at, GROUP_CONCAT(r.name) AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_uuid=u.uuid LEFT JOIN roles r ON r.uuid=ur.role_uuid GROUP BY u.uuid ORDER BY u.created_at",(e,rows)=>{if(e)throw e;console.table(rows)})'
exit
```

This prints each account's email, creation time (UTC), and roles. Every account has `CORE_USER`; accounts granted premium (see [Granting the subscription](#granting-the-subscription)) also have `PRO_USER`.

## Sessions and addresses

Session cookies issued by this server are host-only — they are bound to the exact address you connect to. If you reach the server at more than one address (for example the LAN address and a Tor or clearnet address), each address keeps its own session, so signing in on one will not carry over to another.

## Troubleshooting

- **"Failed to fetch" when signing in.** The client does not trust the server's certificate. Install the root CA on the device (see [Trusting the HTTPS certificate](#trusting-the-https-certificate)), and make sure you are using the HTTPS Server API address, not an `http://` one.
- **The app keeps asking for your password ("refresh your session").** This happens for a session created before the certificate/address was set up correctly; that session cannot be repaired. Sign out fully and sign back in to create a fresh session. Your notes are encrypted and remain safe on the server.

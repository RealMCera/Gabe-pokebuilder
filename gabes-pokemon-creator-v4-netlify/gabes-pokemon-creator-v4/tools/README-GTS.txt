GABE'S POKEMON CREATOR v6 - CUSTOM DNS GTS BRIDGE (WINDOWS)

WHAT THIS DOES
1. The website auto-legalizes a PK4/PK5 and queues it on the Render API.
2. start-custom-dns-gts.bat fetches the exact queued Pokemon by delivery code.
3. The bridge detects your Windows PC's LAN IPv4 address.
4. gts-rs starts a LOCAL DNS + fake GTS server on your PC.
5. You set your DS Primary DNS to the PC IP displayed by the bridge.
6. Enter the normal in-game GTS and the queued Pokemon is delivered.

FIRST-TIME SETUP
- Run setup-gts-rs.bat.
- It can install Git/Rust through winget (after asking), clone the current gts-rs source,
  build it, and copy gts-rs.exe into this tools folder.
- gts-rs itself is NOT bundled with Gabe's Pokemon Creator.

EACH DELIVERY
- Queue a Pokemon on the website and copy its delivery code.
- Right-click start-custom-dns-gts.bat -> Run as administrator.
  (Double-clicking also requests elevation automatically.)
- Enter the code.
- Put the displayed LAN IP into the DS connection as Primary DNS.
- Leave Secondary DNS blank or use the same IP if required.
- Enter the in-game GTS and leave the bridge window open.

NETWORK NOTES
- The DS must be able to reach the PC hosting gts-rs.
- Retail Gen IV/V Nintendo Wi-Fi uses the old DS network stack. Depending on hardware/game,
  an open or WEP-compatible Wi-Fi network may be required.
- Windows Firewall rules for gts-rs are created automatically when possible.
- If gts-rs reports an address/port already in use, another program is occupying a port it needs.

SUPPORTED GAMES
Diamond / Pearl / Platinum / HeartGold / SoulSilver
Black / White / Black 2 / White 2

UPSTREAM TRANSPORT
The local DNS/GTS transport is gts-rs (GPL-3.0), maintained at:
https://codeberg.org/bolu/gts-rs

Gabe's Pokemon Creator does not bundle or redistribute the gts-rs executable/source.

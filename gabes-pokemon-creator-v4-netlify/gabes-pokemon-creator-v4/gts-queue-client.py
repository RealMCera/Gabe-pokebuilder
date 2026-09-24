#!/usr/bin/env python3
"""Gabe's Pokémon Creator v5 queue bridge.

This helper fetches a queued .pk4/.pk5 from the hosted API, saves it locally,
and can launch an existing gts-rs installation as the Gen IV/V DNS+GTS transport.
It intentionally does not reimplement Nintendo WFC or gts-rs.
"""
from __future__ import annotations
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


def api_json(url: str, method: str = "GET"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "GabeGTSBridge/5.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
        return json.loads(raw.decode("utf-8")) if raw else None


def normalize_base(value: str) -> str:
    value = value.strip().rstrip("/")
    if value.endswith("/.netlify.app"):
        return value
    return value


def main() -> int:
    print("\nGabe's Pokémon Creator — GTS Queue Bridge v5")
    print("------------------------------------------------")
    site = input("Your Netlify site URL (example https://example.netlify.app): ").strip().rstrip("/")
    code = input("Delivery code from the website: ").strip().replace("-", "").upper()
    if not site or not code:
        print("Site URL and delivery code are required.")
        return 2

    endpoint = f"{site}/api/gts/queue/{code}"
    print(f"\nFetching delivery {code}...")
    try:
        item = api_json(endpoint)
    except urllib.error.HTTPError as ex:
        body = ex.read().decode("utf-8", "replace")
        print(f"Queue lookup failed ({ex.code}): {body}")
        return 3
    except Exception as ex:
        print(f"Could not reach the website: {ex}")
        return 3

    if item.get("status") == "delivered":
        print("This delivery is already marked delivered.")
        return 4

    out_dir = Path(__file__).resolve().parent / "Pokemon"
    out_dir.mkdir(exist_ok=True)
    filename = Path(item.get("fileName") or f"delivery-{code}.pkm").name
    path = out_dir / filename
    path.write_bytes(base64.b64decode(item["dataBase64"]))
    print(f"Saved: {path}")
    print(f"Generation: {item.get('generation')} | Game: {item.get('game')} | Pokémon: {item.get('species')}")

    candidates = [
        Path(__file__).resolve().parent / "gts-rs.exe",
        Path(__file__).resolve().parent / "gts-rs" / "gts-rs.exe",
        Path(__file__).resolve().parent / "gts-rs" / "target" / "release" / "gts-rs.exe",
    ]
    exe = next((p for p in candidates if p.exists()), None)
    if exe is None:
        print("\nThe Pokémon is queued and downloaded, but gts-rs.exe was not found.")
        print("Install/build gts-rs, then place gts-rs.exe in this tools folder.")
        print("When gts-rs asks which Pokémon to send, use this file:")
        print(path)
        return 0

    print(f"\nLaunching GTS transport: {exe}")
    print("IMPORTANT: run this bridge as Administrator so gts-rs can bind DNS/HTTP ports.")
    print("Enter the GTS on your DS. The downloaded Pokémon path will be supplied to gts-rs.")
    try:
        proc = subprocess.Popen([str(exe)], cwd=str(exe.parent), stdin=subprocess.PIPE, text=True)
        if proc.stdin:
            proc.stdin.write(str(path) + os.linesep)
            proc.stdin.flush()
        proc.wait()
    except Exception as ex:
        print(f"Could not launch gts-rs automatically: {ex}")
        print(f"Launch it manually and send: {path}")
        return 5

    answer = input("\nDid the Pokémon arrive on the DS? [y/N]: ").strip().lower()
    if answer == "y":
        try:
            api_json(f"{site}/api/gts/queue/{code}/delivered", method="POST")
            print("Delivery marked complete on the website API.")
        except Exception as ex:
            print(f"Pokémon was received, but status update failed: {ex}")
    else:
        print("Delivery remains queued until it expires, so you can retry.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

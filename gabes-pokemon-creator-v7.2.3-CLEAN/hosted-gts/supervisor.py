#!/usr/bin/env python3
import base64, json, os, pathlib, sys, time, urllib.error, urllib.request

API = os.environ['CREATOR_API_URL'].rstrip('/')
TOKEN = os.environ['GTS_BRIDGE_TOKEN']
FIFO = pathlib.Path(sys.argv[1])
POLL = int(os.getenv('GTS_POLL_SECONDS','4'))
DELIVERY_WAIT = int(os.getenv('GTS_DELIVERY_WAIT_SECONDS','25'))
OUT = pathlib.Path('/data/pokemon')
OUT.mkdir(parents=True, exist_ok=True)

def req(path, method='GET', payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    r = urllib.request.Request(API + path, data=data, method=method,
        headers={'X-GTS-Bridge-Token':TOKEN, 'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            if resp.status == 204: return None
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 204: return None
        raise

def main():
    print('[hosted-gts] bridge online; waiting for queued Pokemon', flush=True)
    while True:
        item = None
        try:
            item = req('/api/gts/bridge/next', 'POST', {})
        except Exception as e:
            print(f'[hosted-gts] queue poll error: {e}', flush=True)
            time.sleep(POLL); continue
        if not item:
            time.sleep(POLL); continue

        code = item['code']
        filename = item.get('fileName') or f'{code}.pkm'
        path = OUT / filename
        try:
            path.write_bytes(base64.b64decode(item['dataBase64']))
            print(f"[hosted-gts] staged {item.get('species')} ({code}) -> {path}", flush=True)
            # gts-rs waits for a file path on stdin when a DS enters the GTS.
            with FIFO.open('w', buffering=1) as f:
                f.write(str(path) + '\n')
            print(f'[hosted-gts] path handed to GTS server; allowing {DELIVERY_WAIT}s for transfer', flush=True)
            time.sleep(DELIVERY_WAIT)
            req(f'/api/gts/queue/{code}/delivered', 'POST', {})
            print(f'[hosted-gts] marked {code} delivered', flush=True)
        except Exception as e:
            print(f'[hosted-gts] delivery prep failed for {code}: {e}', flush=True)
            try: req(f'/api/gts/bridge/{code}/release','POST',{})
            except Exception: pass
            time.sleep(POLL)

if __name__ == '__main__': main()

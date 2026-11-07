import os
import subprocess
import time
import urllib.request
import json
import asyncio

chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
port = 9226

async def main():
    import websockets
    import http.server
    import socketserver
    import threading

    server_port = 8097
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=os.path.abspath('apps/mobile/dist'), **kwargs)

    httpd = socketserver.TCPServer(('127.0.0.1', server_port), Handler)
    t = threading.Thread(target=httpd.serve_forever)
    t.daemon = True
    t.start()

    proc = subprocess.Popen([
        chrome_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--hide-scrollbars',
        '--disable-gpu',
        'about:blank'
    ])

    await asyncio.sleep(1.5)
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
    ws_url = tabs[0]['webSocketDebuggerUrl']

    screens = ['splash', 'language', 'welcome', 'home', 'book', 'trips', 'profile', 'tools']

    async with websockets.connect(ws_url, max_size=20_000_000) as ws:
        await ws.send(json.dumps({
            'id': 1,
            'method': 'Emulation.setDeviceMetricsOverride',
            'params': {
                'width': 390,
                'height': 844,
                'deviceScaleFactor': 1,
                'mobile': True,
                'screenOrientation': {'angle': 0, 'type': 'portraitPrimary'}
            }
        }))
        await ws.recv()

        for idx, screen in enumerate(screens):
            url = f'http://127.0.0.1:{server_port}/?screen={screen}'
            await ws.send(json.dumps({
                'id': 100 + idx,
                'method': 'Page.navigate',
                'params': {'url': url}
            }))
            await ws.recv()
            await asyncio.sleep(0.9)

            await ws.send(json.dumps({
                'id': 200 + idx,
                'method': 'Runtime.evaluate',
                'params': {'expression': 'document.body.innerText'}
            }))
            eval_res = json.loads(await ws.recv())
            raw_text = eval_res.get('result', {}).get('result', {}).get('value', '')
            clean_text = ' '.join(raw_text.split())[:90]
            safe_text = clean_text.encode('ascii', 'replace').decode('ascii')
            print(f'Screen [{screen:8s}] -> {safe_text}')

            # Save screenshot
            await ws.send(json.dumps({
                'id': 300 + idx,
                'method': 'Page.captureScreenshot',
                'params': {'format': 'png'}
            }))
            shot_res = json.loads(await ws.recv())
            b64_data = shot_res.get('result', {}).get('data', '')
            if b64_data:
                import base64
                with open(os.path.join(os.path.abspath('docs/visual-qa'), f'screen_{screen}.png'), 'wb') as f:
                    f.write(base64.b64decode(b64_data))

    proc.terminate()
    httpd.shutdown()

if __name__ == '__main__':
    asyncio.run(main())

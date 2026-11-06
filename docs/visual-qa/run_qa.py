import os
import subprocess
import time
import urllib.request
import json
import base64
import asyncio
import numpy as np
from PIL import Image, ImageChops

qa_dir = os.path.abspath('docs/visual-qa')
os.makedirs(qa_dir, exist_ok=True)

chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

screens = [
    ('splash', 'WhatsApp Image 2026-11-06 at 21.26.54.jpeg'),
    ('language', 'WhatsApp Image 2026-11-06 at 21.26.54 (1).jpeg'),
    ('welcome', 'WhatsApp Image 2026-11-06 at 21.26.54 (2).jpeg'),
    ('home', 'WhatsApp Image 2026-11-06 at 21.03.02.jpeg'),
]

async def capture_all():
    import websockets
    
    # Launch Chrome with debugging port
    port = 9224
    proc = subprocess.Popen([
        chrome_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--hide-scrollbars',
        '--disable-gpu',
        'about:blank'
    ])
    
    await asyncio.sleep(2)
    try:
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
        ws_url = tabs[0]['webSocketDebuggerUrl']
        
        async with websockets.connect(ws_url, max_size=20_000_000) as ws:
            # Set exact mobile viewport 390x844
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
            
            for idx, (screen_id, ref_filename) in enumerate(screens):
                url = f'http://localhost:8089/?screen={screen_id}'
                
                # Navigate to screen
                nav_msg_id = 100 + idx * 10 + 1
                await ws.send(json.dumps({
                    'id': nav_msg_id,
                    'method': 'Page.navigate',
                    'params': {'url': url}
                }))
                await ws.recv()
                
                # Wait for load and render
                await asyncio.sleep(1.2)
                
                # Capture screenshot
                shot_msg_id = 100 + idx * 10 + 2
                await ws.send(json.dumps({
                    'id': shot_msg_id,
                    'method': 'Page.captureScreenshot',
                    'params': {'format': 'png'}
                }))
                shot_resp = json.loads(await ws.recv())
                
                data_b64 = shot_resp['result']['data']
                out_png = os.path.join(qa_dir, f'impl_{screen_id}.png')
                with open(out_png, 'wb') as f:
                    f.write(base64.b64decode(data_b64))
                    
                print(f'Captured {screen_id} (390x844 mobile viewport): exists={os.path.exists(out_png)}')
                
    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(capture_all())
    
    print('\n=== COMPARISON ===')
    for screen_id, ref_filename in screens:
        ref_path = os.path.abspath(os.path.join('docs/reference-screenshots', ref_filename))
        impl_path = os.path.join(qa_dir, f'impl_{screen_id}.png')
        
        ref_img = Image.open(ref_path).convert('RGB')
        impl_img = Image.open(impl_path).convert('RGB')
        
        target_size = ref_img.size
        impl_resized = impl_img.resize(target_size, Image.Resampling.LANCZOS)
        
        # 1. Side by side
        sbs = Image.new('RGB', (target_size[0] * 2, target_size[1]))
        sbs.paste(ref_img, (0, 0))
        sbs.paste(impl_resized, (target_size[0], 0))
        sbs.save(os.path.join(qa_dir, f'comparison_sbs_{screen_id}.png'))
        
        # 2. 50% opacity blend overlay
        overlay = Image.blend(ref_img, impl_resized, alpha=0.5)
        overlay.save(os.path.join(qa_dir, f'overlay_{screen_id}.png'))
        
        # 3. Absolute pixel difference heatmap
        diff = ImageChops.difference(ref_img, impl_resized)
        diff_arr = np.array(diff)
        mean_diff = np.mean(diff_arr)
        amplified = Image.fromarray(np.clip(diff_arr * 3, 0, 255).astype(np.uint8))
        amplified.save(os.path.join(qa_dir, f'diff_{screen_id}.png'))
        
        print(f'Screen: {screen_id:10} | Mean pixel diff (0-255): {mean_diff:.2f}')

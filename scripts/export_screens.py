import asyncio
import os
import shutil
from playwright.async_api import async_playwright

SCREENS = [
    {
        "id": "01_my_bookings",
        "title": "My Bookings - SmartTag Entry",
        "url": "http://localhost:8081/?screen=trips&booked=1"
    },
    {
        "id": "02_prepare_smarttag",
        "title": "Prepare SmartTag",
        "url": "http://localhost:8081/?screen=trips&booked=1&smarttag=prepare"
    },
    {
        "id": "03_sync_smarttag",
        "title": "Sync SmartTag",
        "url": "http://localhost:8081/?screen=trips&booked=1&smarttag=sync"
    },
    {
        "id": "04_smarttag_ready",
        "title": "SmartTag Ready",
        "url": "http://localhost:8081/?screen=trips&booked=1&smarttag=result"
    },
    {
        "id": "05_baggage_journey",
        "title": "Baggage Journey",
        "url": "http://localhost:8081/?screen=trips&booked=1&smarttag=journey&seedPreset=ARRIVED_TOKYO"
    },
    {
        "id": "06_report_issue",
        "title": "Report Baggage Issue",
        "url": "http://localhost:8081/?screen=trips&booked=1&smarttag=report"
    }
]

OUTPUT_DIR = os.path.abspath(r"D:\projects\Hack\polyaero-cathay-smarttag\exported_screens")
ARTIFACT_DIR = os.path.abspath(r"C:\Users\dqmgb\.gemini\antigravity\brain\3ff08a2e-5252-45e2-94d3-eebcb787846a")

async def capture():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # iPhone 14 dimensions: 390 x 844, 2x scale for sharp output
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        )
        page = await context.new_page()

        for screen in SCREENS:
            print(f"Capturing {screen['id']}: {screen['title']}...", flush=True)
            await page.goto(screen["url"], wait_until="domcontentloaded")
            await asyncio.sleep(1.5) # wait for fonts, layout, and images

            out_path = os.path.join(OUTPUT_DIR, f"{screen['id']}.png")
            artifact_path = os.path.join(ARTIFACT_DIR, f"{screen['id']}.png")

            await page.screenshot(path=out_path)
            shutil.copy2(out_path, artifact_path)
            print(f"Saved: {out_path}", flush=True)

        await browser.close()
    print("All screens successfully captured!", flush=True)

if __name__ == "__main__":
    asyncio.run(capture())

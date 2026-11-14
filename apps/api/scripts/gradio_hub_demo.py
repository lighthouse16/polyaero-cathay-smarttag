from pathlib import Path
import sys
import gradio as gr
import pandas as pd

API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_ROOT))

from app.services.risk_engine import ACTIVE_RISK_MODEL, FeederFlightInput

OUTBOUND_FLIGHTS = {
    "CX251 · HKG → LHR (London Heathrow · 23:55 HKT)": {
        "outbound": "CX251",
        "dest": "LHR",
        "freq_pct": 15.0,
        "feeders": [
            {"feeder_flight": "CX467", "origin": "TPE", "bags": 100, "delay": 32, "transfer": 70, "weather": 3, "congestion": 3, "hist_rate": 0.34},
            {"feeder_flight": "CX906", "origin": "MNL", "bags": 2,   "delay": 58, "transfer": 65, "weather": 4, "congestion": 4, "hist_rate": 0.48},
            {"feeder_flight": "CX509", "origin": "NRT", "bags": 45,  "delay": 5,  "transfer": 125,"weather": 1, "congestion": 2, "hist_rate": 0.14},
            {"feeder_flight": "CX712", "origin": "SIN", "bags": 38,  "delay": 24, "transfer": 72, "weather": 2, "congestion": 3, "hist_rate": 0.25},
        ],
    },
    "CX888 · HKG → YVR (Vancouver · 00:30 HKT)": {
        "outbound": "CX888",
        "dest": "YVR",
        "freq_pct": 12.0,
        "feeders": [
            {"feeder_flight": "CX714", "origin": "SIN", "bags": 68, "delay": 26, "transfer": 68, "weather": 3, "congestion": 3, "hist_rate": 0.28},
            {"feeder_flight": "CX365", "origin": "PVG", "bags": 24, "delay": 18, "transfer": 95, "weather": 2, "congestion": 4, "hist_rate": 0.31},
            {"feeder_flight": "CX407", "origin": "TPE", "bags": 15, "delay": 45, "transfer": 55, "weather": 4, "congestion": 3, "hist_rate": 0.36},
        ],
    },
    "CX548 · HKG → HND (Tokyo Haneda · 08:45 HKT)": {
        "outbound": "CX548",
        "dest": "HND",
        "freq_pct": 65.0,
        "feeders": [
            {"feeder_flight": "CX750", "origin": "BKK", "bags": 52, "delay": 21, "transfer": 65, "weather": 2, "congestion": 3, "hist_rate": 0.25},
            {"feeder_flight": "CX415", "origin": "ICN", "bags": 31, "delay": 0,  "transfer": 115,"weather": 1, "congestion": 2, "hist_rate": 0.16},
        ],
    },
}


def evaluate_feeders(
    outbound_label: str,
    f1_bags: int,
    f1_delay: int,
    f1_transfer: int,
    f1_weather: int,
    f1_congestion: int,
    f2_bags: int,
    f2_delay: int,
    f2_transfer: int,
    f2_weather: int,
):
    cfg = OUTBOUND_FLIGHTS[outbound_label]
    feeders = []
    for idx, f in enumerate(cfg["feeders"]):
        if idx == 0:
            bags, delay, transfer, weather, congestion = f1_bags, f1_delay, f1_transfer, f1_weather, f1_congestion
        elif idx == 1:
            bags, delay, transfer, weather, congestion = f2_bags, f2_delay, f2_transfer, f2_weather, f["congestion"]
        else:
            bags, delay, transfer, weather, congestion = f["bags"], f["delay"], f["transfer"], f["weather"], f["congestion"]

        feeders.append(
            FeederFlightInput(
                feeder_flight=f["feeder_flight"],
                origin=f["origin"],
                transfer_bag_count=int(bags),
                inbound_delay_mins=int(delay),
                scheduled_transfer_mins=int(transfer),
                weather_impact_score=int(weather),
                airport_congestion_index=int(congestion),
                dest_flight_frequency_pct=cfg["freq_pct"],
                historical_route_delay_rate=f["hist_rate"],
            )
        )

    ranked = ACTIVE_RISK_MODEL.rank_feeders(cfg["outbound"], feeders)

    rows = [
        [
            f"#{r.rank}",
            f"{r.feeder_flight} ({r.origin} → HKG)",
            r.transfer_bag_count,
            f"{r.risk_score}%",
            r.expected_missed_bags,
            r.priority_index,
            f"{r.effective_buffer_mins} min",
            r.recommended_action,
        ]
        for r in ranked
    ]

    df = pd.DataFrame(
        rows,
        columns=[
            "Rank",
            "Inbound Feeder",
            "Bags",
            "Miss Risk",
            "Exp. Missed",
            "Priority Index",
            "Buffer",
            "Recommended Action",
        ],
    )

    top = ranked[0]
    summary = (
        f"**Model:** `{ACTIVE_RISK_MODEL.model_version}` (ROC-AUC `0.963` · MAE `3.2 min`) &nbsp;|&nbsp; "
        f"**Top Priority (#1):** **{top.feeder_flight} ({top.origin}→HKG)** — "
        f"**{top.transfer_bag_count} bags** @ **{top.risk_score}% risk** "
        f"(Priority Index **{top.priority_index}**) → **{top.recommended_action}**"
    )
    return summary, df


def on_select_outbound(outbound_label: str):
    cfg = OUTBOUND_FLIGHTS[outbound_label]
    f1, f2 = cfg["feeders"][0], cfg["feeders"][1]
    summary, df = evaluate_feeders(
        outbound_label,
        f1["bags"], f1["delay"], f1["transfer"], f1["weather"], f1["congestion"],
        f2["bags"], f2["delay"], f2["transfer"], f2["weather"],
    )
    return (
        f1["bags"], f1["delay"], f1["transfer"], f1["weather"], f1["congestion"],
        f2["bags"], f2["delay"], f2["transfer"], f2["weather"],
        summary, df,
    )


theme = gr.themes.Soft(primary_hue="teal", neutral_hue="slate")

with gr.Blocks(theme=theme, title="Cathay Pacific · HKG Hub Feeder Priority") as demo:
    gr.Markdown("## Cathay Pacific · HKG Hub Baggage Risk & Feeder Priority")

    outbound_dd = gr.Dropdown(
        choices=list(OUTBOUND_FLIGHTS.keys()),
        value=list(OUTBOUND_FLIGHTS.keys())[0],
        label="Outbound Flight Departing Hong Kong (HKG)",
    )

    summary_md = gr.Markdown()
    feeder_table = gr.Dataframe(interactive=False, wrap=True, label="Ranked Inbound Feeder Flights")

    with gr.Row():
        with gr.Column():
            gr.Markdown("**Feeder #1 (High-Volume Widebody)**")
            f1_bags = gr.Slider(1, 180, value=100, step=1, label="Connecting Bags")
            f1_delay = gr.Slider(-10, 120, value=32, step=1, label="Inbound Delay (mins)")
            f1_transfer = gr.Slider(35, 180, value=70, step=5, label="Transfer Window (mins)")
            f1_weather = gr.Slider(1, 5, value=3, step=1, label="Weather Severity (1–5)")
            f1_congestion = gr.Slider(1, 5, value=3, step=1, label="HKG Congestion (1–5)")

        with gr.Column():
            gr.Markdown("**Feeder #2 (Low-Volume Delayed Flight)**")
            f2_bags = gr.Slider(1, 180, value=2, step=1, label="Connecting Bags")
            f2_delay = gr.Slider(-10, 120, value=58, step=1, label="Inbound Delay (mins)")
            f2_transfer = gr.Slider(35, 180, value=65, step=5, label="Transfer Window (mins)")
            f2_weather = gr.Slider(1, 5, value=4, step=1, label="Weather Severity (1–5)")

    inputs = [outbound_dd, f1_bags, f1_delay, f1_transfer, f1_weather, f1_congestion, f2_bags, f2_delay, f2_transfer, f2_weather]
    outputs = [summary_md, feeder_table]

    demo.load(fn=evaluate_feeders, inputs=inputs, outputs=outputs)
    for ctrl in [f1_bags, f1_delay, f1_transfer, f1_weather, f1_congestion, f2_bags, f2_delay, f2_transfer, f2_weather]:
        ctrl.change(fn=evaluate_feeders, inputs=inputs, outputs=outputs)

    outbound_dd.change(
        fn=on_select_outbound,
        inputs=[outbound_dd],
        outputs=[f1_bags, f1_delay, f1_transfer, f1_weather, f1_congestion, f2_bags, f2_delay, f2_transfer, f2_weather, summary_md, feeder_table],
    )


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=True)

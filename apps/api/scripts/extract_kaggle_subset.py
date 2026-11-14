from pathlib import Path
import duckdb
import kagglehub

DATASET_HANDLE = "hrishitpatil/flight-data-2024"
OUTPUT_CSV = Path(__file__).resolve().parent.parent / "data" / "flight_risk_subset.csv"


def main():
    print(f"Locating Kaggle dataset: {DATASET_HANDLE} ...")
    dataset_dir = Path(kagglehub.dataset_download(DATASET_HANDLE))

    # Pick flight_data_2024.csv explicitly (skip data_dictionary.csv and sample.csv)
    target_csv = dataset_dir / "flight_data_2024.csv"
    if not target_csv.exists():
        candidates = [
            f for f in dataset_dir.rglob("*.csv")
            if "dictionary" not in f.name.lower() and "sample" not in f.name.lower()
        ]
        if not candidates:
            raise FileNotFoundError(f"Main flight CSV not found in {dataset_dir}")
        target_csv = max(candidates, key=lambda p: p.stat().st_size)

    source_csv = str(target_csv)
    print(f"Reading main dataset: {source_csv}")

    query = f"""
    SELECT
        origin,
        dest,
        crs_dep_time,
        crs_elapsed_time,
        actual_elapsed_time,
        arr_delay,
        taxi_in,
        COALESCE(weather_delay, 0)       AS weather_delay,
        COALESCE(nas_delay, 0)           AS nas_delay,
        COALESCE(late_aircraft_delay, 0) AS late_aircraft_delay
    FROM read_csv_auto('{source_csv}')
    WHERE cancelled = 0
      AND arr_delay IS NOT NULL
      AND taxi_in IS NOT NULL
      AND actual_elapsed_time IS NOT NULL
    USING SAMPLE 150000 ROWS
    """

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    duckdb.sql(f"COPY ({query}) TO '{OUTPUT_CSV}' (HEADER, DELIMITER ',')")
    print(f"Saved clean 150k-row subset -> {OUTPUT_CSV}")


if __name__ == "__main__":
    main()

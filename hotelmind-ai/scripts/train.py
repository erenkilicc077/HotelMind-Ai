"""Train baselines on a real or synthetic Hotel Booking Demand CSV."""
import argparse
import json

from hotelmind.config import ARTIFACT_DIR
from hotelmind.training import train_and_evaluate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/raw/hotel_bookings.csv")
    parser.add_argument("--output-dir", default=str(ARTIFACT_DIR))
    args = parser.parse_args()
    report = train_and_evaluate(args.data, args.output_dir)
    print(json.dumps({
        "selected_model": report["selected_model"],
        "holdout_test_metrics": report["holdout_test_metrics"],
        "split_counts": report["split_counts"],
    }, indent=2))
    print(f"Artifacts stored in {args.output_dir}")


if __name__ == "__main__":
    main()

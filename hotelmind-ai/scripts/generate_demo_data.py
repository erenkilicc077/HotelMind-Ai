"""Generate fake hotel bookings, without downloading real customer data."""
import argparse
from pathlib import Path

from hotelmind.demo import generate_demo_data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/demo/demo_bookings.csv")
    parser.add_argument("--rows", type=int, default=1800)
    args = parser.parse_args()
    frame = generate_demo_data(Path(args.output), args.rows)
    print(f"Generated {len(frame):,} synthetic rows in {args.output}")
    print("NOTE: This dataset is artificial; do not publish its metrics as real performance.")


if __name__ == "__main__":
    main()

"""Download the attributed public dataset and verify this release's bytes."""
import argparse
import hashlib
from pathlib import Path
from urllib.request import urlopen
from hotelmind.config import PROJECT_ROOT

URL='https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv'
SHA256='7c2ae42a7353905ea136e5c2287f17c92c5435826598bfbb8491c6f0c7b1fc06'


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=PROJECT_ROOT/'data/raw/hotel_bookings.csv');args=parser.parse_args()
    if args.output.exists():
        if hashlib.sha256(args.output.read_bytes()).hexdigest()==SHA256:
            print(f'Verified existing dataset: {args.output}');return
        raise SystemExit('An existing file has different bytes. Choose another --output; it was not overwritten.')
    print('Downloading the public Hotel Booking Demand CSV…',flush=True)
    with urlopen(URL,timeout=60) as response:data=response.read()
    if hashlib.sha256(data).hexdigest()!=SHA256:
        raise SystemExit('Dataset checksum changed. Review the source before using it; no file was written.')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    temporary=args.output.with_suffix('.csv.download');temporary.write_bytes(data);temporary.replace(args.output)
    print(f'Saved {len(data):,} verified bytes: {args.output}')

if __name__=='__main__':main()

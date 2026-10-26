# Dataset provenance

- Research: Antonio, N., de Almeida, A., & Nunes, L. (2019), *Hotel booking demand datasets*, Data in Brief 22, 41–49. DOI: https://doi.org/10.1016/j.dib.2018.11.126
- Original study: one city hotel and one resort hotel in Portugal, arrivals 2015-07-01 through 2017-08-31; 119,390 rows in the combined CSV.
- Downloaded CSV mirror: https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv
- Mirror context: https://github.com/rfordatascience/tidytuesday/tree/master/data/2020/2020-02-11
- SHA-256: `7c2ae42a7353905ea136e5c2287f17c92c5435826598bfbb8491c6f0c7b1fc06`
- Size: 16,855,599 bytes; 32 columns.

Third-party data is attributed to its original authors and remains subject to source terms. The MIT license of HotelMind applies to its original code, not a new license grant over the dataset.

The release ZIP includes `raw/hotel_bookings.csv` for reproduction; it is excluded from Git. Run `scripts/download_data.py` to retrieve and checksum the same file. `demo/` is reserved for synthetic testing and must not be used to support real-customer performance claims.

Filtering excludes rows with no guests, no nights, or a negative ADR. Four missing child counts remain eligible and are imputed inside fitted training pipelines. Obvious post-outcome fields and personal identifiers are not model inputs. History features and ADR may still reflect extraction-time snapshots; consult the methodological limitations.


# CMIP6 → D3 Starter Kit

This package contains:
- **Placeholder CSVs** (in `data/`) so you can preview each visualization with D3 immediately.
- **D3 code** (in `js/`) and simple HTML pages for **five** visualizations:
  1) Warming Stripes (annual anomalies)
  2) Climate Spiral (monthly anomalies, radial)
  3) Seasonality by Decade (overlaid monthly curves)
  4) Mean vs Variance by Decade (scatter)
  5) Milestone Monitor (rolling mean vs threshold)

Replace the placeholder CSVs with your **exported CMIP6-derived CSVs** using the same column names.

## Quick Preview Locally
```bash
cd cmip6_d3_starter
python -m http.server 8000
# Visit http://localhost:8000 in your browser
```

## Exporting CSVs in your Jupyter Notebook (Xarray)

> Run your existing cells that create:
> - `ta_timeseries` (global monthly mean near-surface air temperature, in °C)
> - (Optional) You can also compute from `ds.tas` and `areacella` as in your notebook

**Start here: define helpers**

```python
import numpy as np
import pandas as pd
import xarray as xr

def to_monthly_df(ta_timeseries):
    """Convert to a tidy DataFrame with columns: time, temp_c, year, month"""
    da = ta_timeseries.rename("temp_c")
    df = da.to_series().reset_index()
    df["year"] = df["time"].dt.year
    df["month"] = df["time"].dt.month
    return df

def pick_baseline(df, start=1850, end=1900):
    """Pick baseline period; if not available, fall back to 1961-1990."""
    base = df[(df["year"] >= start) & (df["year"] <= end)]
    if base.empty:
        base = df[(df["year"] >= 1961) & (df["year"] <= 1990)]
    return base

def monthly_anomaly(df, base_start=1850, base_end=1900):
    """Compute monthly anomaly using month-wise baseline means."""
    base = pick_baseline(df, base_start, base_end)
    clim = base.groupby("month")["temp_c"].mean().rename("clim_c").reset_index()
    out = df.merge(clim, on="month", how="left")
    out["anom_c"] = out["temp_c"] - out["clim_c"]
    return out

def annual_from_monthly(df):
    """Annual mean from monthly temp or anomalies; expects 'year' and a value column."""
    # If both temp_c and anom_c exist, prefer anom_c for stripes/milestone
    val_col = "anom_c" if "anom_c" in df.columns else "temp_c"
    annual = (df.groupby("year")[val_col].mean().rename(val_col).reset_index())
    return annual

def add_decade_label(year):
    return int(year // 10 * 10)

def rolling_mean_annual(annual_df, window=11, col="anom_c"):
    """Centered rolling mean on annual anomalies; min_periods to avoid NaNs at edges."""
    out = annual_df.copy()
    out[f"roll{window}_{col}"] = out[col].rolling(window=window, min_periods=window//2).mean()
    return out
```

**Compute anomalies and export CSVs**

```python
# df_m: tidy monthly dataframe from ta_timeseries
df_m = to_monthly_df(ta_timeseries)

# 1) Monthly anomalies (for spiral / seasonality / milestone):
df_ma = monthly_anomaly(df_m, base_start=1850, base_end=1900)

# 2) Annual anomalies (for stripes / milestone):
annual_anom = annual_from_monthly(df_ma)  # columns: year, anom_c

# 3) Seasonality by decade (monthly means per decade):
tmp = df_ma.copy()
tmp["decade"] = tmp["year"].apply(add_decade_label)
seasonality_dec = tmp.groupby(["decade","month"])["anom_c"].mean().reset_index()  # use anomalies

# 4) Mean-Variance by decade:
mv_dec = tmp.groupby("decade")["anom_c"].agg(mean_c="mean", std_c="std").reset_index()

# 5) Rolling-mean milestone series (11-year window is common):
annual_roll = rolling_mean_annual(annual_anom, window=11, col="anom_c")

# --- Save to CSV (adjust paths as you like) ---
import os; os.makedirs("export", exist_ok=True)
annual_anom.to_csv("export/stripes.csv", index=False)  # columns: year, anom_c
df_ma[["year","month","anom_c"]].to_csv("export/spiral_monthly_anom.csv", index=False)
seasonality_dec.to_csv("export/decade_monthly.csv", index=False)
mv_dec.to_csv("export/meanvar_by_decade.csv", index=False)
annual_roll[["year","roll11_anom_c"]].rename(columns={"roll11_anom_c":"rolling11_anom_c"}).to_csv("export/milestone.csv", index=False)
```

> Tip: If your `ta_timeseries` is in Kelvin, convert to Celsius first: `ta_timeseries - 273.15`

## D3 Column Schemas Expected
- **Stripes**: `year, anom_c`
- **Spiral**: `year, month, anom_c`
- **Seasonality**: `decade, month, anom_c`
- **Mean-Variance**: `decade, mean_c, std_c`
- **Milestone**: `year, rolling11_anom_c`

## GitHub Pages
Push this folder to a GitHub repo and enable Pages → main branch `/`.
Make sure your CSV paths match the repo structure.

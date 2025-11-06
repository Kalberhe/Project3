# CMIP6 Data Preprocessing Pipeline

## Overview

`cmip6-zarr-consolidated-stores.csv` is a **metadata catalog** for CMIP6 data sources, not the actual data. This catalog is used to locate and load actual data from Google Cloud Storage, then preprocess it to generate CSV files for D3 visualizations.

## Complete Process

### Step 1: Locate Data Sources from Catalog

```python
# Read CSV catalog
df = pd.read_csv('cmip6-zarr-consolidated-stores.csv')

# Find monthly surface air temperature (tas) data
df_ta = df.query("activity_id=='CMIP' & table_id == 'Amon' & variable_id == 'tas' & experiment_id == 'historical'")

# Filter for NCAR models
df_ta_ncar = df_ta.query('institution_id == "NCAR"')
```

**Result**: Finds the `zstore` path for the dataset to use from the catalog.

### Step 2: Load Actual Data from Google Cloud Storage

```python
# Connect to GCS filesystem
gcs = gcsfs.GCSFileSystem(token='anon')

# Load temperature data
zstore = df_ta_ncar.zstore.values[-1]
mapper = gcs.get_mapper(zstore)
ds = xr.open_zarr(mapper, consolidated=True)  # ds.tas: 3D array (time, lat, lon)

# Load area weighting data
df_area = df.query("variable_id == 'areacella' & source_id == 'CESM2'")
ds_area = xr.open_zarr(gcs.get_mapper(df_area.zstore.values[0]), consolidated=True)
```

**Result**: 
- `ds.tas`: Global monthly temperature data (3D: time × lat × lon)
- `ds_area.areacella`: Area of each grid cell (2D: lat × lon)

### Step 3: Compute Global-Average Temperature Time Series

```python
# Calculate area-weighted mean
total_area = ds_area.areacella.sum(dim=['lon', 'lat'])
ta_timeseries = (ds.tas * ds_area.areacella).sum(dim=['lon', 'lat']) / total_area
```

**Result**: `ta_timeseries` - Global monthly mean temperature (1D: time only)

**Explanation**: 
- Computes area-weighted average of temperature at each grid point
- Grid cells at higher latitudes have smaller areas, so area weighting is necessary

### Step 4: Convert to Monthly DataFrame

```python
def to_monthly_df(ta_timeseries):
    # Convert Kelvin → Celsius (if mean > 100, assume Kelvin)
    if ta_timeseries.values.mean() > 100:
        ta_timeseries = ta_timeseries - 273.15
    
    # Convert xarray → pandas
    df = ta_timeseries.to_series().reset_index()
    df["year"] = df["time"].dt.year
    df["month"] = df["time"].dt.month
    return df

df_m = to_monthly_df(ta_timeseries)
```

**Result**: `df_m` - Columns: `time`, `temp_c`, `year`, `month`

**Example**:
```
         time    temp_c  year  month
0  1850-01-01    14.25  1850      1
1  1850-02-01    14.12  1850      2
...
```

### Step 5: Compute Monthly Anomalies

```python
def monthly_anomaly(df, base_start=1850, base_end=1900):
    # Select baseline climate period
    base = df[(df["year"] >= base_start) & (df["year"] <= base_end)]
    if base.empty:
        base = df[(df["year"] >= 1961) & (df["year"] <= 1990)]  # Fallback
    
    # Compute monthly baseline climatology (Jan mean, Feb mean, ...)
    clim = base.groupby("month")["temp_c"].mean()  # 12 values (Jan~Dec)
    
    # Merge baseline climatology with each data point
    out = df.merge(clim, on="month", how="left")
    out["anom_c"] = out["temp_c"] - out["clim_c"]  # Anomaly = current - baseline
    return out

df_ma = monthly_anomaly(df_m, base_start=1850, base_end=1900)
```

**Result**: `df_ma` - Columns: `time`, `temp_c`, `year`, `month`, `clim_c`, `anom_c`

**Explanation**:
- Anomaly = current temperature - baseline climatology for that month
- Example: Jan 2020 anomaly = Jan 2020 temp - (mean of all Jan temps from 1850-1900)

### Step 6: Generate CSV Files

#### 6-1. stripes.csv (Annual Anomalies)

```python
def annual_from_monthly(df):
    # Average monthly data by year
    annual = df.groupby("year")["anom_c"].mean().reset_index()
    return annual

annual_anom = annual_from_monthly(df_ma)
annual_anom.to_csv("cmip6_d3_starter/data/stripes.csv", index=False)
```

**Result**: `year`, `anom_c` columns

**Example**:
```
year,anom_c
1900,0.176
1901,0.050
...
```

#### 6-2. spiral_monthly_anom.csv (Monthly Anomalies)

```python
df_ma[["year","month","anom_c"]].to_csv("cmip6_d3_starter/data/spiral_monthly_anom.csv", index=False)
```

**Result**: `year`, `month`, `anom_c` columns

**Usage**: Display monthly anomalies radially in spiral chart

#### 6-3. decade_monthly.csv (Decade × Month Mean Anomalies)

```python
def add_decade_label(year):
    return int(year // 10 * 10)  # 1995 → 1990, 2003 → 2000

tmp = df_ma.copy()
tmp["decade"] = tmp["year"].apply(add_decade_label)
seasonality_dec = tmp.groupby(["decade","month"])["anom_c"].mean().reset_index()
seasonality_dec.to_csv("cmip6_d3_starter/data/decade_monthly.csv", index=False)
```

**Result**: `decade`, `month`, `anom_c` columns

**Example**:
```
decade,month,anom_c
1960,1,0.024
1960,2,0.139
...
```

**Explanation**: Mean anomaly for each month of each decade (e.g., mean Jan anomaly for 1960s)

#### 6-4. meanvar_by_decade.csv (Decade Mean and Standard Deviation)

```python
mv_dec = tmp.groupby("decade")["anom_c"].agg(mean_c="mean", std_c="std").reset_index()
mv_dec.to_csv("cmip6_d3_starter/data/meanvar_by_decade.csv", index=False)
```

**Result**: `decade`, `mean_c`, `std_c` columns

**Example**:
```
decade,mean_c,std_c
1960,0.045,0.123
1970,0.078,0.145
...
```

**Explanation**: Overall mean anomaly and variability (standard deviation) for each decade

#### 6-5. milestone.csv (11-Year Rolling Mean)

```python
def rolling_mean_annual(annual_df, window=11, col="anom_c"):
    out = annual_df.copy()
    out[f"roll{window}_{col}"] = out[col].rolling(window=window, min_periods=window//2).mean()
    return out

annual_roll = rolling_mean_annual(annual_anom, window=11, col="anom_c")
annual_roll[["year","roll11_anom_c"]].rename(columns={"roll11_anom_c":"rolling11_anom_c"}).to_csv(
    "cmip6_d3_starter/data/milestone.csv", index=False
)
```

**Result**: `year`, `rolling11_anom_c` columns

**Explanation**: 11-year centered rolling mean of annual anomalies (smooths year-to-year variability, highlights long-term trends)

## Data Flow Summary

```
cmip6-zarr-consolidated-stores.csv (catalog)
    ↓
Load actual data from Google Cloud Storage
    ↓
Compute global area-weighted mean → ta_timeseries
    ↓
Convert to monthly dataframe → df_m (temp_c, year, month)
    ↓
Compute monthly anomalies → df_ma (adds anom_c)
    ↓
┌─────────────────────────────────────────┐
│  Various aggregations and transformations│
├─────────────────────────────────────────┤
│ • Annual mean → annual_anom → stripes.csv│
│ • Monthly data → spiral_monthly_anom.csv │
│ • Decade×Month → decade_monthly.csv     │
│ • Decade statistics → meanvar_by_decade.csv│
│ • 11-year rolling → milestone.csv        │
└─────────────────────────────────────────┘
```

## Key Concepts Explained

### 1. Area-Weighted Mean
- Earth is a sphere, so grid cells at higher latitudes have smaller areas
- Instead of simple average, we weight by area to reflect actual surface area

### 2. Anomaly
- Uses deviation from baseline period rather than absolute temperature
- Baseline climate: 1850-1900 (falls back to 1961-1990 if unavailable)
- Advantage: Shows trends more clearly than absolute values

### 3. Monthly Baseline Climatology
- Considers seasonality by computing separate baseline values for each month
- Example: Jan anomaly = Jan temperature - Jan baseline

### 4. Rolling Mean
- 11-year moving average smooths year-to-year variability to highlight long-term trends

## Notes

- **Data Size**: Original data is a 3D array (time × lat × lon), but after aggregation, it's compressed into small CSV files
- **Lazy Loading**: Xarray uses lazy evaluation by default, so actual computation doesn't occur until `.load()` is called
- **Temperature Units**: CMIP6 data is typically stored in Kelvin (K), so conversion to Celsius (°C) is necessary



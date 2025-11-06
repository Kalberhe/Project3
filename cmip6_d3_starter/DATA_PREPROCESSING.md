# CMIP6 데이터 전처리 과정 설명

## 개요

`cmip6-zarr-consolidated-stores.csv`는 CMIP6 데이터 카탈로그로, 실제 데이터가 아닌 **데이터 소스의 메타데이터**입니다. 이 카탈로그를 사용해서 실제 데이터를 Google Cloud Storage에서 로드하고, 전처리하여 D3 시각화용 CSV 파일들을 생성합니다.

## 전체 프로세스

### 1단계: 카탈로그에서 데이터 소스 찾기

```python
# CSV 카탈로그 읽기
df = pd.read_csv('cmip6-zarr-consolidated-stores.csv')

# 월별 지표 온도(tas) 데이터 찾기
df_ta = df.query("activity_id=='CMIP' & table_id == 'Amon' & variable_id == 'tas' & experiment_id == 'historical'")

# NCAR 모델 필터링
df_ta_ncar = df_ta.query('institution_id == "NCAR"')
```

**결과**: 카탈로그에서 사용할 데이터셋의 `zstore` 경로를 찾습니다.

### 2단계: Google Cloud Storage에서 실제 데이터 로드

```python
# GCS 파일시스템 연결
gcs = gcsfs.GCSFileSystem(token='anon')

# 온도 데이터 로드
zstore = df_ta_ncar.zstore.values[-1]
mapper = gcs.get_mapper(zstore)
ds = xr.open_zarr(mapper, consolidated=True)  # ds.tas: 3D 배열 (time, lat, lon)

# 면적 가중치 데이터 로드
df_area = df.query("variable_id == 'areacella' & source_id == 'CESM2'")
ds_area = xr.open_zarr(gcs.get_mapper(df_area.zstore.values[0]), consolidated=True)
```

**결과**: 
- `ds.tas`: 전지구 월별 온도 데이터 (3D: time × lat × lon)
- `ds_area.areacella`: 각 그리드 셀의 면적 (2D: lat × lon)

### 3단계: 전지구 평균 온도 시계열 계산

```python
# 면적 가중 평균 계산
total_area = ds_area.areacella.sum(dim=['lon', 'lat'])
ta_timeseries = (ds.tas * ds_area.areacella).sum(dim=['lon', 'lat']) / total_area
```

**결과**: `ta_timeseries` - 전지구 월별 평균 온도 (1D: time만)

**설명**: 
- 각 그리드 포인트의 온도를 면적으로 가중 평균
- 위도가 높을수록 그리드 셀 면적이 작으므로 면적 가중치 필요

### 4단계: 월별 데이터프레임으로 변환

```python
def to_monthly_df(ta_timeseries):
    # 켈빈 → 섭씨 변환 (평균이 100보다 크면 켈빈으로 판단)
    if ta_timeseries.values.mean() > 100:
        ta_timeseries = ta_timeseries - 273.15
    
    # xarray → pandas 변환
    df = ta_timeseries.to_series().reset_index()
    df["year"] = df["time"].dt.year
    df["month"] = df["time"].dt.month
    return df

df_m = to_monthly_df(ta_timeseries)
```

**결과**: `df_m` - 컬럼: `time`, `temp_c`, `year`, `month`

**예시**:
```
         time    temp_c  year  month
0  1850-01-01    14.25  1850      1
1  1850-02-01    14.12  1850      2
...
```

### 5단계: 월별 이상값(Anomaly) 계산

```python
def monthly_anomaly(df, base_start=1850, base_end=1900):
    # 기준 기후(baseline) 선택
    base = df[(df["year"] >= base_start) & (df["year"] <= base_end)]
    if base.empty:
        base = df[(df["year"] >= 1961) & (df["year"] <= 1990)]  # 폴백
    
    # 월별 기준 기후 평균 계산 (1월 평균, 2월 평균, ...)
    clim = base.groupby("month")["temp_c"].mean()  # 12개 값 (1월~12월)
    
    # 각 데이터 포인트에 해당 월의 기준 기후 평균 병합
    out = df.merge(clim, on="month", how="left")
    out["anom_c"] = out["temp_c"] - out["clim_c"]  # 이상값 = 현재값 - 기준값
    return out

df_ma = monthly_anomaly(df_m, base_start=1850, base_end=1900)
```

**결과**: `df_ma` - 컬럼: `time`, `temp_c`, `year`, `month`, `clim_c`, `anom_c`

**설명**:
- 이상값(anomaly) = 현재 온도 - 해당 월의 기준 기후 평균
- 예: 2020년 1월 이상값 = 2020년 1월 온도 - (1850-1900년 모든 1월의 평균)

### 6단계: 각 CSV 파일 생성

#### 6-1. stripes.csv (연간 이상값)

```python
def annual_from_monthly(df):
    # 월별 데이터를 연도별로 평균
    annual = df.groupby("year")["anom_c"].mean().reset_index()
    return annual

annual_anom = annual_from_monthly(df_ma)
annual_anom.to_csv("cmip6_d3_starter/data/stripes.csv", index=False)
```

**결과**: `year`, `anom_c` 컬럼

**예시**:
```
year,anom_c
1900,0.176
1901,0.050
...
```

#### 6-2. spiral_monthly_anom.csv (월별 이상값)

```python
df_ma[["year","month","anom_c"]].to_csv("cmip6_d3_starter/data/spiral_monthly_anom.csv", index=False)
```

**결과**: `year`, `month`, `anom_c` 컬럼

**용도**: 스파이럴 차트에서 월별 이상값을 방사형으로 표시

#### 6-3. decade_monthly.csv (10년대별 월별 평균 이상값)

```python
def add_decade_label(year):
    return int(year // 10 * 10)  # 1995 → 1990, 2003 → 2000

tmp = df_ma.copy()
tmp["decade"] = tmp["year"].apply(add_decade_label)
seasonality_dec = tmp.groupby(["decade","month"])["anom_c"].mean().reset_index()
seasonality_dec.to_csv("cmip6_d3_starter/data/decade_monthly.csv", index=False)
```

**결과**: `decade`, `month`, `anom_c` 컬럼

**예시**:
```
decade,month,anom_c
1960,1,0.024
1960,2,0.139
...
```

**설명**: 각 10년대의 각 월별 평균 이상값 (예: 1960년대의 1월 평균 이상값)

#### 6-4. meanvar_by_decade.csv (10년대별 평균과 표준편차)

```python
mv_dec = tmp.groupby("decade")["anom_c"].agg(mean_c="mean", std_c="std").reset_index()
mv_dec.to_csv("cmip6_d3_starter/data/meanvar_by_decade.csv", index=False)
```

**결과**: `decade`, `mean_c`, `std_c` 컬럼

**예시**:
```
decade,mean_c,std_c
1960,0.045,0.123
1970,0.078,0.145
...
```

**설명**: 각 10년대의 전체 평균 이상값과 변동성(표준편차)

#### 6-5. milestone.csv (11년 롤링 평균)

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

**결과**: `year`, `rolling11_anom_c` 컬럼

**설명**: 연간 이상값의 11년 중심 이동평균 (노이즈 제거, 장기 추세 파악)

## 데이터 흐름 요약

```
cmip6-zarr-consolidated-stores.csv (카탈로그)
    ↓
Google Cloud Storage에서 실제 데이터 로드
    ↓
전지구 면적 가중 평균 계산 → ta_timeseries
    ↓
월별 데이터프레임 변환 → df_m (temp_c, year, month)
    ↓
월별 이상값 계산 → df_ma (anom_c 추가)
    ↓
┌─────────────────────────────────────────┐
│  다양한 집계 및 변환                     │
├─────────────────────────────────────────┤
│ • 연간 평균 → annual_anom → stripes.csv │
│ • 월별 데이터 → spiral_monthly_anom.csv │
│ • 10년대×월별 → decade_monthly.csv      │
│ • 10년대별 통계 → meanvar_by_decade.csv │
│ • 11년 롤링 → milestone.csv             │
└─────────────────────────────────────────┘
```

## 주요 개념 설명

### 1. 면적 가중 평균 (Area-Weighted Mean)
- 지구는 구형이므로 위도가 높을수록 그리드 셀의 면적이 작아집니다
- 단순 평균 대신 면적으로 가중치를 주어 실제 지표면적을 반영합니다

### 2. 이상값 (Anomaly)
- 절대 온도가 아닌 기준 기간 대비 편차를 사용합니다
- 기준 기후: 1850-1900 (없으면 1961-1990)
- 장점: 절대값보다 변화 추세를 더 명확히 보여줍니다

### 3. 월별 기준 기후 평균
- 계절성을 고려하여 각 월별로 별도의 기준값을 계산합니다
- 예: 1월 이상값 = 1월 온도 - 1월 기준값

### 4. 롤링 평균
- 11년 이동평균으로 연간 변동성을 완화하여 장기 추세를 강조합니다

## 참고사항

- **데이터 크기**: 원본 데이터는 3D 배열(time × lat × lon)이지만, 집계 후에는 작은 CSV 파일로 압축됩니다
- **지연 로딩**: Xarray는 기본적으로 lazy evaluation을 사용하므로, `.load()`를 호출하기 전까지는 실제 계산이 발생하지 않습니다
- **온도 단위**: CMIP6 데이터는 보통 켈빈(K)으로 저장되므로 섭씨(°C)로 변환합니다



# CMIP6 → D3 시각화 스타터 키트 사용 가이드

이 패키지는 CMIP6 데이터를 D3.js로 시각화하기 위한 스타터 키트입니다.

## 📋 포함 내용

- **Placeholder CSV 파일들** (`data/` 폴더): D3 시각화를 즉시 미리볼 수 있습니다
- **D3 코드** (`js/`) 및 간단한 HTML 페이지들로 **5가지 시각화**:
  1) Warming Stripes (연간 이상값)
  2) Climate Spiral (월별 이상값, 방사형)
  3) Seasonality by Decade (10년별 월별 곡선 오버레이)
  4) Mean vs Variance by Decade (산점도)
  5) Milestone Monitor (롤링 평균 vs 임계값)

Placeholder CSV를 **실제 CMIP6 데이터에서 생성한 CSV**로 교체하세요 (동일한 컬럼 이름 사용).

## 🚀 빠른 미리보기 (로컬)

### 방법 1: Python HTTP 서버 사용

```bash
cd cmip6_d3_starter
python3 -m http.server 8000
```

그 다음 브라우저에서 `http://localhost:8000`을 열어주세요.

### 방법 2: 스크립트 사용 (Mac/Linux)

```bash
cd cmip6_d3_starter
chmod +x start_server.sh
./start_server.sh
```

### 방법 3: 다른 포트 사용

```bash
python3 -m http.server 8080  # 8080 포트 사용
```

## 📊 CSV 파일 생성 (Jupyter Notebook)

### 단계별 가이드

1. **기존 노트북에서 데이터 로드**
   - `ta_timeseries` (전지구 월평균 2m 기온)가 생성될 때까지 노트북 셀들을 실행하세요

2. **노트북에 추가된 셀들 실행**
   - 노트북 마지막에 추가된 "Export Data for D3 Visualizations" 섹션의 셀들을 순서대로 실행하세요
   - 각 셀은 다음을 수행합니다:
     - Helper 함수 정의
     - 월별 데이터 변환
     - 월별 이상값 계산
     - 연간 이상값 계산
     - 10년별 계절성 데이터
     - 10년별 평균-분산 데이터
     - 롤링 평균 데이터
     - CSV 파일 저장

3. **생성된 CSV 파일 확인**
   - `cmip6_d3_starter/data/` 폴더에 다음 파일들이 생성됩니다:
     - `stripes.csv` (year, anom_c)
     - `spiral_monthly_anom.csv` (year, month, anom_c)
     - `decade_monthly.csv` (decade, month, anom_c)
     - `meanvar_by_decade.csv` (decade, mean_c, std_c)
     - `milestone.csv` (year, rolling11_anom_c)

### CSV 스키마

D3 코드가 기대하는 컬럼 이름:

- **Stripes**: `year, anom_c`
- **Spiral**: `year, month, anom_c`
- **Seasonality**: `decade, month, anom_c`
- **Mean-Variance**: `decade, mean_c, std_c`
- **Milestone**: `year, rolling11_anom_c`

### 기준 기후 (Baseline)

- 기본값: 1850–1900
- 데이터가 없으면 자동으로 1961–1990으로 폴백됩니다
- 온도 단위: 켈빈(K)에서 섭씨(°C)로 자동 변환됩니다

## 🌐 GitHub Pages 배포

1. 이 폴더를 GitHub 저장소에 푸시하세요
2. 저장소 설정 → Pages에서 브랜치를 `main` (또는 `master`)로 설정하고 폴더를 `/` (root)로 설정하세요
3. CSV 파일 경로가 저장소 구조와 일치하는지 확인하세요

## 📝 참고사항

- 모든 시각화는 순수 D3.js로 작성되었습니다
- 서버 사이드 지원이 필요 없습니다 (정적 파일만 사용)
- 데이터는 로컬 CSV 파일이나 공개 웹 API에서 로드할 수 있습니다

## 🐛 문제 해결

### 서버가 시작되지 않을 때
- Python 3가 설치되어 있는지 확인: `python3 --version`
- 포트가 이미 사용 중인지 확인: 다른 포트 번호를 사용하세요

### CSV 파일이 로드되지 않을 때
- 브라우저 콘솔(F12)에서 에러 확인
- CSV 파일 경로가 올바른지 확인
- CSV 컬럼 이름이 정확한지 확인

### 데이터가 표시되지 않을 때
- CSV 파일이 올바르게 생성되었는지 확인
- CSV 파일 형식이 올바른지 확인 (쉼표 구분, 헤더 포함)


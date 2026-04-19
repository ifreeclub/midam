# 2호점 복사 가이드

신규 매장 오픈 시 기존 시스템을 복제하는 절차

작업 시간: **약 20분**

---

## 전체 흐름

```
[1호점 구글시트] ---복사---> [2호점 구글시트]
        |                            |
        v                            v
[1호점 앱시트]  ---Copy App--> [2호점 앱시트]
        |                            |
        v                            v
[1호점 Apps Script] --복사--> [2호점 Apps Script]
        |                            |
        v                            v
[1호점 Vercel] ----복제-----> [2호점 Vercel]
```

---

## 1. 구글시트 복사 (3분)

1. 1호점 `미담 종합리스트01` 열기
2. **파일 -> 사본 만들기**
3. 이름: `미담 종합리스트01 - 2호점`
4. 폴더: 원하는 위치
5. **사본 만들기** 클릭
6. 생성된 시트의 URL에서 **SHEET_ID** 복사 (`/d/`와 `/edit` 사이)
7. 필요시 기존 데이터 전체 삭제 (헤더 1행은 유지)

---

## 2. AppSheet 관리자 앱 복사 (5분)

1. https://appsheet.com 접속
2. 1호점 앱 `미담_테접수` 열기
3. 좌측 상단 **Copy App**
4. 이름: `미담_테접수_2호점`
5. **Data source** 설정 창이 뜨면
   - 기존 시트 대신 **2호점 구글시트** 선택
   - `미담_앱접수` 탭 지정
6. **Copy** 클릭
7. 복사 완료 후 **Deploy** -> 배포

---

## 3. Apps Script 복사 (5분)

### 방법 A: 파일 복사

1. https://script.google.com 접속
2. 1호점 프로젝트 `미담_태블릿_백엔드` 열기
3. **파일 -> 사본 만들기** (좌측 상단 메뉴)
4. 사본 이름: `미담_태블릿_백엔드_2호점`
5. `Code.gs` 상단 `CONFIG` 수정
   ```javascript
   const CONFIG = {
     SHEET_ID: '2호점_시트_ID',                 // <- 1번에서 복사한 ID
     SHEET_NAME: '미담_앱접수',                 // 그대로
     API_TOKEN: 'midam-2-2026-secret-token',   // 2호점용 랜덤 문자열로 변경
     ...
   }
   ```
6. **배포 -> 새 배포 -> 웹 앱**
   - 실행: 나
   - 액세스 권한: 모든 사용자
7. 발급된 **웹 앱 URL** 복사

### 방법 B: 수동 복사

파일 복사가 어렵다면 1호점 `Code.gs` 내용을 복사해서 신규 프로젝트에 붙여넣기

---

## 4. 프론트 소스 복제 (5분)

### 방법 A: GitHub 포크

```bash
# 로컬에서
git clone https://github.com/LordOfWins/midam-tablet.git midam-tablet-2
cd midam-tablet-2

# 새 remote 설정
git remote remove origin
# GitHub에서 midam-tablet-2 저장소 생성 후
git remote add origin https://github.com/LordOfWins/midam-tablet-2.git
```

### config.js 수정

```javascript
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/2호점_DEPLOYMENT_ID/exec',  // 3번 URL
  API_TOKEN: 'midam-2-2026-secret-token',   // 3번에서 설정한 값
  SHOP_NAME: '미담사진관 2호점',
  DEBUG_BORDER: false,
  AUTO_REFRESH_MS: 30000,
  REQUEST_TIMEOUT_MS: 15000
}
```

### 커밋 & 푸시

```bash
git add public/config.js
git commit -m "config: setup for 2호점"
git push -u origin main
```

---

## 5. Vercel 배포 (2분)

1. https://vercel.com/new
2. 새 GitHub 저장소 선택 -> Import
3. Framework: Other / Output Directory: `public`
4. Deploy

발급 URL: `https://midam-tablet-2.vercel.app` (또는 커스텀 도메인)

---

## 6. 2호점 태블릿 설정

갤럭시탭에서

1. Chrome으로 2호점 URL 접속
2. 홈 화면에 추가
3. 앱 고정

---

## 체크리스트

- [ ] 2호점 구글시트 생성 및 SHEET_ID 확인
- [ ] 시트 헤더 행이 1호점과 동일한지 확인
- [ ] 앱시트 관리자 앱 복사 후 2호점 시트에 연결
- [ ] Apps Script 복사 후 SHEET_ID / API_TOKEN 수정
- [ ] Apps Script 웹 앱 배포 후 URL 복사
- [ ] GitHub 저장소 포크 또는 복제
- [ ] config.js에 2호점 URL / TOKEN 입력
- [ ] Vercel 배포
- [ ] 태블릿에서 배포 URL 접속 -> 홈 화면 추가 -> 앱 고정
- [ ] 테스트 등록 1건 -> 앱시트 관리자 앱에서 확인

---

## 주의사항

- **API_TOKEN은 1호점과 반드시 다르게** 설정할 것 (보안)
- 1호점과 2호점의 Apps Script URL이 절대 섞이지 않도록 주의
- Apps Script 배포 시 **실행: 나** 를 선택하면 해당 계정의 쿼터를 사용한다
  -> 1호점/2호점 전부 `midamplab@gmail.com`으로 배포하면 일일 쿼터를 공유함
  -> 사진관 규모에선 쿼터 초과 가능성 매우 낮지만 분리하고 싶으면 2호점은 별도 구글 계정으로 배포

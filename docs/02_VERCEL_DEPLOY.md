# Vercel 배포 가이드

프론트엔드 정적 호스팅 절차

---

## 사전 준비

- GitHub 계정
- Vercel 계정 (GitHub 로그인 권장)
- Apps Script 배포 완료 (`01_APPS_SCRIPT_DEPLOY.md` 완료 후)

---

## 1. GitHub 저장소 생성

로컬에서 초기 push

```bash
cd midam-tablet

git init
git add -u
git add public/ apps-script/ docs/ vercel.json package.json .gitignore
git commit -m "Initial commit: midam tablet web"

# GitHub에서 midam-tablet 저장소 생성 후
git remote add origin https://github.com/LordOfWins/midam-tablet.git
git branch -M main
git push -u origin main
```

---

## 2. config.js 사전 확인

배포 전 `public/config.js` 값이 실제 값으로 바뀌어 있는지 반드시 확인

```javascript
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/REAL_ID/exec',  // 실제 URL
  API_TOKEN: 'midam-2026-secret-token',   // Apps Script와 동일
  SHOP_NAME: '미담사진관',
  DEBUG_BORDER: false,                     // 반드시 false
  AUTO_REFRESH_MS: 30000,
  REQUEST_TIMEOUT_MS: 15000
}
```

---

## 3. Vercel 프로젝트 생성

1. https://vercel.com/new 접속
2. **Import Git Repository** -> GitHub 연결
3. `midam-tablet` 저장소 선택 -> **Import**
4. 설정
   - **Framework Preset**: `Other`
   - **Root Directory**: `.` (그대로)
   - **Build Command**: 비워둠 (정적 사이트)
   - **Output Directory**: `public`
5. **Deploy** 클릭

> `vercel.json`에 `outputDirectory: "public"`이 명시되어 있어서 별도 설정이 없어도 자동 인식된다

---

## 4. 배포 URL 확인

배포 완료 후 `https://midam-tablet.vercel.app` 같은 URL이 발급된다

브라우저에서 접속해서 확인
- 상단 네이비 헤더 표시
- 좌측 66% 접수폼 / 우측 34% 대기리스트
- 대기리스트에 기존 데이터 표시되는지 확인

---

## 5. 커스텀 도메인 (선택)

Vercel 프로젝트 -> **Settings** -> **Domains**

원하는 도메인 추가 (예: `midam.kr`)

DNS 설정은 Vercel 안내 따라서 A/CNAME 레코드 추가

---

## 6. 갤럭시탭 A9 홈 화면 추가

1. Chrome으로 배포 URL 접속
2. 우측 상단 **⋮** 메뉴 -> **홈 화면에 추가**
3. 이름 확인 후 **추가**
4. 홈 화면에 생긴 아이콘 탭 -> standalone 모드로 실행 (URL바 없음)

---

## 7. 앱 고정 설정 (고객 안내용)

갤럭시탭에서 손님이 다른 화면으로 못 가게 하는 설정

1. **설정 -> 보안 및 개인 정보 보호 -> 기타 보안 설정 -> 앱 고정**
2. **앱 고정 사용** 토글 ON
3. 홈 화면의 미담 앱 실행
4. 화면 하단 **최근 앱** 버튼 길게 누르기
5. 미담 앱 카드 위 **압정 아이콘** 탭 -> 고정
6. 해제 시 **뒤로가기 + 최근 앱 버튼 동시 길게 누르기**

> 모델에 따라 메뉴 위치 다를 수 있음 -> 고객에게 직접 원격으로 안내 권장

---

## 8. 재배포

코드 수정 후

```bash
git add -u
git commit -m "fix: <수정 내용>"
git push
```

Vercel이 자동으로 push 감지해서 재배포한다

---

## 장애 대응

### `CONFIG_NOT_SET` 에러
- config.js의 `APPS_SCRIPT_URL`이 `YOUR_DEPLOYMENT_ID` 그대로 남아있음 -> 실제 URL로 교체

### `네트워크 오류 (HTTP_0)` 또는 CORS 에러
- Apps Script 배포 설정에서 **액세스 권한: 모든 사용자** 확인
- Apps Script URL을 브라우저에서 직접 열어서 접근 가능한지 확인

### 대기리스트 로딩 무한반복
- 브라우저 개발자도구 Network 탭에서 요청/응답 확인
- Apps Script URL 직접 접근해서 응답 확인
- Apps Script 실행 로그 확인 (script.google.com -> 실행 -> 실행 기록)

### PWA 설치 배너가 안 뜸
- HTTPS로 접속했는지 확인 (Vercel은 기본 HTTPS)
- manifest.json이 정상 로드되는지 개발자도구 Application 탭에서 확인
- Service Worker가 등록됐는지 확인

### 스타일이 깨짐
- 브라우저 캐시 문제일 수 있음 -> 강제 새로고침 (Ctrl+Shift+R)
- sw.js의 `CACHE_VERSION`을 `midam-v1.0.1` 식으로 올려서 재배포

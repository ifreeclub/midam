# Apps Script 배포 가이드

미담사진관 태블릿 웹의 백엔드(Google Apps Script) 배포 절차

---

## 사전 준비

- 구글 계정 (`midamplab@gmail.com` 또는 관리자 계정)
- 구글시트 **미담 종합리스트01** 편집 권한
- 시트 탭 이름이 정확히 `미담_앱접수`인지 확인

---

## 1. 구글시트 ID 확인

구글시트를 브라우저에서 연다

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=0
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      이 부분이 SHEET_ID
```

`/d/` 와 `/edit` 사이의 문자열 전체를 복사해둔다

---

## 2. Apps Script 프로젝트 생성

1. https://script.google.com 접속
2. 좌측 상단 **새 프로젝트** 클릭
3. 프로젝트 이름을 `미담_태블릿_백엔드` 로 변경
4. 좌측 `Code.gs` 파일 내용 전체 삭제
5. 이 저장소의 `apps-script/Code.gs` 내용 전체를 복사해서 붙여넣기

---

## 3. 설정값 수정

파일 상단 `CONFIG` 객체에서 아래 값들을 수정한다

```javascript
const CONFIG = {
  SHEET_ID: '1AbCdEfGhIjKlMnOpQrStUvWxYz',   // 1번에서 복사한 값
  SHEET_NAME: '미담_앱접수',                   // 그대로 유지
  API_TOKEN: 'midam-2026-secret-token',      // 랜덤 문자열로 변경 권장
  DEFAULT_STATUS: '촬영',
  EXCLUDE_STATUS: ['완료', '취소']
}
```

`API_TOKEN`은 랜덤 문자열로 바꾸는 게 좋다 (예: `openssl rand -hex 16` 결과)
-> 바꿨으면 프론트 `public/config.js`의 `API_TOKEN`도 동일하게 맞춰야 한다

---

## 4. 수동 테스트 (배포 전)

좌측 상단 함수 선택 드롭다운에서 `testList` 선택 -> **실행** 버튼

최초 실행 시 권한 요청 팝업이 뜬다
- **검토** 클릭
- 계정 선택
- **고급** -> **안전하지 않은 페이지로 이동** -> **허용**

실행 로그에 `{ ok: true, list: [...] }` 형태로 출력되면 성공

---

## 5. 웹 앱 배포

1. 우측 상단 **배포** -> **새 배포**
2. 우측 톱니바퀴 -> **웹 앱** 선택
3. 설정
   - **설명**: `미담 태블릿 v1.0.0`
   - **실행**: `나 (midamplab@gmail.com)`
   - **액세스 권한**: `모든 사용자`
4. **배포** 클릭
5. 권한 승인 후 **웹 앱 URL** 복사

URL 형식: `https://script.google.com/macros/s/AKfycbx.../exec`

---

## 6. 프론트 config.js에 URL 입력

`public/config.js` 파일 열기

```javascript
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx.../exec',  // 5번 URL
  API_TOKEN: 'midam-2026-secret-token',  // 3번에서 설정한 값과 동일
  ...
}
```

---

## 7. 작동 테스트

브라우저에서 배포 URL에 `?action=ping&token=YOUR_TOKEN` 붙여서 접속

```
https://script.google.com/macros/s/AKfycbx.../exec?action=ping&token=midam-2026-secret-token
```

응답으로 아래가 뜨면 성공

```json
{"ok":true,"version":"1.0.0","time":"2026-04-19T..."}
```

---

## 재배포 시 주의사항

코드를 수정하고 **새 배포**가 아니라 **배포 관리 -> 수정(연필 아이콘) -> 버전 새로 만들기** 를 해야 **URL이 유지된다**

**새 배포**로 하면 URL이 바뀌어서 프론트 config.js도 같이 수정해야 한다

---

## 장애 대응

### `UNAUTHORIZED` 에러
- config.js의 `API_TOKEN`과 Apps Script의 `CONFIG.API_TOKEN`이 다름 -> 일치시킬 것

### `시트를 찾을 수 없습니다` 에러
- 구글시트 탭 이름이 `미담_앱접수`가 맞는지 확인
- 공백이나 다른 문자 포함 여부 확인

### `권한 오류`
- 배포 시 **실행: 나** 설정 확인
- 배포한 계정이 시트 편집 권한을 가지고 있는지 확인

### 대기리스트가 안 보임
- 상황 컬럼 값이 `완료` / `취소` 가 아닌지 확인
- 시트 첫 행(헤더)에 `ID`, `이름`, `상황` 컬럼이 정확히 있는지 확인

### 일일 할당량 초과
- 사진관 규모(14명/일)에선 거의 발생 불가
- 발생 시 24시간 후 자동 리셋

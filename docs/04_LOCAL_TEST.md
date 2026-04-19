# 로컬 테스트 가이드

배포 전 로컬에서 확인하는 방법

---

## 1. 간단 테스트 (파일 열기만)

`public/index.html`을 브라우저로 열기만 해도 UI는 확인 가능

단 **API 호출은 실패한다** (Apps Script URL을 설정해야 동작)
-> UI 레이아웃/폰트/버튼/모달 확인 용도로만 사용

---

## 2. 정식 로컬 서버 (API 테스트 포함)

Apps Script 배포까지 완료했다는 전제

### Python 내장 서버

```bash
cd midam-tablet/public
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속

### Node.js (serve)

```bash
npx serve public -p 8000
```

### 주의

- Service Worker는 HTTPS 또는 `localhost`에서만 등록됨
- `127.0.0.1`로 접속하면 Service Worker 안 뜰 수 있음 -> `localhost`로 접속

---

## 3. 디버그 border 켜기

레이아웃 확인 시 `public/config.js` 에서

```javascript
DEBUG_BORDER: true   // false -> true
```

패널/폼 그룹 경계에 빨간 점선이 표시됨

**배포 전 반드시 false로 복구**

---

## 4. 개발자도구 체크리스트

### Application 탭
- Manifest: 모든 필드 정상 로드
- Service Workers: `sw.js` 등록됨 / 상태 activated
- Storage -> Cache Storage: `midam-v1.0.0` 항목 존재

### Network 탭
- 첫 로드: `index.html`, `styles.css`, `app.js`, `config.js`, `manifest.json`, `sw.js`, 아이콘들 전부 200
- 이후 로드: (선택) 캐시에서 로드되는지 확인
- API 요청: `script.google.com/macros/s/...` 로 POST 요청 전송, 응답 200 + JSON

### Console 탭
- 에러 메시지 없음
- 경고는 Service Worker 관련 정도만 허용

---

## 5. 기능 체크리스트

- [ ] 좌우 헤더 높이 동일한지 육안 확인
- [ ] 좌 66% / 우 나머지 비율 확인
- [ ] 새로고침 버튼이 우측 헤더 우측 50px 영역에 위치
- [ ] 폰트 크기 고객 스펙과 일치 (헤더 21 / 라벨 19 / 안내 18 / 리스트 19 등)
- [ ] 이름 빈칸으로 등록 클릭 -> 커스텀 모달 (alert 아님)
- [ ] 전화번호 `010-` 만으로 등록 클릭 -> 커스텀 모달
- [ ] 이메일 형식 오류 -> 커스텀 모달
- [ ] 정상 등록 -> 토스트 + 대기리스트에 표시
- [ ] 이름 클릭 -> 끝4자리 인증 모달
- [ ] 틀린 4자리 입력 -> 모달 내 빨간 에러 메시지
- [ ] 맞는 4자리 입력 -> 수정 모달 + 이름 readonly
- [ ] 수정 후 저장 -> 토스트 + 리스트 리프레시
- [ ] 취소 -> 빈 입력칸 초기화 (전화번호는 010-)
- [ ] 30초 뒤 자동 새로고침 (모달 닫혀있을 때만)

---

## 6. 갤럭시탭 A9 실기기 테스트

1. 같은 Wi-Fi 연결
2. 로컬 개발 PC IP 확인 (`ipconfig` / `ifconfig`)
3. `http://192.168.x.x:8000` 형태로 태블릿 Chrome에서 접속

단 이 경우 Service Worker 미등록 가능 (HTTPS 아님)
-> PWA 테스트는 Vercel 배포 후 실시

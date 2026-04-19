/**
 * 미담사진관 손님용 태블릿 웹 백엔드
 * Google Apps Script Web App - doGet/doPost JSON API
 *
 * 배포 방법:
 * 1. script.google.com -> 새 프로젝트
 * 2. 이 파일 내용 붙여넣기
 * 3. SHEET_ID를 실제 구글시트 ID로 교체
 * 4. 배포 -> 새 배포 -> 유형: 웹 앱
 *    - 실행: 나
 *    - 액세스: 모든 사용자
 * 5. 배포 URL을 프론트엔드 config.js에 입력
 *
 * 2호점 복사 방법:
 * - 이 프로젝트를 파일 복사
 * - SHEET_ID만 교체
 * - 재배포 -> 새 URL 획득
 */

// ============================================================
// 설정값 (2호점 복사 시 여기만 수정)
// ============================================================
const CONFIG = {
  SHEET_ID: '11kcBZRYG1aqNn9qJEUqhHILy2sFTOSywZVOnUeLyi5k',   // 구글시트 ID (URL의 /d/ 뒤 문자열)
  SHEET_NAME: '미담_앱접수',                 // 시트 탭 이름
  API_TOKEN: 'midam-2026-secret-token',    // 간이 API 토큰 (프론트와 일치시킴)
  DEFAULT_STATUS: '촬영',                  // 신규 접수 기본 상황값
  EXCLUDE_STATUS: ['완료', '취소']         // 대기리스트에서 제외할 상황값
}

// 구글시트 컬럼 순서 - 시트 첫 행과 정확히 일치해야 함
const COLUMNS = ['ID', '날짜', '상품', '상황', '이름', '전화번호', '이메일', '파일명', '인증키']

// ============================================================
// 엔트리포인트 - GET/POST 라우팅
// ============================================================

function doGet(e) {
  return handleRequest(e, 'GET')
}

function doPost(e) {
  return handleRequest(e, 'POST')
}

function handleRequest(e, method) {
  try {
    let params = {}
    let action = ''

    if (method === 'GET') {
      params = e.parameter || {}
      action = params.action || ''
    } else {
      // POST - text/plain으로 받아서 CORS preflight 회피
      if (e.postData && e.postData.contents) {
        params = JSON.parse(e.postData.contents)
        action = params.action || ''
      }
    }

    // 토큰 검증 (간이 인증 - 완전한 인증은 아니지만 우발적 악용 방지)
    if (params.token !== CONFIG.API_TOKEN) {
      return jsonResponse({ ok: false, error: 'UNAUTHORIZED' })
    }

    // 액션 라우팅
    switch (action) {
      case 'list':
        return jsonResponse(listWaiting())
      case 'create':
        return jsonResponse(createEntry(params.data))
      case 'verify':
        return jsonResponse(verifyPhone(params.id, params.last4))
      case 'update':
        return jsonResponse(updateEntry(params.id, params.data, params.last4))
      case 'ping':
        return jsonResponse({ ok: true, version: '1.1.0', time: new Date().toISOString() })
      default:
        return jsonResponse({ ok: false, error: 'UNKNOWN_ACTION' })
    }
  } catch (err) {
    Logger.log('handleRequest error: ' + err.stack)
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: String(err) })
  }
}

// ============================================================
// 응답 헬퍼
// ============================================================

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ============================================================
// 시트 접근 헬퍼
// ============================================================

function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID)
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME)
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + CONFIG.SHEET_NAME)
  }
  return sheet
}

/**
 * 시트의 첫 행(헤더)을 읽어서 컬럼명 -> 인덱스 맵 생성
 * 컬럼 순서가 바뀌어도 동작하게끔 헤더 기반으로 조회
 */
function getHeaderMap(sheet) {
  const lastCol = sheet.getLastColumn()
  if (lastCol === 0) {
    throw new Error('시트에 헤더가 없습니다')
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
  const map = {}
  headers.forEach((h, idx) => {
    map[String(h).trim()] = idx   // 0-based index
  })
  return { map: map, headers: headers, lastCol: lastCol }
}

// ============================================================
// 액션 1 - 대기리스트 조회
// ============================================================

function listWaiting() {
  const sheet = getSheet()
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) {
    return { ok: true, list: [] }
  }

  const { map, lastCol } = getHeaderMap(sheet)
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()

  const idIdx = map['ID']
  const nameIdx = map['이름']
  const statusIdx = map['상황']
  const dateIdx = map['날짜']

  if (idIdx === undefined || nameIdx === undefined || statusIdx === undefined) {
    throw new Error('필수 컬럼 누락 (ID / 이름 / 상황)')
  }

  const list = []
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const status = String(row[statusIdx] || '').trim()

    // 완료/취소는 제외
    if (CONFIG.EXCLUDE_STATUS.indexOf(status) !== -1) continue

    const id = String(row[idIdx] || '').trim()
    const name = String(row[nameIdx] || '').trim()
    if (!id || !name) continue

    list.push({
      id: id,
      name: name,
      date: formatDateYYMMDD(row[dateIdx])
    })
  }

  // 최근 등록이 위에 오게 역순 정렬 (시트는 append 되므로 뒤쪽이 최신)
  list.reverse()

  return { ok: true, list: list, count: list.length }
}

// ============================================================
// 전화번호 유효성 검증 헬퍼
// 한국 휴대폰 형식: 010-XXXX-XXXX (총 11자리 숫자, 010으로 시작)
// ============================================================

function validateKoreanMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '')

  if (digits.length === 0) return { ok: false, error: 'PHONE_REQUIRED' }
  if (digits.length !== 11) return { ok: false, error: 'PHONE_INVALID_LENGTH' }
  if (!digits.startsWith('010')) return { ok: false, error: 'PHONE_INVALID_PREFIX' }

  return { ok: true, digits: digits }
}

// 하이픈 포함 표준 포맷으로 정규화: 010-XXXX-XXXX
function normalizeKoreanMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length !== 11) return phone   // 검증 실패 시 원본 반환 (validate에서 거르므로 이 경로는 안전)
  return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7, 11)
}

// ============================================================
// 액션 2 - 신규 접수 등록
// ============================================================

function createEntry(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'INVALID_DATA' }
  }

  // 서버사이드 검증
  const name = sanitize(data.name)
  const phone = sanitize(data.phone)
  const email = sanitize(data.email || '')

  if (!name) return { ok: false, error: 'NAME_REQUIRED' }

  // 한국 휴대폰 형식 엄격 검증
  const phoneCheck = validateKoreanMobile(phone)
  if (!phoneCheck.ok) return phoneCheck

  // 표준 포맷으로 정규화하여 저장
  const normalizedPhone = normalizeKoreanMobile(phone)

  // LockService로 동시성 제어 (동시 등록 시 행 충돌 방지)
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(10000)   // 최대 10초 대기

    const sheet = getSheet()
    const { map, headers } = getHeaderMap(sheet)

    // 새 행 구성 - 헤더 순서대로
    const newRow = new Array(headers.length).fill('')
    const id = generateAppSheetCompatibleId()
    const today = formatDateYYMMDD(new Date())

    if (map['ID'] !== undefined) newRow[map['ID']] = id
    if (map['날짜'] !== undefined) newRow[map['날짜']] = today
    if (map['상품'] !== undefined) newRow[map['상품']] = ''
    if (map['상황'] !== undefined) newRow[map['상황']] = CONFIG.DEFAULT_STATUS
    if (map['이름'] !== undefined) newRow[map['이름']] = name
    if (map['전화번호'] !== undefined) newRow[map['전화번호']] = normalizedPhone
    if (map['이메일'] !== undefined) newRow[map['이메일']] = email
    if (map['파일명'] !== undefined) newRow[map['파일명']] = ''
    if (map['인증키'] !== undefined) newRow[map['인증키']] = ''

    sheet.appendRow(newRow)

    return { ok: true, id: id, name: name, date: today }
  } catch (err) {
    Logger.log('createEntry error: ' + err.stack)
    return { ok: false, error: 'CREATE_FAILED', message: String(err) }
  } finally {
    try { lock.releaseLock() } catch (e) {}
  }
}

// ============================================================
// 액션 3 - 전화번호 끝4자리 인증
// ============================================================

function verifyPhone(id, last4) {
  if (!id || !last4) return { ok: false, error: 'INVALID_PARAMS' }

  const last4Digits = String(last4).replace(/\D/g, '')
  if (last4Digits.length !== 4) return { ok: false, error: 'LAST4_INVALID' }

  const row = findRowById(id)
  if (!row) return { ok: false, error: 'NOT_FOUND' }

  const phoneDigits = String(row.data['전화번호'] || '').replace(/\D/g, '')

  // 저장된 번호가 정상 11자리가 아닐 경우 디버깅을 위한 에러 분리
  if (phoneDigits.length !== 11) {
    Logger.log('verifyPhone: 비정상 저장 번호 id=' + id + ' digits=[' + phoneDigits + '] length=' + phoneDigits.length)
    return { ok: false, error: 'STORED_PHONE_CORRUPTED', debug: phoneDigits.length }
  }

  const actualLast4 = phoneDigits.slice(-4)

  if (actualLast4 !== last4Digits) {
    return { ok: false, error: 'LAST4_MISMATCH' }
  }

  // 인증 성공 - 현재 정보 반환 (수정 화면 prefill용)
  return {
    ok: true,
    id: id,
    name: row.data['이름'] || '',
    phone: row.data['전화번호'] || '',
    email: row.data['이메일'] || ''
  }
}

// ============================================================
// 액션 4 - 정보 수정 (인증 재검증 포함)
// ============================================================

function updateEntry(id, data, last4) {
  if (!id || !data || !last4) return { ok: false, error: 'INVALID_PARAMS' }

  // 재인증 (중간자 공격 방지 - 인증 후 수정 사이에 다시 한 번 확인)
  const verifyResult = verifyPhone(id, last4)
  if (!verifyResult.ok) return verifyResult

  const phone = sanitize(data.phone)
  const email = sanitize(data.email || '')

  // 한국 휴대폰 형식 엄격 검증 (신규 번호에도 동일 적용)
  const phoneCheck = validateKoreanMobile(phone)
  if (!phoneCheck.ok) return phoneCheck

  const normalizedPhone = normalizeKoreanMobile(phone)

  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(10000)

    const sheet = getSheet()
    const { map } = getHeaderMap(sheet)
    const row = findRowById(id)
    if (!row) return { ok: false, error: 'NOT_FOUND' }

    // 이름은 수정 불가 - 전화번호/이메일만 업데이트
    if (map['전화번호'] !== undefined) {
      sheet.getRange(row.rowIndex, map['전화번호'] + 1).setValue(normalizedPhone)
    }
    if (map['이메일'] !== undefined) {
      sheet.getRange(row.rowIndex, map['이메일'] + 1).setValue(email)
    }

    return { ok: true, id: id }
  } catch (err) {
    Logger.log('updateEntry error: ' + err.stack)
    return { ok: false, error: 'UPDATE_FAILED', message: String(err) }
  } finally {
    try { lock.releaseLock() } catch (e) {}
  }
}

// ============================================================
// 헬퍼 - ID로 행 찾기
// ============================================================

function findRowById(id) {
  const sheet = getSheet()
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null

  const { map, headers, lastCol } = getHeaderMap(sheet)
  const idIdx = map['ID']
  if (idIdx === undefined) return null

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
  const targetId = String(id).trim()

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === targetId) {
      const rowObj = {}
      headers.forEach((h, idx) => {
        rowObj[String(h).trim()] = data[i][idx]
      })
      return {
        rowIndex: i + 2,   // 시트 기준 실제 행 번호 (1-based + 헤더 1행)
        data: rowObj
      }
    }
  }
  return null
}

// ============================================================
// 헬퍼 - 입력값 sanitize
// ============================================================

function sanitize(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '')   // 제어 문자 제거
    .slice(0, 200)                      // 최대 길이 제한
}

// ============================================================
// 헬퍼 - AppSheet 호환 ID 생성 (8자리 영숫자)
// ============================================================

function generateAppSheetCompatibleId() {
  // AppSheet UNIQUEID()와 동일한 형식: 8자리 대소문자 영숫자
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

// ============================================================
// 헬퍼 - 날짜 포맷 (YY-MM-DD)
// Date 객체 / "YY-MM-DD" 문자열 / 기타 문자열 전부 처리
// ============================================================

function formatDateYYMMDD(value) {
  if (!value) return ''

  // 이미 YY-MM-DD 형식이면 그대로 반환
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{2}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    // 다른 문자열이면 Date 파싱 시도
    const parsed = new Date(trimmed)
    if (isNaN(parsed.getTime())) return trimmed
    return dateToYYMMDD(parsed)
  }

  // Date 객체
  if (value instanceof Date) {
    return dateToYYMMDD(value)
  }

  return String(value)
}

function dateToYYMMDD(date) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// ============================================================
// 개발용 - 수동 테스트
// ============================================================

function testList() {
  Logger.log(JSON.stringify(listWaiting(), null, 2))
}

function testCreate() {
  Logger.log(JSON.stringify(createEntry({
    name: '테스트',
    phone: '010-1234-5678',
    email: 'test@test.com'
  }), null, 2))
}

function testVerify() {
  const list = listWaiting()
  if (list.list.length > 0) {
    const firstId = list.list[0].id
    Logger.log(JSON.stringify(verifyPhone(firstId, '5678'), null, 2))
  }
}

// 특정 ID의 저장 상태 진단용
function testInspectRow() {
  const targetId = 'uFgqcZ2S'   // 문제 있는 ID로 교체해서 사용
  const row = findRowById(targetId)
  if (!row) {
    Logger.log('행 없음: ' + targetId)
    return
  }
  Logger.log('전화번호 원본: [' + row.data['전화번호'] + ']')
  const digits = String(row.data['전화번호'] || '').replace(/\D/g, '')
  Logger.log('숫자만: [' + digits + '] length=' + digits.length)
  Logger.log('끝4자리: [' + digits.slice(-4) + ']')
}

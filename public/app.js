/**
 * 미담사진관 태블릿 웹 - 메인 로직
 *
 * 구조:
 * - api: Apps Script 백엔드 통신
 * - ui: DOM 조작
 * - state: 전역 상태 (현재 인증 중인 대상 등)
 * - handlers: 이벤트 핸들러
 */

(function () {
  'use strict'

  // ============================================================
  // 상태
  // ============================================================
  const state = {
    waitlist: [],
    authTarget: null,      // { id, name } - 현재 인증 중인 대기자
    verifiedLast4: null,   // 인증 성공한 끝4자리 (수정 시 재전송용)
    isSubmitting: false,
    isLoading: false
  }

  // ============================================================
  // DOM 참조
  // ============================================================
  const $ = (id) => document.getElementById(id)

  const els = {
    inputName: $('input-name'),
    inputPhone: $('input-phone'),
    inputEmail: $('input-email'),
    btnSubmit: $('btn-submit'),
    btnCancel: $('btn-cancel'),
    btnRefresh: $('btn-refresh'),
    waitlistContainer: $('waitlist-container'),

    modalAuth: $('modal-auth'),
    authTargetName: $('auth-target-name'),
    inputLast4: $('input-last4'),
    authError: $('auth-error'),
    btnAuthConfirm: $('btn-auth-confirm'),
    btnAuthCancel: $('btn-auth-cancel'),

    modalEdit: $('modal-edit'),
    editName: $('edit-name'),
    editPhone: $('edit-phone'),
    editEmail: $('edit-email'),
    btnEditSave: $('btn-edit-save'),
    btnEditCancel: $('btn-edit-cancel'),

    modalMessage: $('modal-message'),
    modalMessageText: $('modal-message-text'),
    btnMessageOk: $('btn-message-ok'),

    toastContainer: $('toast-container')
  }

  // ============================================================
  // 유틸
  // ============================================================

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function sanitizeInput(str) {
    if (str === null || str === undefined) return ''
    return String(str).trim().replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200)
  }

  function extractDigits(str) {
    return String(str || '').replace(/\D/g, '')
  }

  // 전화번호 최소 4자리 이상 숫자
  function isValidPhone(phone) {
    return extractDigits(phone).length >= 4
  }

  function isValidEmail(email) {
    if (!email) return true   // 선택 입력
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // ============================================================
  // 커스텀 메시지 모달 (alert 대체)
  // ============================================================

  function showMessage(message) {
    return new Promise((resolve) => {
      els.modalMessageText.textContent = message
      els.modalMessage.hidden = false

      const onOk = () => {
        els.modalMessage.hidden = true
        els.btnMessageOk.removeEventListener('click', onOk)
        resolve()
      }
      els.btnMessageOk.addEventListener('click', onOk)
    })
  }

  // ============================================================
  // 토스트 (가벼운 알림용)
  // ============================================================

  function showToast(message, type = 'default') {
    const toast = document.createElement('div')
    toast.className = 'toast' + (type !== 'default' ? ' toast--' + type : '')
    toast.textContent = message
    els.toastContainer.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 2600)
  }

  // ============================================================
  // API 호출
  // ============================================================

  async function apiCall(action, data = {}) {
    const config = window.APP_CONFIG

    if (!config || !config.APPS_SCRIPT_URL || config.APPS_SCRIPT_URL.includes('YOUR_DEPLOYMENT_ID')) {
      throw new Error('CONFIG_NOT_SET')
    }

    const body = {
      action: action,
      token: config.API_TOKEN,
      ...data
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS || 15000)

    try {
      // text/plain으로 보내서 CORS preflight 회피
      const response = await fetch(config.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'follow'
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error('HTTP_' + response.status)
      }

      const json = await response.json()
      return json
    } catch (err) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        throw new Error('TIMEOUT')
      }
      throw err
    }
  }

  // ============================================================
  // 대기리스트 로드
  // ============================================================

  async function loadWaitlist() {
    if (state.isLoading) return
    state.isLoading = true

    els.btnRefresh.classList.add('is-spinning')

    try {
      const result = await apiCall('list')
      if (!result.ok) {
        throw new Error(result.error || 'LOAD_FAILED')
      }
      state.waitlist = result.list || []
      renderWaitlist()
    } catch (err) {
      console.error('loadWaitlist error:', err)
      renderWaitlistError(err.message)
    } finally {
      state.isLoading = false
      setTimeout(() => {
        els.btnRefresh.classList.remove('is-spinning')
      }, 300)
    }
  }

  function renderWaitlist() {
    const container = els.waitlistContainer
    container.innerHTML = ''

    if (state.waitlist.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'waitlist-empty'
      empty.textContent = '대기 중인 손님이 없습니다'
      container.appendChild(empty)
      return
    }

    const frag = document.createDocumentFragment()
    state.waitlist.forEach((item) => {
      const div = document.createElement('div')
      div.className = 'waitlist-item'
      div.dataset.id = item.id
      div.dataset.name = item.name
      div.textContent = item.name   // textContent로 XSS 방어
      div.addEventListener('click', () => openAuthModal(item))
      frag.appendChild(div)
    })
    container.appendChild(frag)
  }

  function renderWaitlistError(msg) {
    const container = els.waitlistContainer
    container.innerHTML = ''
    const div = document.createElement('div')
    div.className = 'waitlist-error'
    div.textContent = '불러오기 실패 (' + translateError(msg) + ')'
    container.appendChild(div)
  }

  // ============================================================
  // 등록
  // ============================================================

  async function handleSubmit() {
    if (state.isSubmitting) return

    const name = sanitizeInput(els.inputName.value)
    const phone = sanitizeInput(els.inputPhone.value)
    const email = sanitizeInput(els.inputEmail.value)

    // 유효성 검증
    if (!name) {
      await showMessage('이름을 입력해주세요')
      els.inputName.focus()
      return
    }
    if (!phone || phone === '010-') {
      await showMessage('전화번호를 입력해주세요')
      els.inputPhone.focus()
      return
    }
    if (!isValidPhone(phone)) {
      await showMessage('전화번호는 4자리 이상 입력해주세요')
      els.inputPhone.focus()
      return
    }
    if (email && !isValidEmail(email)) {
      await showMessage('이메일 형식이 올바르지 않습니다')
      els.inputEmail.focus()
      return
    }

    state.isSubmitting = true
    els.btnSubmit.disabled = true
    els.btnSubmit.textContent = '등록 중...'

    try {
      const result = await apiCall('create', {
        data: { name, phone, email }
      })

      if (!result.ok) {
        throw new Error(result.error || 'CREATE_FAILED')
      }

      showToast('등록 완료', 'success')
      resetForm()
      await loadWaitlist()
    } catch (err) {
      console.error('submit error:', err)
      await showMessage('등록 실패\n' + translateError(err.message))
    } finally {
      state.isSubmitting = false
      els.btnSubmit.disabled = false
      els.btnSubmit.textContent = '등록'
    }
  }

  function resetForm() {
    els.inputName.value = ''
    els.inputPhone.value = '010-'
    els.inputEmail.value = ''
  }

  // ============================================================
  // 인증 모달
  // ============================================================

  function openAuthModal(item) {
    state.authTarget = item
    state.verifiedLast4 = null
    els.authTargetName.textContent = item.name
    els.inputLast4.value = ''
    els.authError.hidden = true
    els.modalAuth.hidden = false
    setTimeout(() => els.inputLast4.focus(), 100)
  }

  // 인증 모달을 "취소"로 닫을 때 - state도 완전 초기화
  function cancelAuthModal() {
    els.modalAuth.hidden = true
    els.inputLast4.value = ''
    els.authError.hidden = true
    state.authTarget = null
    state.verifiedLast4 = null
  }

  // 인증 성공 후 수정 모달로 넘어갈 때 - state 유지 (authTarget 살려둠)
  function hideAuthModalKeepState() {
    els.modalAuth.hidden = true
    els.inputLast4.value = ''
    els.authError.hidden = true
    // state.authTarget 및 state.verifiedLast4 는 수정 단계에서 사용되므로 유지
  }

  async function handleAuthConfirm() {
    if (!state.authTarget) return

    const last4 = extractDigits(els.inputLast4.value)
    if (last4.length !== 4) {
      els.authError.textContent = '숫자 4자리를 입력해주세요'
      els.authError.hidden = false
      return
    }

    els.btnAuthConfirm.disabled = true

    try {
      const result = await apiCall('verify', {
        id: state.authTarget.id,
        last4: last4
      })

      if (!result.ok) {
        if (result.error === 'LAST4_MISMATCH') {
          els.authError.textContent = '핸드폰 끝자리 4자리가 맞지 않습니다'
          els.authError.hidden = false
          els.inputLast4.value = ''
          els.inputLast4.focus()
          return
        }
        if (result.error === 'NOT_FOUND') {
          els.authError.textContent = '대기 목록에서 찾을 수 없습니다 (새로고침 필요)'
          els.authError.hidden = false
          return
        }
        throw new Error(result.error)
      }

      // 인증 성공 - last4 저장 후 수정 모달 오픈 (state 유지)
      state.verifiedLast4 = last4
      hideAuthModalKeepState()   // ← authTarget 유지한 채로 인증 모달만 닫음
      openEditModal(result)
    } catch (err) {
      console.error('verify error:', err)
      els.authError.textContent = translateError(err.message)
      els.authError.hidden = false
    } finally {
      els.btnAuthConfirm.disabled = false
    }
  }

  // ============================================================
  // 수정 모달
  // ============================================================

  function openEditModal(data) {
    els.editName.value = data.name || ''
    els.editPhone.value = data.phone || ''
    els.editEmail.value = data.email || ''
    els.modalEdit.hidden = false
  }

  // 수정 모달 닫을 때 - 여기서 state 완전 초기화
  function closeEditModal() {
    els.modalEdit.hidden = true
    state.authTarget = null
    state.verifiedLast4 = null
  }

  async function handleEditSave() {
    if (!state.authTarget || !state.verifiedLast4) {
      await showMessage('세션이 만료되었습니다 다시 시도해주세요')
      closeEditModal()
      return
    }

    const phone = sanitizeInput(els.editPhone.value)
    const email = sanitizeInput(els.editEmail.value)

    if (!phone) {
      await showMessage('전화번호를 입력해주세요')
      els.editPhone.focus()
      return
    }
    if (!isValidPhone(phone)) {
      await showMessage('전화번호는 4자리 이상 입력해주세요')
      els.editPhone.focus()
      return
    }
    if (email && !isValidEmail(email)) {
      await showMessage('이메일 형식이 올바르지 않습니다')
      els.editEmail.focus()
      return
    }

    els.btnEditSave.disabled = true

    try {
      const result = await apiCall('update', {
        id: state.authTarget.id,
        last4: state.verifiedLast4,
        data: { phone, email }
      })

      if (!result.ok) {
        throw new Error(result.error || 'UPDATE_FAILED')
      }

      showToast('수정 완료', 'success')
      closeEditModal()
      await loadWaitlist()
    } catch (err) {
      console.error('update error:', err)
      await showMessage('수정 실패\n' + translateError(err.message))
    } finally {
      els.btnEditSave.disabled = false
    }
  }

  // ============================================================
  // 에러 메시지 한글화
  // ============================================================

  function translateError(code) {
    const map = {
      'NAME_REQUIRED': '이름을 입력해주세요',
      'PHONE_REQUIRED': '전화번호를 입력해주세요',
      'PHONE_TOO_SHORT': '전화번호는 4자리 이상이어야 합니다',
      'LAST4_INVALID': '숫자 4자리를 입력해주세요',
      'LAST4_MISMATCH': '끝자리가 맞지 않습니다',
      'NOT_FOUND': '대상을 찾을 수 없습니다',
      'UNAUTHORIZED': '인증 실패',
      'TIMEOUT': '응답 시간 초과',
      'CONFIG_NOT_SET': '서버 설정이 필요합니다',
      'SERVER_ERROR': '서버 오류',
      'CREATE_FAILED': '등록 중 오류 발생',
      'UPDATE_FAILED': '수정 중 오류 발생',
      'LOAD_FAILED': '불러오기 실패',
      'UNKNOWN_ACTION': '알 수 없는 요청'
    }
    if (!code) return '오류 발생'
    if (code.startsWith('HTTP_')) return '네트워크 오류 (' + code + ')'
    return map[code] || code
  }

  // ============================================================
  // 초기화 - 이벤트 바인딩
  // ============================================================

  function init() {
    // 디버그 border 토글
    if (window.APP_CONFIG && window.APP_CONFIG.DEBUG_BORDER) {
      document.body.classList.add('debug-border')
    }

    // 등록
    els.btnSubmit.addEventListener('click', handleSubmit)
    els.btnCancel.addEventListener('click', resetForm)

    // 전화번호 입력 시 010- 유지 처리
    els.inputPhone.addEventListener('focus', () => {
      if (!els.inputPhone.value) {
        els.inputPhone.value = '010-'
      }
    })

    // 새로고침
    els.btnRefresh.addEventListener('click', loadWaitlist)

    // 인증 모달
    els.btnAuthConfirm.addEventListener('click', handleAuthConfirm)
    els.btnAuthCancel.addEventListener('click', cancelAuthModal)
    els.inputLast4.addEventListener('input', (e) => {
      // 숫자만 허용
      e.target.value = extractDigits(e.target.value).slice(0, 4)
      els.authError.hidden = true
    })
    els.inputLast4.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAuthConfirm()
    })

    // 수정 모달
    els.btnEditSave.addEventListener('click', handleEditSave)
    els.btnEditCancel.addEventListener('click', closeEditModal)

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!els.modalAuth.hidden) cancelAuthModal()
        else if (!els.modalEdit.hidden) closeEditModal()
        else if (!els.modalMessage.hidden) els.modalMessage.hidden = true
      }
    })

    // 자동 새로고침
    if (window.APP_CONFIG && window.APP_CONFIG.AUTO_REFRESH_MS > 0) {
      setInterval(() => {
        // 모달이 열려있으면 새로고침 스킵 (UX 방해 방지)
        if (els.modalAuth.hidden && els.modalEdit.hidden && els.modalMessage.hidden) {
          loadWaitlist()
        }
      }, window.APP_CONFIG.AUTO_REFRESH_MS)
    }

    // Service Worker 등록 (PWA)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('SW registration failed:', err)
        })
      })
    }

    // 초기 로드
    loadWaitlist()
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

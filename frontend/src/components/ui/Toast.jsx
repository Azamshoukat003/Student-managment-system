import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { IconSuccess, IconAlert, IconInfo } from '../icons'

const ToastContext = createContext(null)
const ICONS = { success: IconSuccess, error: IconAlert, info: IconInfo }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (message, type = 'info') => {
      const id = ++idRef.current
      setToasts((t) => [...t, { id, message, type }])
      setTimeout(() => remove(id), 3500)
    },
    [remove],
  )

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => {
          const I = ICONS[t.type] || IconInfo
          return (
            <div key={t.id} className={`toast ${t.type}`} role="status">
              <I size={18} />
              <span className="toast-msg">{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

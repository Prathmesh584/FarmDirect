'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error:   <XCircle size={16} />,
  info:    <Info size={16} />,
  warning: <AlertTriangle size={16} />,
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-deep text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-soil text-white',
  warning: 'bg-gold text-soil',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  // Expose globally via window for non-React usage
  useEffect(() => {
    (window as any).__addToast = addToast
  }, [addToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg pointer-events-auto toast-enter ${STYLES[toast.type]}`}
          >
            <span className="flex-shrink-0 mt-0.5">{ICONS[toast.type]}</span>
            <p className="text-sm flex-1 leading-snug">{toast.message}</p>
            <button onClick={() => remove(toast.id)} className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Convenience helper — call from anywhere outside React tree
export function toast(message: string, type: ToastType = 'info') {
  const fn = (window as any).__addToast
  if (fn) fn(message, type)
}

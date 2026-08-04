'use client'

import * as React from "react"
import { X } from "lucide-react"

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full sm:w-auto max-h-[92dvh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ 
  className = "", 
  children,
  onClose,
  ...props 
}) {
  return (
    <div
      className={`relative w-full sm:max-w-lg mx-auto rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 shadow-lg max-h-[92dvh] overflow-y-auto ${className}`}
      {...props}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-10 min-w-10 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>
  )
}

export function DialogHeader({ className = "", children, ...props }) {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props}>
      {children}
    </div>
  )
}

export function DialogTitle({ className = "", children, ...props }) {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>
      {children}
    </h2>
  )
}

export function DialogDescription({ className = "", children, ...props }) {
  return (
    <p className={`text-sm text-gray-500 ${className}`} {...props}>
      {children}
    </p>
  )
}

export function DialogFooter({ className = "", children, ...props }) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 ${className}`} {...props}>
      {children}
    </div>
  )
}

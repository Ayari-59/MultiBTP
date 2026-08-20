"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export const Dialogue = DialogPrimitive.Root
export const DeclencheurDialogue = DialogPrimitive.Trigger
export const FermetureDialogue = DialogPrimitive.Close

export function ContenuDialogue({
  className,
  titre,
  description,
  children,
  large,
}: {
  className?: string
  titre: string
  description?: string
  children: React.ReactNode
  large?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ardoise-950/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-ardoise-200 bg-white shadow-xl",
          large ? "max-w-3xl" : "max-w-lg",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ardoise-200 px-4 py-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-sm font-semibold text-ardoise-900">
              {titre}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-ardoise-500">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="rounded p-1 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700">
            <X className="h-4 w-4" />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>
        </div>
        <div className="defilement-fin min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

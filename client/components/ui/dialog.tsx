"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "data-starting-style:opacity-0 data-ending-style:opacity-0",
        "motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  );
}

interface DialogContentProps extends DialogPrimitive.Popup.Props {
  /** Hide the default top-right close affordance (e.g. blocking flows). */
  hideClose?: boolean;
}

function DialogContent({ className, children, hideClose, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl bg-card p-6 text-card-foreground shadow-2xl shadow-foreground/10 ring-1 ring-foreground/10 outline-none",
          "transition-[scale,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "data-starting-style:scale-[0.97] data-starting-style:opacity-0",
          "data-ending-style:scale-[0.97] data-ending-style:opacity-0",
          "motion-reduce:transition-opacity motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
          className
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-4 top-4 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-6", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground text-pretty", className)}
      {...props}
    />
  );
}

/** Mono eyebrow line matching the app's section-label style. */
function DialogEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-mono text-xs uppercase tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogEyebrow,
};

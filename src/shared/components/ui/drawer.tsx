"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/src/shared/lib/utils";

const Drawer = SheetPrimitive.Root;
const DrawerTrigger = SheetPrimitive.Trigger;
const DrawerClose = SheetPrimitive.Close;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "top" | "bottom" | "left" | "right" }
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "dialog-content fixed z-50 flex flex-col gap-4 border bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out",
        side === "right" && "right-0 top-0 h-full w-3/4 border-l rounded-l-2xl sm:max-w-sm",
        side === "left" && "left-0 top-0 h-full w-3/4 border-r rounded-r-2xl sm:max-w-sm",
        side === "top" && "top-0 left-0 right-0 h-1/2 border-b rounded-b-2xl",
        side === "bottom" && "bottom-0 left-0 right-0 h-1/2 border-t rounded-t-2xl",
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-xl opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2", className)} {...props} />
);

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerClose,
};

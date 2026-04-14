import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const emptyVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      variant: {
        default: "p-8",
        compact: "p-4",
        spacious: "p-12",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Empty({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>) {
  return (
    <div
      data-slot="empty"
      className={cn(emptyVariants({ variant }), className)}
      {...props}
    />
  )
}

function EmptyHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex flex-col items-center gap-2", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "flex items-center justify-center",
  {
    variants: {
      variant: {
        icon: "mb-4",
        image: "mb-4",
      },
      size: {
        default: "h-12 w-12",
        sm: "h-8 w-8",
        lg: "h-16 w-16",
      },
    },
    defaultVariants: {
      variant: "icon",
      size: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-media"
      className={cn(emptyMediaVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function EmptyTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-sm text-muted-foreground max-w-sm", className)}
      {...props}
    />
  )
}

function EmptyContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-6", className)}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
}

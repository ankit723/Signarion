import Link from "next/link"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

type LinkButtonProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>

/** A `next/link` styled as a button. Use for navigation that looks like a CTA. */
function LinkButton({ className, variant, size, ...props }: LinkButtonProps) {
  return (
    <Link
      data-slot="link-button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { LinkButton }

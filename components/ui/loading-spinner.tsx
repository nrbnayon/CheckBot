import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 h-8 w-8", className)} />
  )
}

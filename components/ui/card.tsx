import type * as React from 'react'
import { cn } from '@/lib/utils'

const Card = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='card'
      className={cn(
        'flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='card-header'
      className={cn('flex flex-col gap-1.5 px-2', className)}
      {...props}
    />
  )
}
const CardTitle = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='card-title'
      className={cn('font-semibold leading-none', className)}
      {...props}
    />
  )
}
const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='card-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}
const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div data-slot='card-content' className={cn('', className)} {...props} />
  )
}
const CardFooter = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='card-footer'
      className={cn('flex items-center px-6', className)}
      {...props}
    />
  )
}
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

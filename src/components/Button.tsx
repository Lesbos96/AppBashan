import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary:
    'h-[54px] rounded-button-primary bg-[image:var(--gradient-primary-button)] text-headline text-white shadow-primary-button',
  tinted: 'h-12 rounded-button-secondary bg-tint text-[16px] font-semibold text-accent',
  plain: 'h-12 rounded-button-secondary text-[16px] font-medium text-accent',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: { variant?: keyof typeof variants } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`press w-full px-5 disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

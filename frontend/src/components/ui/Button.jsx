import Spinner from './Spinner'

export default function Button({
  variant = 'primary',
  size,
  loading = false,
  icon = null,
  children,
  className = '',
  disabled,
  ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    !children && icon ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner onPrimary={variant === 'primary' || variant === 'danger'} /> : icon}
      {children}
    </button>
  )
}

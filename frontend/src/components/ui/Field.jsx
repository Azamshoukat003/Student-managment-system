/* Labelled form controls: <Field>, <Input>, <Select>, <Textarea>. */

export { default as Select } from './Select'

export function Field({ label, required, error, help, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error && <span className="field-error">{error}</span>}
      {!error && help && <span className="field-help">{help}</span>}
    </div>
  )
}

export function Input({ invalid, ...rest }) {
  return <input className={`input${invalid ? ' invalid' : ''}`} {...rest} />
}

export function Textarea({ invalid, ...rest }) {
  return <textarea className={`textarea${invalid ? ' invalid' : ''}`} {...rest} />
}

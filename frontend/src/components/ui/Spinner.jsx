export default function Spinner({ onPrimary = false }) {
  return <span className={`spinner${onPrimary ? ' on-primary' : ''}`} role="status" aria-label="Loading" />
}

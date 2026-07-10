import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="page-loading">
      <h1 className="page-title">404</h1>
      <p className="muted">This page could not be found.</p>
      <Link to="/">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </div>
  )
}

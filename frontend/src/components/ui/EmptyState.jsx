import { IconInbox } from '../icons'

export default function EmptyState({ title = 'Nothing here yet', message, icon, action }) {
  const I = icon || IconInbox
  return (
    <div className="empty">
      <I size={34} />
      <div className="empty-title">{title}</div>
      {message && <div className="text-sm">{message}</div>}
      {action}
    </div>
  )
}

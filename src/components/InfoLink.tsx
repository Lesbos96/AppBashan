import { Link } from 'react-router'
import { Icon } from './Icon'

/** Info-Symbol in der Navigationsleiste: öffnet „Wie rechnet MoveNow?". */
export function InfoLink() {
  return (
    <Link to="/profil/preise" aria-label="Wie rechnet MoveNow?" className="press flex size-11 items-center justify-center text-accent">
      <Icon name="info" width={24} height={24} />
    </Link>
  )
}

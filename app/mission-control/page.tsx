import { redirect } from 'next/navigation'

/** Mission Control → terminal OS desk (operational, not conversational). */
export default function MissionControlPage() {
  redirect('/terminal?nav=mission')
}

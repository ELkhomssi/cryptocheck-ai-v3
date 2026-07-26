import { redirect } from 'next/navigation'

/** Phase 15.3 — Mission Control is the terminal default landing. */
export default function MissionControlPage() {
  redirect('/terminal?nav=mission')
}

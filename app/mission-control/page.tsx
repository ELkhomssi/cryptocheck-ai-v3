import { redirect } from 'next/navigation'

/** Mission Control → Terminal OS (Mission Control workspace). */
export default function MissionControlPage() {
  redirect('/terminalOS?nav=mission-control')
}

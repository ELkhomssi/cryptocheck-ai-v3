import { redirect } from 'next/navigation'

/** Legacy Mission Control URL → Portfolio Intelligence (connect wallet). */
export default function MissionControlPage() {
  redirect('/terminal?nav=portfolio')
}

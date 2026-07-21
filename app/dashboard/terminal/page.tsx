import { redirect } from 'next/navigation'

/** Legacy path — canonical terminal lives at /terminal */
export default function LegacyTerminalRedirect() {
  redirect('/terminal')
}

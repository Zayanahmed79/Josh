import { getRecordings } from '../actions'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
    const result = await getRecordings()

    // @ts-ignore
    if (result.error) {
        if (result.error === 'Unauthorized') {
            redirect('/login')
        } else {
            return <DashboardClient initialRecordings={[]} />
        }
    }

    return <DashboardClient initialRecordings={result.data || []} />
}

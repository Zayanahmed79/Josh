'use client'

import { useState } from 'react'
import { login } from '../actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        const res = await login(null, formData)
        if (res?.error) {
            toast.error(res.error)
            setLoading(false)
        } else {
            toast.success('Logged in')
            router.push('/dashboard')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-gray-900 to-black">
            <div className="glass-panel p-8 w-full max-w-md space-y-6">
                <div className="flex flex-col items-center space-y-2">
                    <div className="p-3 bg-white/10 rounded-full">
                        <Lock className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-white">
                        Admin Access
                    </h1>
                </div>

                <form action={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                        <input
                            name="email"
                            type="email"
                            required
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all"
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    )
}

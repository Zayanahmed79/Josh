'use client'

import { useState } from 'react'
import { login } from '../actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Mail, ChevronRight } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        try {
            const res = await login(null, formData)
            if (res?.error) {
                toast.error(res.error)
            } else {
                toast.success('Authentication successful')
                router.push('/dashboard')
            }
        } catch (err) {
            toast.error('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Lock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold leading-9 tracking-tight text-gray-900">
                    Sign in to your account
                </h2>
                <p className="mt-2 text-center text-sm text-gray-500">
                    Access the video management dashboard
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[400px]">
                <div className="card-soft bg-white px-8 py-10">
                    <form action={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                                Email address
                            </label>
                            <div className="mt-2 input-container relative h-11">
                                <div className="input-icon-left">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="name@company.com"
                                    className="input-soft input-with-icon h-full"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                                    Password
                                </label>
                            </div>
                            <div className="mt-2 input-container relative h-11">
                                <div className="input-icon-left">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    placeholder="••••••••"
                                    className="input-soft input-with-icon h-full"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative flex w-full h-11 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-white shadow-md transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Signing in...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Sign in
                                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="mt-10 text-center text-sm text-gray-400">
                    Secure Administrator Portal
                </p>
            </div>
        </div>
    )
}

'use client'

import { useState } from 'react'
import { Copy, Video, Link as LinkIcon, ExternalLink, Play } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Recording {
    id?: number
    name: string
    video_url: string
    created_at?: string
}

export default function DashboardClient({ initialRecordings }: { initialRecordings: Recording[] }) {
    const [recordings] = useState<Recording[]>(initialRecordings)

    const copyGeneralLink = () => {
        const url = `${window.location.origin}/record`
        navigator.clipboard.writeText(url)
        toast.success('Recording page link copied!')
    }

    const copyVideoUrl = (url: string) => {
        navigator.clipboard.writeText(url)
        toast.success('Video URL copied!')
    }

    return (
        <div className="min-h-screen bg-black text-white p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex justify-between items-center glass-panel p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 rounded-lg">
                            <Video className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-white">Admin Dashboard</h1>
                    </div>
                    <button
                        onClick={copyGeneralLink}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-all font-medium shadow-lg shadow-indigo-500/20"
                    >
                        <LinkIcon className="w-4 h-4" />
                        Copy Recording Link
                    </button>
                </header>

                {/* Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recordings.map((rec, i) => (
                        <div key={i} className="glass-panel p-4 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all duration-300">
                            <div className="aspect-video bg-black/50 rounded-lg overflow-hidden relative border border-white/5">
                                <video
                                    src={rec.video_url}
                                    controls
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg">{rec.name}</h3>
                                    <p className="text-sm text-gray-400">
                                        {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : 'Recorded Video'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => copyVideoUrl(rec.video_url)}
                                    className="p-2 hover:bg-indigo-600/20 hover:text-indigo-400 rounded-full transition-colors tooltip"
                                    title="Copy Video URL"
                                >
                                    <Copy className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {recordings.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
                            <div className="p-4 bg-white/5 rounded-full">
                                <Video className="w-12 h-12 opacity-20" />
                            </div>
                            <p>No recordings found. Share the link to get started!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { Copy, Video, Play, Calendar, ExternalLink, Share2, Search, Filter, LogOut, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { logout } from '../actions'
import Link from 'next/link'

interface Recording {
    id?: string
    name: string
    url: string
    created_at?: string
}

export default function DashboardClient({ initialRecordings }: { initialRecordings: Recording[] }) {
    const [recordings] = useState<Recording[]>(initialRecordings)
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    const filteredRecordings = recordings.filter((rec: Recording) =>
        rec.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Pagination Logic
    const itemsPerPage = 6
    const totalPages = Math.ceil(filteredRecordings.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const currentItems = filteredRecordings.slice(startIndex, startIndex + itemsPerPage)

    // Reset to page 1 when searching or if total pages shrink
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages)
        } else if (searchTerm && currentPage > 1 && filteredRecordings.length <= startIndex) {
            setCurrentPage(1)
        }
    }, [searchTerm, totalPages, currentPage, filteredRecordings.length, startIndex])

    const copyGeneralLink = () => {
        const url = `${window.location.origin}/record`
        navigator.clipboard.writeText(url)
        toast.success('Public recording link copied')
    }

    const copyVideoUrl = (url: string) => {
        navigator.clipboard.writeText(url)
        toast.success('Video source URL copied')
    }

    const handleLogout = async () => {
        await logout()
        window.location.href = '/login'
    }

    const [cardSpeeds, setCardSpeeds] = useState<Record<number, number>>({})

    const changeCardSpeed = (index: number, currentRate: number) => {
        const rates = [1, 1.5, 2]
        const nextRate = rates[(rates.indexOf(currentRate) + 1) % rates.length]
        setCardSpeeds(prev => ({ ...prev, [index]: nextRate }))
        toast.success(`Playback speed set to ${nextRate}x`)
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            {/* Refined Brand Navbar */}
            <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-gray-100">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-18 items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                    <Video className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-black uppercase tracking-[0.1em] text-gray-900 leading-none mb-1">Recording Portal</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-green-500"></div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active Dashboard</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={copyGeneralLink}
                                className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl transition-all shadow-lg shadow-primary/10 flex items-center gap-2.5"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Share Hub</span>
                            </button>
                            <div className="w-px h-6 bg-gray-100 mx-1"></div>
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all border border-gray-100"
                                title="Exit"
                            >
                                <LogOut className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Metric Analysis Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                    {[
                        { label: 'Total Library', value: recordings.length, icon: Video, color: 'text-primary', bg: 'bg-primary/5' },
                        { label: 'Upload Success', value: recordings.length, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/5' },
                        { label: 'Activity Date', value: recordings.length > 0 && recordings[0].created_at ? new Date(recordings[0].created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-500/5' }
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-white border border-gray-100 p-6 rounded-2xl flex items-center gap-5 transition-all hover:shadow-xl hover:shadow-black/5">
                            <div className={`w-14 h-14 shrink-0 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-gray-900 tracking-tight">{stat.value}</span>
                                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">Verified</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-10 items-center">
                    <div className="relative flex-1 group w-full">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by respondent name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 bg-white border border-gray-100 rounded-[1rem] pl-12 pr-6 text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                    <button className="h-12 px-6 bg-white border border-gray-100 rounded-[1rem] flex items-center gap-2.5 hover:bg-gray-50 transition-all text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 shadow-sm whitespace-nowrap">
                        <Filter className="w-3.5 h-3.5" />
                        Filters
                    </button>
                </div>

                {/* Grid */}
                {currentItems.length > 0 ? (
                    <div className="space-y-12">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {currentItems.map((rec: Recording, i: number) => (
                                <div
                                    key={i}
                                    className="card-soft bg-white overflow-hidden group cursor-pointer"
                                    onClick={() => window.open(`/v/${rec.id}`, '_blank')}
                                >
                                    <div className="relative aspect-video bg-gray-950">
                                        <video
                                            src={rec.url}
                                            muted
                                            loop
                                            playsInline
                                            onMouseEnter={(e) => {
                                                const v = e.currentTarget;
                                                v.playbackRate = cardSpeeds[i] || 1;
                                                const playPromise = v.play();
                                                if (playPromise !== undefined) {
                                                    playPromise.catch(() => {
                                                        // Fallback if autoplay is blocked
                                                    });
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                const v = e.currentTarget;
                                                v.pause();
                                                v.currentTime = 0;
                                            }}
                                            className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110 pointer-events-none"
                                        />
                                        <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity group-hover:opacity-100 flex flex-col items-center justify-center pointer-events-none">
                                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-3xl flex items-center justify-center border border-white/30 shadow-2xl scale-75 group-hover:scale-100 transition-all duration-500">
                                                <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                                            </div>
                                        </div>
                                        <div className="absolute bottom-3 left-3 flex gap-2">
                                            <div className="rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                                                HD
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5">
                                        <div className="mb-4">
                                            <h3 className="text-xl font-black text-gray-900 truncate lowercase tracking-[0.05em] leading-tight">
                                                {rec.name}
                                            </h3>
                                            <p className="mt-1 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <Calendar className="h-3 w-3" />
                                                {rec.created_at
                                                    ? new Date(rec.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                                    : 'Pending...'}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/v/${rec.id}`}
                                                    target="_blank"
                                                    className="btn-soft-primary flex-1 !text-[11px] !py-3 font-bold uppercase tracking-wider"
                                                >
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Review Recording
                                                </Link>
                                                <button
                                                    onClick={() => {
                                                        const url = `${window.location.origin}/v/${rec.id}`;
                                                        navigator.clipboard.writeText(url);
                                                        toast.success('Hub Link Copied');
                                                    }}
                                                    className="btn-soft-secondary !py-3 !px-3 hover:!bg-primary/5 hover:!text-primary"
                                                    title="Copy Hub Link"
                                                >
                                                    <Share2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(rec.url);
                                                    toast.success('Source URL Copied');
                                                }}
                                                className="text-[9px] text-gray-400 font-bold uppercase tracking-widest hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5 mt-1 border-t border-gray-50 pt-3"
                                            >
                                                <Copy className="h-2.5 w-2.5" />
                                                Direct Video Link
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                            <div className="mt-16 flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="btn-soft-secondary !py-2 !px-4 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>

                                <div className="flex items-center gap-1.5 px-4">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === i + 1
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="btn-soft-secondary !py-2 !px-4 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="card-soft bg-white py-24 px-6 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 mb-6">
                            <Video className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No recordings found</h3>
                        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                            {searchTerm
                                ? `No results for "${searchTerm}". Try another name.`
                                : "Your library is empty. Use the share link to collect new video submissions."}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={copyGeneralLink}
                                className="btn-soft-primary mt-8"
                            >
                                <Share2 className="mr-2 h-4 w-4" />
                                Copy Share Link
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}

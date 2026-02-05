'use client'

import { useState, useEffect } from 'react'
import { Copy, Video, Play, Calendar, ExternalLink, Share2, Search, Filter, LogOut, CheckCircle, Trash2, AlertTriangle, X, RefreshCcw, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { logout, deleteRecording, renewRecording, renewPortal, checkPortalAccess } from '../actions'
import Link from 'next/link'

interface Recording {
    id?: string
    name: string
    url: string
    created_at?: string
    isExpired?: boolean
}

export default function DashboardClient({ initialRecordings }: { initialRecordings: Recording[] }) {
    const [recordings, setRecordings] = useState<Recording[]>(initialRecordings)
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [renewingId, setRenewingId] = useState<string | null>(null)
    const [isRenewingPortal, setIsRenewingPortal] = useState(false)
    const [portalStatus, setPortalStatus] = useState<{ allowed: boolean, expiresAt?: number, activeId?: string } | null>(null)

    useEffect(() => {
        async function fetchStatus() {
            const res = await checkPortalAccess()
            setPortalStatus(res)
        }
        fetchStatus()
    }, [])

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
        if (!portalStatus?.activeId) {
            toast.error('Portal is not active. Please renew first.')
            return
        }
        const url = `${window.location.origin}/record/${portalStatus.activeId}`
        navigator.clipboard.writeText(url)
        toast.success('Public recording link copied')
    }


    const handleLogout = async () => {
        await logout()
        window.location.href = '/login'
    }

    const handleDelete = async () => {
        if (!deletingId) return

        setIsDeleting(true)
        const res = await deleteRecording(deletingId)
        setIsDeleting(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            setRecordings(prev => prev.filter(rec => rec.id !== deletingId))
            toast.success('Recording deleted successfully')
            setDeletingId(null)
        }
    }

    const handleRenew = async (id: string) => {
        setRenewingId(id)
        const res = await renewRecording(id)
        setRenewingId(null)

        if (res.error) {
            toast.error(res.error)
        } else {
            // Replace the old recording with the fresh one in the list
            setRecordings(prev => prev.map(rec =>
                rec.id === id ? { ...res.data, isExpired: false } : rec
            ))
            toast.success('Link renewed successfully!')
        }
    }

    const handleRenewPortal = async () => {
        setIsRenewingPortal(true)
        const res = await renewPortal()
        setIsRenewingPortal(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Public portal link renewed!')
            // Refresh status immediately from the result
            setPortalStatus({ allowed: true, activeId: res.id })
        }
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
            <nav className="sticky top-0 z-100 bg-white/80 backdrop-blur-xl border-b border-gray-100">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-18 items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                    <Video className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold uppercase tracking-widest text-gray-900 leading-none mb-1">Video Manager</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Online</span>
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
                                <span className="text-[10px] font-bold uppercase tracking-widest">Copy Link</span>
                            </button>
                            <div className="w-px h-6 bg-gray-100 mx-1"></div>
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all border border-gray-100"
                                title="Sign Out"
                            >
                                <LogOut className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Metric Analysis Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    {portalStatus === null ? (
                        // Full Card Skeletons for all 4 boxes
                        Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 p-6 rounded-xl flex items-center gap-5 shadow-sm">
                                <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-50 animate-pulse flex items-center justify-center">
                                    <div className="w-6 h-6 bg-gray-100 rounded" />
                                </div>
                                <div className="flex flex-col flex-1 gap-2.5">
                                    <div className="h-3 w-16 bg-gray-50 animate-pulse rounded" />
                                    <div className="h-8 w-24 bg-gray-100 animate-pulse rounded-lg" />
                                </div>
                            </div>
                        ))
                    ) : (
                        [
                            { label: 'Total Videos', value: recordings.length, icon: Video, color: 'text-gray-900', bg: 'bg-gray-100' },
                            { 
                                label: 'Portal Status', 
                                value: portalStatus.allowed ? 'Active' : 'Expired', 
                                icon: Sparkles, 
                                color: portalStatus.allowed ? 'text-green-600' : 'text-amber-600', 
                                bg: portalStatus.allowed ? 'bg-green-50' : 'bg-amber-50', 
                                portal: true 
                            },
                            { label: 'Completed Uploads', value: recordings.length, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Last Activity', value: recordings.length > 0 && recordings[0].created_at ? new Date(recordings[0].created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 p-6 rounded-xl flex items-center gap-5 transition-all shadow-sm hover:shadow-md relative group">
                                <div className={`w-12 h-12 shrink-0 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-none mb-2">{stat.label}</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-semibold text-gray-900 tracking-tight">{stat.value}</span>
                                        {stat.portal && !portalStatus.allowed && (
                                            <button
                                                onClick={handleRenewPortal}
                                                disabled={isRenewingPortal}
                                                className="ml-auto text-xs font-bold text-primary uppercase tracking-wider hover:underline"
                                            >
                                                {isRenewingPortal ? '...' : 'Renew'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center">
                    <div className="relative flex-1 group w-full">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by respondent name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-11 bg-white border border-gray-200 rounded-lg pl-10 pr-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                    <button className="h-11 px-5 bg-white border border-gray-200 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-all text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-gray-900 shadow-sm whitespace-nowrap">
                        <Filter className="w-3.5 h-3.5" />
                        Filters
                    </button>
                </div>

                {/* Grid */}
                {currentItems.length > 0 ? (
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {currentItems.map((rec: Recording, i: number) => (
                                <div
                                    key={i}
                                    className="bg-white border border-gray-200 rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                                    onClick={() => window.open(`/v/${rec.id}`, '_blank')}
                                >
                                    <div className="relative aspect-video bg-gray-900 border-b border-gray-200">
                                        <video
                                            src={rec.url}
                                            preload="metadata"
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
                                            className="h-full w-full object-cover"
                                        />
                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <Play className="h-5 w-5 text-white fill-white ml-0.5 opacity-90" />
                                            </div>
                                        </div>
                                        <div className="absolute bottom-3 left-3 flex gap-2">
                                            <div className="rounded bg-black/70 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                                                HD
                                            </div>
                                            {rec.isExpired && (
                                                <div className="rounded bg-red-600/90 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                                                    Expired
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        <div className="mb-4">
                                            <h3 className="text-base font-semibold text-gray-900 truncate leading-snug">
                                                {rec.name}
                                            </h3>
                                            <p className="mt-1 text-xs text-gray-500 flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3" />
                                                {rec.created_at
                                                    ? new Date(rec.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                                    : 'Pending...'}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-2.5">
                                            {rec.isExpired ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (rec.id) handleRenew(rec.id);
                                                    }}
                                                    disabled={renewingId === rec.id}
                                                    className="w-full h-9 rounded-lg bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center text-xs font-semibold uppercase tracking-wide hover:bg-pink-100 transition-colors"
                                                >
                                                    {renewingId === rec.id ? (
                                                        <RefreshCcw className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                                                    )}
                                                    Renew Link
                                                </button>
                                            ) : (
                                                <Link
                                                    href={`/v/${rec.id}`}
                                                    target="_blank"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full h-9 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-semibold uppercase tracking-wide hover:bg-gray-800 transition-colors shadow-sm"
                                                >
                                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                                    Review
                                                </Link>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const url = `${window.location.origin}/v/${rec.id}`;
                                                        navigator.clipboard.writeText(url);
                                                        toast.success('Link Copied');
                                                    }}
                                                    className="flex-1 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-all text-xs font-semibold uppercase tracking-wide"
                                                    title="Copy Link"
                                                >
                                                    <Share2 className="h-3.5 w-3.5" />
                                                    <span>Copy Link</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (rec.id) setDeletingId(rec.id);
                                                    }}
                                                    className="w-9 h-9 shrink-0 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                            <div className="mt-12 flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Previous
                                </button>

                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${currentPage === i + 1
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl py-20 px-6 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400 mb-5">
                            <Video className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No recordings found</h3>
                        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                            {searchTerm
                                ? `No results for "${searchTerm}".`
                                : "Your library is empty. Copy your unique link to start collecting videos."}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={copyGeneralLink}
                                className="mt-6 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-all inline-flex items-center gap-2 shadow-sm"
                            >
                                <Share2 className="h-4 w-4" />
                                Copy Link
                            </button>
                        )}
                    </div>
                )}
            </main>

            {/* Premium Delete Confirmation Modal */}
            <AnimatePresence>
                {deletingId && (
                    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeletingId(null)}
                            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <button
                                        onClick={() => setDeletingId(null)}
                                        className="text-gray-400 hover:text-gray-500 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Delete Recording?
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Are you sure you want to delete this recording? This action cannot be undone.
                                </p>
                            </div>

                            <div className="p-6 bg-gray-50 flex gap-3 justify-end border-t border-gray-100">
                                <button
                                    onClick={() => setDeletingId(null)}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all shadow-sm disabled:opacity-70"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

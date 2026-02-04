'use client'

import { useState, useRef, useEffect, use } from 'react'
import { getRecording } from '../../actions'
import { Video, Calendar, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Link2, Share2, MoreHorizontal, UserCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function SharedVideoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [recording, setRecording] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [progress, setProgress] = useState(0)
    const [isMuted, setIsMuted] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        async function load() {
            const res = await getRecording(id)
            if (res.error === 'LINK_EXPIRED') {
                setRecording({ expired: true, name: res.data?.name })
            } else if (res.error) {
                toast.error('Failed to load video')
            } else {
                setRecording(res.data)
            }
            setLoading(false)
        }
        load()
    }, [id])

    // Sync audio/speed properties
    useEffect(() => {
        const video = videoRef.current
        if (video) {
            video.muted = isMuted
            video.playbackRate = playbackRate
        }
    }, [isMuted, playbackRate])

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget
        if (video.duration && video.duration !== Infinity) {
            setDuration(video.duration)
        }
    }

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget
        setCurrentTime(video.currentTime)
        if (video.duration && video.duration !== Infinity) {
            setProgress((video.currentTime / video.duration) * 100)
        }
    }

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause()
            else videoRef.current.play()
            setIsPlaying(!isPlaying)
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current && duration && duration !== Infinity) {
            const seekTime = (parseFloat(e.target.value) / 100) * duration
            videoRef.current.currentTime = seekTime
            setProgress(parseFloat(e.target.value))
        }
    }

    const formatTime = (time: number) => {
        if (isNaN(time) || time === Infinity) return '0:00'
        const mins = Math.floor(time / 60)
        const secs = Math.floor(time % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const cycleSpeed = () => {
        if (videoRef.current) {
            const rates = [1, 1.2, 1.5, 1.7, 2]
            const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length
            const newRate = rates[nextIndex]
            videoRef.current.playbackRate = newRate
            setPlaybackRate(newRate)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!recording) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-4 text-center">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-black/5">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Video Not Found</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        We couldn't find the recording you're looking for.
                    </p>
                    <Link href="/" className="text-primary font-medium hover:underline text-sm">
                        Go Home
                    </Link>
                </div>
            </div>
        )
    }

    if (recording.expired) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-4">
                <div className="max-w-md w-full bg-white p-10 rounded-2xl shadow-sm border border-black/5 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{recording.name}</h2>
                    <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                        This video has expired and is no longer available for viewing.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#FDFDFD]">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 md:px-8 border-b border-gray-100 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                        <Video className="w-4 h-4 text-white" fill="currentColor" />
                    </div>
                    <Link href="/" className="font-bold text-gray-900 tracking-tight hover:text-black">LoomClone</Link>
                </div>
                <div className="flex items-center gap-3">
                    <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:scale-105 transition-transform">
                        Sign up for free
                    </button>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-12">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                    {/* Left: Video Player */}
                    <div className="flex-1 min-w-0">
                        <div className="group relative aspect-video bg-black rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5">
                            <video
                                ref={videoRef}
                                src={recording.url}
                                className="w-full h-full object-contain"
                                onLoadedMetadata={handleLoadedMetadata}
                                onTimeUpdate={handleTimeUpdate}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onClick={togglePlay}
                                playsInline
                            />

                            {/* Big Play Button Overlay */}
                            {!isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors cursor-pointer" onClick={togglePlay}>
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transform transition-transform hover:scale-110">
                                        <Play className="w-8 h-8 text-primary fill-primary ml-1" />
                                    </div>
                                </div>
                            )}

                            {/* Controls Bar (Loom Style: Bottom Overlay) */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="flex flex-col gap-2">
                                    {/* Progress Bar */}
                                    <div className="relative h-1 group/seek cursor-pointer">
                                        <div className="absolute inset-0 bg-white/30 rounded-full"></div>
                                        <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={progress || 0}
                                            onChange={handleSeek}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-3">
                                            <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                                                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                                            </button>
                                            <span className="text-xs font-medium text-white tabular-nums">
                                                {formatTime(currentTime)} / {formatTime(duration)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-white">
                                            <button onClick={cycleSpeed} className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-xs font-bold w-12 text-center transition-colors">
                                                {playbackRate}x
                                            </button>
                                            <button onClick={() => videoRef.current?.requestFullscreen()} className="hover:text-primary transition-colors">
                                                <Maximize className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Below Video: Title & Author (Mobile Layout mostly, or desktop details) */}
                        <div className="mt-6 flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-2">{recording.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <UserCircle2 className="w-4 h-4" />
                                    <span>Anonymous • {new Date(recording.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                                    <Share2 className="w-5 h-5" />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Sidebar / Copy Link Panel */}
                    <div className="lg:w-80 flex-shrink-0 flex flex-col gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4">Share this video</h3>

                            <div className="space-y-4">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href)
                                        toast.success('Link copied!')
                                    }}
                                    className="w-full h-10 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <Link2 className="w-4 h-4" />
                                    Copy Link
                                </button>

                                <div className="pt-4 border-t border-gray-100">
                                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                            Anyone with the link
                                        </span>
                                        <button className="text-gray-400 hover:text-gray-600">Change</button>
                                    </div>
                                    <p className="text-xs text-gray-400">Can view this video</p>
                                </div>
                            </div>
                        </div>

                        {/* Transcript Placeholder (Loom style) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 min-h-[200px] flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <span className="text-xl">📄</span>
                            </div>
                            <h4 className="font-bold text-gray-900 text-sm mb-1">Transcript</h4>
                            <p className="text-xs text-gray-400">No transcript available for this video.</p>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}

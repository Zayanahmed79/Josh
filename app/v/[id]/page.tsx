'use client'

import { useState, useRef, useEffect, use } from 'react'
import { getRecording } from '../../actions'
import { Video, Calendar, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, FastForward, CheckCircle2, ArrowLeft, Link2 } from 'lucide-react'
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
            if (res.error) {
                toast.error('Failed to load video')
            } else {
                setRecording(res.data)
            }
            setLoading(false)
        }
        load()
    }, [id])

    // Effect to fix duration issue and handle metadata
    useEffect(() => {
        const video = videoRef.current
        if (!video || !recording) return

        const handleLoadedMetadata = () => {
            if (video.duration === Infinity || isNaN(video.duration)) {
                video.currentTime = 1e101;
                video.ontimeupdate = function () {
                    this.ontimeupdate = () => {
                        setCurrentTime(video.currentTime)
                        if (video.duration && video.duration !== Infinity) {
                            setDuration(video.duration)
                            setProgress((video.currentTime / video.duration) * 100)
                        }
                    }
                    video.currentTime = 0;
                }
            } else {
                setDuration(video.duration)
            }
        }

        const updateProgress = () => {
            setCurrentTime(video.currentTime)
            if (video.duration && video.duration !== Infinity) {
                setDuration(video.duration)
                setProgress((video.currentTime / video.duration) * 100)
            }
        }

        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('timeupdate', updateProgress)

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('timeupdate', updateProgress)
        }
    }, [recording])

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause()
            } else {
                videoRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current && duration && duration !== Infinity) {
            const seekTime = (parseFloat(e.target.value) / 100) * duration
            videoRef.current.currentTime = seekTime
            setProgress(parseFloat(e.target.value))
        }
    }

    const skip = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime += seconds
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
            const rates = [1, 1.5, 2]
            const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length
            const newRate = rates[nextIndex]
            videoRef.current.playbackRate = newRate
            setPlaybackRate(newRate)
            toast.success(`Speed: ${newRate}x`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center animate-pulse">
                        <Video className="w-8 h-8 text-gray-300" />
                    </div>
                </div>
            </div>
        )
    }

    if (!recording) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
                <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mb-8">
                    <Video className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-4xl font-[900] text-gray-900 mb-3 tracking-tight">Not Found</h1>
                <Link href="/" className="btn-soft-primary px-10 py-4 rounded-2xl shadow-xl shadow-primary/20">Go Back Home</Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 h-18 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Dashboard</span>
                        </Link>
                        <div className="h-6 w-px bg-gray-100" />
                        <div className="flex items-center gap-3">
                            <Video className="w-5 h-5 text-primary" />
                            <span className="font-black text-gray-900 tracking-tight text-lg uppercase">PORTAL</span>
                        </div>
                    </div>
                    <Link href="/record" className="hidden sm:flex btn-soft-primary px-8 py-2.5 text-sm font-bold rounded-full hover:scale-105 transition-all">
                        Record New
                    </Link>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 py-8 md:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16">
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        {/* Video Area */}
                        <div className="group/player relative aspect-video bg-[#050505] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-[0_48px_96px_-24px_rgba(0,0,0,0.25)] border border-gray-100 ring-1 ring-black/5">
                            <video
                                ref={videoRef}
                                src={recording.url}
                                className="w-full h-full object-contain cursor-pointer"
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onClick={togglePlay}
                                playsInline
                            />

                            {!isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] pointer-events-none group-hover/player:bg-black/15 transition-all duration-700">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-3xl flex items-center justify-center border border-white/20 shadow-2xl scale-90 group-hover/player:scale-100 transition-all duration-700">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
                                            <Play className="w-4 h-4 md:w-5 md:h-5 text-primary fill-primary ml-1" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/98 via-black/40 to-transparent opacity-0 group-hover/player:opacity-100 transition-all duration-700 transform translate-y-4 group-hover/player:translate-y-0">
                                <div className="flex flex-col gap-3">
                                    <div className="relative group/seek h-3 flex items-center px-1">
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={isNaN(progress) ? 0 : progress}
                                            onChange={handleSeek}
                                            className="absolute inset-0 w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer overflow-hidden accent-primary [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0"
                                        />
                                        <div
                                            className="h-1 bg-primary rounded-full pointer-events-none transition-[width] duration-100 relative"
                                            style={{ width: `${isNaN(progress) ? 0 : progress}%` }}
                                        >
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-2xl ring-2 ring-primary scale-0 group-hover/seek:scale-100 transition-transform duration-200" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 md:gap-8">
                                        <div className="flex items-center gap-4 md:gap-6">
                                            <button onClick={togglePlay} className="text-white hover:scale-125 transition-all h-8 w-8 flex items-center justify-center">
                                                {isPlaying ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white" />}
                                            </button>

                                            <div className="hidden md:flex items-center gap-4">
                                                <button onClick={() => skip(-10)} className="text-white/60 hover:text-white transition-all hover:scale-110 active:scale-90" title="Back 10s">
                                                    <RotateCcw className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => skip(10)} className="text-white/60 hover:text-white transition-all hover:scale-110 active:scale-90" title="Forward 10s">
                                                    <FastForward className="h-5 w-5" />
                                                </button>
                                            </div>

                                            <div className="text-[10px] md:text-sm font-black text-white tabular-nums tracking-[0.1em] uppercase bg-white/5 py-1.5 px-3 rounded-lg border border-white/10 backdrop-blur-md">
                                                {formatTime(currentTime)} <span className="text-white/30 mx-1">|</span> {formatTime(duration)}
                                            </div>
                                        </div>

                                        <div className="flex-1" />

                                        <div className="flex items-center gap-4 md:gap-6">
                                            <button onClick={toggleMute} className="text-white/60 hover:text-white transition-all h-6 w-6 flex items-center justify-center hover:scale-110">
                                                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                            </button>

                                            <button
                                                onClick={cycleSpeed}
                                                className="bg-white/10 hover:bg-white/20 text-white text-[9px] md:text-[10px] font-black px-3 py-1.5 md:px-5 md:py-2 rounded-full border border-white/20 backdrop-blur-2xl transition-all uppercase tracking-[0.2em] whitespace-nowrap"
                                            >
                                                {playbackRate}x Speed
                                            </button>

                                            <button onClick={() => videoRef.current?.requestFullscreen()} className="text-white/60 hover:text-white transition-all hover:scale-125">
                                                <Maximize className="h-5 w-5 md:h-6 md:w-6" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:hidden mt-2 p-2">
                            <h1 className="text-3xl font-[900] text-gray-900 leading-tight mb-3 tracking-tight lowercase">{recording.name}</h1>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">VERIFIED CAPTURE • {new Date(recording.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4">
                        <div className="sticky top-28 flex flex-col gap-10">
                            <div className="hidden lg:block">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="bg-green-50 text-green-600 px-4 py-2 rounded-full text-[11px] font-[900] uppercase tracking-[0.2em] flex items-center gap-2 border border-green-100 shadow-sm shadow-green-600/10">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Verified Recording
                                    </span>
                                </div>
                                <h1 className="text-5xl font-[900] text-gray-900 leading-[1.05] mb-8 tracking-tighter text-balance lowercase">
                                    {recording.name}
                                </h1>
                                <div className="flex flex-col gap-5">
                                    <div className="flex items-center gap-4 p-5 bg-gray-50/70 rounded-[2rem] border border-gray-100 hover:bg-gray-50 transition-all group">
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Publish Date</span>
                                            <span className="text-gray-900 font-extrabold text-base">{new Date(recording.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-5 bg-gray-50/70 rounded-[2rem] border border-gray-100 hover:bg-gray-50 transition-all group">
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <Link2 className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Privacy Status</span>
                                            <span className="text-gray-900 font-extrabold text-base">Private Link Only</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 mx-2" />

                            <div className="flex flex-col gap-5">
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] text-center">Sharing Options</p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.href);
                                            toast.success('Hub Link copied!');
                                        }}
                                        className="btn-soft-primary w-full py-5 font-black text-[12px] uppercase tracking-[0.25em] rounded-[1.5rem] shadow-2xl shadow-primary/30 hover:scale-[1.03] transition-all text-white border-none"
                                    >
                                        Copy Hub Link
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(recording.url);
                                            toast.success('Source URL copied!');
                                        }}
                                        className="btn-soft-secondary w-full py-4 font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.25rem] border-dashed border-2"
                                    >
                                        Copy Source URL
                                    </button>
                                </div>
                                <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-wider px-6 leading-relaxed">
                                    Use the Hub Link for the elite viewing experience.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="mt-32 py-16 flex flex-col items-center gap-6">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center opacity-20 grayscale transition-all duration-700">
                    <Video className="w-5 h-5 text-gray-400" />
                </div>
            </footer>
        </div>
    )
}

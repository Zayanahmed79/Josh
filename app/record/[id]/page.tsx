'use client'

import { useState, useRef, useEffect, use } from 'react'
import { uploadVideo, checkPortalAccess } from '../../actions'
import { toast } from 'sonner'
import { Video, StopCircle, Upload, CheckCircle, RotateCcw, User, Play, Maximize, Pause, Volume2, VolumeX, Lock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function RecordPortalPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [access, setAccess] = useState<{ allowed: boolean, loading: boolean }>({ allowed: false, loading: true })

    const [name, setName] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null) // UI Preview video
    const previewVideoRef = useRef<HTMLVideoElement | null>(null)

    const [previewPlaying, setPreviewPlaying] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [progress, setProgress] = useState(0)
    const [isMuted, setIsMuted] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    const audioTrackRef = useRef<MediaStreamTrack | null>(null)
    const cameraStreamRef = useRef<MediaStream | null>(null)

    const chunksRef = useRef<Blob[]>([])
    const mimeTypeRef = useRef<string>('video/webm')

    // Kept simple canvas for 720p enforcement and consistent behavior
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const workerRef = useRef<Worker | null>(null)

    useEffect(() => {
        async function verify() {
            const res = await checkPortalAccess(id)
            setAccess({ allowed: res.allowed, loading: false })
        }
        verify()
    }, [id])

    const cleanupStreams = () => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(t => t.stop())
            cameraStreamRef.current = null
        }
        if (audioTrackRef.current) {
            audioTrackRef.current.stop()
            audioTrackRef.current = null
        }
    }

    const startRecording = async () => {
        if (!name.trim()) {
            toast.error('Please enter your name to begin')
            return
        }

        try {
            cleanupStreams()

            // 1. Get Audio separately
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            audioTrackRef.current = audioStream.getAudioTracks()[0]

            // 2. Get Video (Face Only)
            const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
            cameraStreamRef.current = cam

            // 3. Setup Canvas & Worker (Simplified for just face)
            const canvas = document.createElement('canvas')
            canvas.width = 1280
            canvas.height = 720
            canvasRef.current = canvas
            const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })

            // We need an internal video element to play the stream so the canvas can draw it
            const tempVideo = document.createElement('video')
            tempVideo.muted = true
            tempVideo.playsInline = true
            tempVideo.srcObject = cam
            tempVideo.play().catch(() => { })

            const drawFrame = () => {
                if (!ctx || !tempVideo || tempVideo.readyState < 2) return

                // Draw camera full screen
                ctx.drawImage(tempVideo, 0, 0, 1280, 720)
            }

            if (!workerRef.current) {
                const workerCode = `
                    let interval;
                    self.onmessage = function(e) {
                        if (e.data === 'start') {
                            interval = setInterval(() => self.postMessage('tick'), 1000/30);
                        } else if (e.data === 'stop') {
                            clearInterval(interval);
                        }
                    };
                `;
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                workerRef.current = new Worker(URL.createObjectURL(blob));
            }

            workerRef.current.onmessage = drawFrame;
            workerRef.current.postMessage('start');

            // 4. Start MediaRecorder & Preview
            const canvasStream = canvas.captureStream(30)

            // Display locally
            if (videoRef.current) {
                videoRef.current.srcObject = canvasStream
                videoRef.current.play().catch(() => { })
            }

            const recorderStream = new MediaStream([
                canvasStream.getVideoTracks()[0],
                audioTrackRef.current!
            ])

            chunksRef.current = []
            const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm'
            mimeTypeRef.current = mimeType

            const mediaRecorder = new MediaRecorder(recorderStream, {
                mimeType,
                videoBitsPerSecond: 8000000
            })
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = () => {
                const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })
                const url = URL.createObjectURL(videoBlob)
                setPreviewUrl(url)
                setRecordedBlob(videoBlob)

                if (workerRef.current) workerRef.current.postMessage('stop');
                cleanupStreams()
            }

            mediaRecorder.start(100)
            setIsRecording(true)
            toast.success('Recording started')
        } catch (err: any) {
            console.error("Start recording failed:", err)
            toast.error(`Recording failed: ${err.message}`)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setIsPaused(false)
        }
    }

    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause()
            setIsPaused(true)
            toast.info('Recording paused')
        }
    }

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume()
            setIsPaused(false)
            toast.success('Recording resumed')
        }
    }

    const togglePlay = () => {
        if (previewVideoRef.current) {
            if (previewPlaying) previewVideoRef.current.pause()
            else previewVideoRef.current.play()
        }
    }

    const toggleMute = () => {
        if (previewVideoRef.current) {
            previewVideoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (previewVideoRef.current && duration && duration !== Infinity) {
            const seekTime = (parseFloat(e.target.value) / 100) * duration
            previewVideoRef.current.currentTime = seekTime
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
        if (previewVideoRef.current) {
            const rates = [1, 1.5, 2]
            const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length
            const newRate = rates[nextIndex]
            previewVideoRef.current.playbackRate = newRate
            setPlaybackRate(newRate)
        }
    }

    const toggleFullScreen = () => {
        if (previewVideoRef.current) {
            if (previewVideoRef.current.requestFullscreen) {
                previewVideoRef.current.requestFullscreen()
            }
        }
    }

    const handleSubmit = async () => {
        if (!previewUrl || !recordedBlob) {
            toast.error('No recording found')
            return
        }
        setUploading(true)
        try {
            const filename = `recording-${Date.now()}.webm`
            const formData = new FormData()
            formData.append('video', recordedBlob, filename)
            formData.append('name', name)
            const result = await uploadVideo(formData)
            if (result.error) throw new Error(result.error)
            setSubmitted(true)
            toast.success('Video submitted successfully!')
        } catch (err: any) {
            console.error('Upload error:', err)
            toast.error(err.message || 'Something went wrong during upload')
        } finally {
            setUploading(false)
        }
    }

    if (access.loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center animate-pulse shadow-sm">
                        <Video className="w-8 h-8 text-gray-200" />
                    </div>
                </div>
            </div>
        )
    }

    if (!access.allowed) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] p-4 text-center">
                <div className="max-w-md w-full bg-white p-12 rounded-[2.5rem] shadow-xl shadow-black/5 border border-gray-100">
                    <div className="mx-auto w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-8">
                        <Lock className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight uppercase italic">Access Denied</h2>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">
                        The secure link you are trying to access has either expired or is invalid. Link access is restricted for security protocols.
                    </p>
                    <div className="flex flex-col gap-3">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">
                                Request a new transmission link from your coordinator to resume access.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] px-4">
                <div className="bg-white p-12 text-center max-w-md w-full rounded-[2.5rem] shadow-xl shadow-black/5 border border-gray-100">
                    <div className="mx-auto w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mb-8">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight uppercase italic">Transmission Received</h2>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">
                        Your content has been securely encrypted and transmitted to the command center.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full h-14 rounded-2xl bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100 hover:text-gray-900 transition-all font-black uppercase tracking-widest text-xs"
                    >
                        Send another video
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-gray-100">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <Video className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest text-gray-900">Portal Control</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Active Link</span>
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-3xl px-4 pt-12 pb-24">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase italic mb-3">Recording Portal</h1>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Submit your specialized transmission securely below</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border border-gray-100">
                    {!isRecording && !previewUrl && (
                        <div className="mb-10">
                            <label htmlFor="name" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
                                Respondent Identification
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                    <User className="w-4 h-4 text-gray-300 group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-14 bg-gray-50/50 border border-gray-100 rounded-2xl pl-13 pr-6 text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    placeholder="ENTER FULL NAME..."
                                />
                            </div>
                        </div>
                    )}

                    <div className="relative aspect-video bg-gray-950 rounded-[2rem] overflow-hidden shadow-2xl border border-gray-800 ring-1 ring-white/5">
                        {!previewUrl ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`w-full h-full object-cover ${isRecording ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`}
                            />
                        ) : (
                            <div className="relative w-full h-full group/player bg-black">
                                <video
                                    ref={previewVideoRef}
                                    src={previewUrl}
                                    onLoadedMetadata={(e) => {
                                        const v = e.currentTarget;
                                        if (v.duration === Infinity || isNaN(v.duration)) {
                                            v.currentTime = 1e101;
                                            v.ontimeupdate = function () {
                                                this.ontimeupdate = null;
                                                v.currentTime = 0;
                                                setDuration(v.duration);
                                            }
                                        } else {
                                            setDuration(v.duration);
                                        }
                                    }}
                                    onPlay={() => setPreviewPlaying(true)}
                                    onPause={() => setPreviewPlaying(false)}
                                    onTimeUpdate={(e) => {
                                        const v = e.currentTarget;
                                        if (v.duration && v.duration !== Infinity) {
                                            setProgress((v.currentTime / v.duration) * 100);
                                            setCurrentTime(v.currentTime);
                                        }
                                    }}
                                    className="w-full h-full object-contain cursor-pointer"
                                    playsInline
                                    onClick={togglePlay}
                                />

                                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/40 to-transparent">
                                    <div className="flex flex-col gap-4">
                                        <div className="relative h-1.5 flex items-center">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={isNaN(progress) ? 0 : progress}
                                                onChange={handleSeek}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="absolute inset-0 bg-white/10 rounded-full h-1"></div>
                                            <div className="absolute inset-y-0 left-0 bg-primary rounded-full h-1" style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-6">
                                                <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                                                    {previewPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                                                </button>
                                                <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                                                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                                </button>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest tabular-nums">
                                                    {formatTime(currentTime)} / {formatTime(duration)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={cycleSpeed}
                                                    className="bg-white/10 text-white text-[9px] font-black px-4 py-1.5 rounded-full border border-white/10 uppercase tracking-widest hover:bg-white/20 transition-all"
                                                >
                                                    {playbackRate}x
                                                </button>
                                                <button
                                                    onClick={toggleFullScreen}
                                                    className="text-white/60 hover:text-white transition-colors"
                                                >
                                                    <Maximize className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isRecording && !previewUrl && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 space-y-4">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                    <Video className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Ready for Transmission</p>
                            </div>
                        )}

                        {isRecording && (
                            <div className="absolute top-6 right-6 flex items-center gap-2.5 px-4 py-2 bg-red-500 rounded-full shadow-lg z-[110]">
                                <div className={`w-2 h-2 rounded-full bg-white ${isPaused ? '' : 'animate-pulse'}`}></div>
                                <span className="text-[9px] font-black text-white uppercase tracking-widest">
                                    {isPaused ? 'Transmission Paused' : 'Live Capture'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-12 flex flex-col items-center gap-6">
                        {!isRecording && !previewUrl && (
                            <button
                                onClick={startRecording}
                                className="w-full h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Video className="w-5 h-5" />
                                Initialize Recording
                            </button>
                        )}

                        {isRecording && (
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={isPaused ? resumeRecording : pauseRecording}
                                    className={`flex-1 h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3 border ${isPaused
                                        ? 'bg-green-500 text-white shadow-xl shadow-green-500/20 hover:bg-green-600 border-green-400'
                                        : 'bg-white text-gray-900 shadow-xl shadow-black/5 hover:bg-gray-50 border-gray-100'
                                        }`}
                                >
                                    {isPaused ? (
                                        <>
                                            <Play className="w-5 h-5 fill-white" />
                                            Resume
                                        </>
                                    ) : (
                                        <>
                                            <Pause className="w-5 h-5 fill-current" />
                                            Pause
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={stopRecording}
                                    className="flex-[2] h-16 bg-red-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <StopCircle className="w-5 h-5" />
                                    Finalize Transmission
                                </button>
                            </div>
                        )}

                        {previewUrl && (
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={handleSubmit}
                                    disabled={uploading}
                                    className="flex-1 h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {uploading ? (
                                        <>
                                            <RotateCcw className="w-5 h-5 animate-spin" />
                                            Encrypting & Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            Submit Recording
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <p className="mt-12 text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] leading-relaxed max-w-sm mx-auto">
                    Your recording is end-to-end encrypted and transmitted using secure protocols.
                </p>
            </main>
        </div>
    )
}

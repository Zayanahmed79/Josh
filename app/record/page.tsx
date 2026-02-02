'use client'

import { useState, useRef } from 'react'
import { uploadVideo } from '../actions'
import { toast } from 'sonner'
import { Video, StopCircle, Upload, CheckCircle, RotateCcw, User, ArrowLeft, Play, Maximize, Pause, Volume2, VolumeX, FastForward, Monitor, Camera } from 'lucide-react'
import Link from 'next/link'

export default function RecordPage() {
    const [name, setName] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [isFaceOverlay, setIsFaceOverlay] = useState(false)
    const [showSourceOptions, setShowSourceOptions] = useState(false)
    const [isSetupMode, setIsSetupMode] = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const previewVideoRef = useRef<HTMLVideoElement | null>(null)
    const [previewPlaying, setPreviewPlaying] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [progress, setProgress] = useState(0)
    const [isMuted, setIsMuted] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const mimeTypeRef = useRef<string>('video/webm')
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const drawIntervalRef = useRef<any>(null)
    const overlayVideoRef = useRef<HTMLVideoElement | null>(null)
    const isFaceOverlayRef = useRef(false)

    const startRecording = async (mode: 'face' | 'screen' | 'both' = 'face') => {
        if (!name.trim()) {
            toast.error('Please enter your name to begin')
            return
        }

        try {
            console.log('Step 1: Requesting base media stream...')
            // Always need audio
            const stream = await navigator.mediaDevices.getUserMedia({
                video: mode === 'face' ? { width: 1280, height: 720 } : false,
                audio: true
            })

            streamRef.current = stream

            // If we are starting with screen, we need display media immediately
            let mainVideoTrack = stream.getVideoTracks()[0]

            if (mode === 'screen' || mode === 'both') {
                console.log('Step 1b: Requesting screen share...')
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'monitor' },
                    audio: false
                })
                mainVideoTrack = screenStream.getVideoTracks()[0]

                // If it's "both", we also need a camera stream for overlay
                if (mode === 'both') {
                    const cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 480, height: 480 },
                        audio: false
                    })
                    if (!overlayVideoRef.current) {
                        overlayVideoRef.current = document.createElement('video')
                        overlayVideoRef.current.muted = true
                        overlayVideoRef.current.playsInline = true
                    }
                    overlayVideoRef.current.srcObject = cameraStream
                    await overlayVideoRef.current.play()
                    setIsFaceOverlay(true)
                    isFaceOverlayRef.current = true
                }

                setIsScreenSharing(true)

                // If screen track ends unexpectedly
                mainVideoTrack.onended = () => {
                    switchToCamera()
                }
            }

            if (videoRef.current) {
                const previewMediaStream = new MediaStream([mainVideoTrack])
                videoRef.current.srcObject = previewMediaStream
                videoRef.current.muted = true
                await videoRef.current.play()
            }

            // Setup Canvas for recording
            const canvas = document.createElement('canvas')
            canvas.width = 1280
            canvas.height = 720
            canvasRef.current = canvas
            const ctx = canvas.getContext('2d')

            const drawFrame = () => {
                if (!ctx) return

                // Clear and Draw Main (Screen or Camera)
                if (videoRef.current) {
                    ctx.drawImage(videoRef.current, 0, 0, 1280, 720)
                }

                // Draw Overlay (Face) if active
                if (isFaceOverlayRef.current && overlayVideoRef.current && overlayVideoRef.current.readyState >= 2) {
                    const size = 280
                    const padding = 40
                    const x = 1280 - size - padding
                    const y = 720 - size - padding

                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
                    ctx.clip()

                    // Center and crop the camera feed in the circle
                    const v = overlayVideoRef.current
                    const sw = v.videoWidth
                    const sh = v.videoHeight
                    const s = Math.min(sw, sh)
                    const sx = (sw - s) / 2
                    const sy = (sh - s) / 2

                    ctx.drawImage(v, sx, sy, s, s, x, y, size, size)

                    // Add a subtle border
                    ctx.restore()
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
                    ctx.lineWidth = 12
                    ctx.stroke()
                    ctx.restore()
                }
            }

            // Use setInterval instead of requestAnimationFrame to be more resilient in background tabs
            drawIntervalRef.current = setInterval(drawFrame, 1000 / 30)

            const canvasStream = canvas.captureStream(30)
            const recorderStream = new MediaStream([
                canvasStream.getVideoTracks()[0],
                stream.getAudioTracks()[0]
            ])

            chunksRef.current = []

            const mimeType = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm'
            ].find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm'

            mimeTypeRef.current = mimeType
            console.log('Selected MIME:', mimeType)

            const mediaRecorder = new MediaRecorder(recorderStream, { mimeType })
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = () => {
                console.log('Finalizing recording...')
                const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })

                if (blob.size === 0) {
                    toast.error('Recording failed - data is empty')
                    return
                }

                console.log('Success - Blob Size:', (blob.size / 1024 / 1024).toFixed(2), 'MB')
                // Use a simpler type for the Blob to improve playback compatibility
                const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })
                const url = URL.createObjectURL(videoBlob)
                setPreviewUrl(url)
                setRecordedBlob(videoBlob)

                // Cleanup
                if (drawIntervalRef.current) {
                    clearInterval(drawIntervalRef.current)
                    drawIntervalRef.current = null
                }
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop())
                    streamRef.current = null
                }
                // Stop overlay camera if active
                if (overlayVideoRef.current && overlayVideoRef.current.srcObject) {
                    const overlayStream = overlayVideoRef.current.srcObject as MediaStream
                    overlayStream.getTracks().forEach(t => t.stop())
                    overlayVideoRef.current.srcObject = null
                }
                // Stop main preview tracks
                if (videoRef.current && videoRef.current.srcObject) {
                    const previewStream = videoRef.current.srcObject as MediaStream
                    previewStream.getTracks().forEach(t => t.stop())
                    videoRef.current.srcObject = null
                }
            }

            mediaRecorder.start(100)
            setIsRecording(true)
            setIsSetupMode(false)
        } catch (err: any) {
            console.error("Start recording failed:", err)
            setIsSetupMode(false)
            toast.error(`Recording failed: ${err.message}`)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setIsScreenSharing(false)
            setIsFaceOverlay(false)
            isFaceOverlayRef.current = false
            setShowSourceOptions(false)
        }
    }

    const startScreenShare = async (withOverlay: boolean) => {
        if (!streamRef.current) return

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: 'monitor' },
                audio: false
            })

            const screenTrack = screenStream.getVideoTracks()[0]

            // Cleanup current preview tracks
            if (videoRef.current && videoRef.current.srcObject) {
                const s = videoRef.current.srcObject as MediaStream
                s.getVideoTracks().forEach(t => t.stop())
            }

            if (withOverlay) {
                // Keep/Start Camera for overlay
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 480, height: 480 },
                    audio: false
                })

                if (!overlayVideoRef.current) {
                    overlayVideoRef.current = document.createElement('video')
                    overlayVideoRef.current.muted = true
                    overlayVideoRef.current.playsInline = true
                }
                overlayVideoRef.current.srcObject = cameraStream
                await overlayVideoRef.current.play()
                setIsFaceOverlay(true)
                isFaceOverlayRef.current = true
            } else {
                setIsFaceOverlay(false)
                isFaceOverlayRef.current = false
            }

            if (videoRef.current) {
                videoRef.current.srcObject = screenStream
                // Crucial: Ensure the video element is playing so canvas can capture it
                await videoRef.current.play().catch(console.error)
            }

            setIsScreenSharing(true)
            setShowSourceOptions(false)

            screenTrack.onended = () => {
                switchToCamera()
            }
        } catch (err: any) {
            console.error("Screen share failed:", err)
            if (err.name !== 'NotAllowedError') {
                toast.error(`Failed to share screen: ${err.message}`)
            }
        }
    }

    const switchSource = () => {
        if (isScreenSharing) {
            switchToCamera()
        } else {
            setShowSourceOptions(!showSourceOptions)
        }
    }

    const switchToCamera = async () => {
        setIsFaceOverlay(false)
        isFaceOverlayRef.current = false
        setShowSourceOptions(false)

        // Stop overlay if active
        if (overlayVideoRef.current && overlayVideoRef.current.srcObject) {
            const s = overlayVideoRef.current.srcObject as MediaStream
            s.getTracks().forEach(t => t.stop())
            overlayVideoRef.current.srcObject = null
        }

        try {
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: false
            })

            // Stop the current video track in the preview (screen)
            if (videoRef.current && videoRef.current.srcObject) {
                const currentStream = videoRef.current.srcObject as MediaStream
                currentStream.getVideoTracks().forEach(t => t.stop())
            }

            if (videoRef.current) {
                videoRef.current.srcObject = cameraStream
                await videoRef.current.play().catch(console.error)
            }

            setIsScreenSharing(false)
        } catch (err: any) {
            console.error("Switch to camera failed:", err)
            toast.error(`Could not regain camera access: ${err.message}`)
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

    const handleSubmit = async () => {
        if (!previewUrl || !recordedBlob) {
            toast.error('No recording found')
            return
        }

        setUploading(true)
        try {
            const mimeType = mimeTypeRef.current
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
            const filename = `recording-${Date.now()}.${extension}`

            console.log('Step 1: Preparing server-side upload...', { filename, size: recordedBlob.size })

            // Create FormData to send to server action
            const formData = new FormData()
            formData.append('video', recordedBlob, filename)
            formData.append('name', name)

            // Call Server Action
            console.log('Step 2: Uploading via Server Action (Boto3-style)...')
            const result = await uploadVideo(formData)

            if (result.error) {
                throw new Error(result.error)
            }

            console.log('Step 3: Upload successful!', result.videoUrl)
            setSubmitted(true)
            toast.success('Video submitted successfully!')
        } catch (err: any) {
            console.error('Upload error:', err)
            toast.error(err.message || 'Something went wrong during upload')
        } finally {
            setUploading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
                <div className="card-soft bg-white p-12 text-center max-w-md w-full">
                    <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Recording Received</h2>
                    <p className="text-gray-500 mb-8 text-lg font-medium leading-relaxed">Your content has been securely encrypted and transmitted to the command center.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-soft-secondary w-full"
                    >
                        Send another video
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b bg-white border-gray-200">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 flex items-center">
                    <Link href="/" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                </div>
            </nav>

            <main className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="h1-soft uppercase tracking-tight">Recording Portal</h1>
                    <p className="p-soft">Submit your specialized message securely below.</p>
                </div>

                <div className="card-soft bg-white p-8">
                    {!isRecording && !previewUrl && (
                        <div className="mb-8">
                            <label htmlFor="name" className="block text-sm font-semibold leading-6 text-gray-900 mb-2">
                                Your Full Name
                            </label>
                            <div className="input-container relative h-11">
                                <div className="input-icon-left">
                                    <User className="h-5 w-5" />
                                </div>
                                <input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="input-soft input-with-icon h-full"
                                    placeholder="Type your name here..."
                                />
                            </div>
                        </div>
                    )}

                    <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-inner border border-gray-800">
                        {!previewUrl ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`w-full h-full object-cover ${!isRecording && !streamRef.current ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
                            />
                        ) : (
                            <div className="relative w-full h-full group/player bg-[#050505]">
                                <video
                                    key={previewUrl}
                                    ref={previewVideoRef}
                                    src={previewUrl}
                                    onPlay={() => setPreviewPlaying(true)}
                                    onPause={() => setPreviewPlaying(false)}
                                    onTimeUpdate={(e) => {
                                        const v = e.currentTarget;
                                        if (v.duration && v.duration !== Infinity) {
                                            setProgress((v.currentTime / v.duration) * 100);
                                            setCurrentTime(v.currentTime);
                                        }
                                    }}
                                    onLoadedMetadata={(e) => {
                                        const v = e.currentTarget;
                                        if (v.duration === Infinity || isNaN(v.duration) || v.duration === 0) {
                                            v.currentTime = 1e101;
                                            v.ontimeupdate = function () {
                                                const vid = this as HTMLVideoElement;
                                                vid.ontimeupdate = null;
                                                vid.currentTime = 0;
                                                if (vid.duration && vid.duration !== Infinity) {
                                                    setDuration(vid.duration);
                                                }
                                            }
                                        } else {
                                            setDuration(v.duration);
                                        }
                                    }}
                                    className="w-full h-full object-contain cursor-pointer"
                                    playsInline
                                    autoPlay
                                    muted={true} // Default to muted for reliable autoplay
                                    onClick={togglePlay}
                                    onError={(e) => {
                                        console.error('Video Error:', e);
                                        toast.error('Playback failed. This can happen if the browser blocks autoplay or the format is incompatible.');
                                    }}
                                />

                                {/* Premium Control Overlay */}
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
                                                    {previewPlaying ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white" />}
                                                </button>

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

                                                <button onClick={() => previewVideoRef.current?.requestFullscreen()} className="text-white/60 hover:text-white transition-all hover:scale-125">
                                                    <Maximize className="h-5 w-5 md:h-6 md:w-6" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {!previewPlaying && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/player:bg-black/5 transition-all duration-700">
                                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-3xl flex items-center justify-center border border-white/20 shadow-2xl scale-90 group-hover/player:scale-100 transition-all duration-700">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center shadow-2xl">
                                                <Play className="w-4 h-4 md:w-5 md:h-5 text-primary fill-primary ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isRecording && !previewUrl && !streamRef.current && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <Video className="w-16 h-16 opacity-20" />
                                <p className="text-sm font-medium">Camera preview will appear here</p>
                            </div>
                        )}

                        {isRecording && (
                            <div className="absolute top-6 right-6 flex items-center gap-3 px-4 py-2 bg-red-500/90 backdrop-blur-sm rounded-full shadow-lg border border-red-400/50 z-20">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                <span className="text-xs font-bold text-white tracking-widest uppercase">Recording</span>
                            </div>
                        )}

                        {isRecording && (
                            <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-2">
                                <button
                                    onClick={switchSource}
                                    className={`flex items-center gap-2.5 px-5 py-2.5 backdrop-blur-3xl rounded-full border transition-all group active:scale-95 shadow-xl ${isScreenSharing
                                        ? 'bg-white/10 hover:bg-white/20 border-white/20'
                                        : 'bg-primary/90 hover:bg-primary border-primary/20'
                                        }`}
                                >
                                    {isScreenSharing ? (
                                        <>
                                            <Camera className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Switch to Face</span>
                                        </>
                                    ) : (
                                        <>
                                            <Monitor className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Screen Options</span>
                                        </>
                                    )}
                                </button>

                                {showSourceOptions && !isScreenSharing && (
                                    <div className="flex flex-col gap-2 p-2 bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <button
                                            onClick={() => startScreenShare(false)}
                                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 rounded-xl transition-all group w-full text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
                                                <Monitor className="w-4 h-4 text-white/70" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-white uppercase tracking-widest leading-none mb-0.5">Screen Only</span>
                                                <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">Pure screen sharing</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => startScreenShare(true)}
                                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 rounded-xl transition-all group w-full text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-all">
                                                <User className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-white uppercase tracking-widest leading-none mb-0.5">Screen + Face</span>
                                                <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">Overlay your camera</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                        {!isRecording && !previewUrl && !isSetupMode && (
                            <button
                                onClick={() => setIsSetupMode(true)}
                                className="btn-soft-primary h-14 px-8 text-lg"
                            >
                                <Video className="mr-2 h-5 w-5" />
                                Start Recording
                            </button>
                        )}

                        {!isRecording && !previewUrl && isSetupMode && (
                            <div className="flex flex-col items-center gap-6 w-full animate-in zoom-in-95 duration-300">
                                <div className="flex flex-wrap justify-center gap-4">
                                    <button
                                        onClick={() => startRecording('face')}
                                        className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-3xl hover:border-primary hover:shadow-2xl hover:shadow-primary/5 transition-all group min-w-[160px]"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <Camera className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[11px] font-black uppercase tracking-widest text-gray-900 leading-none mb-1">Face Only</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Camera focus</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => startRecording('both')}
                                        className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-3xl hover:border-primary hover:shadow-2xl hover:shadow-primary/5 transition-all group min-w-[160px]"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <div className="relative">
                                                <Monitor className="w-6 h-6 text-primary" />
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border-2 border-primary flex items-center justify-center">
                                                    <Camera className="w-2 h-2 text-primary" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[11px] font-black uppercase tracking-widest text-gray-900 leading-none mb-1">Face + Screen</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Overlay active</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => startRecording('screen')}
                                        className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-3xl hover:border-primary hover:shadow-2xl hover:shadow-primary/5 transition-all group min-w-[160px]"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <Monitor className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[11px] font-black uppercase tracking-widest text-gray-900 leading-none mb-1">Screen Only</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Full desktop</span>
                                        </div>
                                    </button>
                                </div>

                                <button
                                    onClick={() => setIsSetupMode(false)}
                                    className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-gray-900 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {isRecording && (
                            <button
                                onClick={stopRecording}
                                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-red-700 active:scale-[0.98]"
                            >
                                <StopCircle className="mr-2 h-6 w-6" />
                                Stop Recording
                            </button>
                        )}

                        {previewUrl && (
                            <>
                                <button
                                    onClick={() => {
                                        setPreviewUrl(null)
                                        setRecordedBlob(null)
                                        chunksRef.current = []
                                        if (streamRef.current) {
                                            streamRef.current.getTracks().forEach(t => t.stop())
                                            streamRef.current = null
                                        }
                                        if (videoRef.current && videoRef.current.srcObject) {
                                            const s = videoRef.current.srcObject as MediaStream
                                            s.getTracks().forEach(t => t.stop())
                                            videoRef.current.srcObject = null
                                        }
                                    }}
                                    disabled={uploading}
                                    className="btn-soft-secondary h-14 px-8 text-lg"
                                >
                                    <RotateCcw className="mr-2 h-5 w-5" />
                                    Redo
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={uploading}
                                    className="btn-soft-primary h-14 px-12 text-lg disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </span>
                                    ) : (
                                        <span className="flex items-center">
                                            <Upload className="mr-2 h-5 w-5" />
                                            Submit Final Video
                                        </span>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <p className="text-center text-xs text-gray-400">
                            By submitting, you agree to our terms of service and privacy policy.
                            Your recording is stored securely in our private cloud.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

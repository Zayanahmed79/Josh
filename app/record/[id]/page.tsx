'use client'

import { useState, useRef, useEffect, use } from 'react'
import { uploadVideo, checkPortalAccess } from '../../actions'
import { toast } from 'sonner'
import { Video, StopCircle, User, Play, Pause, Mic, Monitor, MoreHorizontal, Settings, X, Check, ArrowUpRight, RotateCcw, Send, Trash2 } from 'lucide-react'

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
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [elapsedTime, setElapsedTime] = useState(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const chunksRef = useRef<Blob[]>([])

    useEffect(() => {
        async function verify() {
            const res = await checkPortalAccess(id)
            setAccess({ allowed: res.allowed, loading: false })
        }
        verify()
    }, [id])

    // Effect to handle Stream/Preview binding to the single Video element
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        if (isRecording && streamRef.current) {
            video.src = ''
            video.srcObject = streamRef.current
            video.muted = true
            video.controls = false
            video.play().catch(e => console.error("Live play failed", e))
        } else if (!isRecording && previewUrl) {
            video.srcObject = null
            video.src = previewUrl
            video.muted = false
            video.controls = true
            video.play().catch(e => console.error("Preview play failed", e))
        }
    }, [isRecording, previewUrl])

    // Cleanup function to stop all tracks
    const cleanupStreams = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const handleSubmit = async () => {
        if (!recordedBlob) return

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
            setUploading(false)
        }
    }

    const startRecording = async () => {
        if (!name.trim()) {
            toast.error('Please enter your name to begin')
            return
        }

        try {
            cleanupStreams()
            setElapsedTime(0)
            setPreviewUrl(null)
            setRecordedBlob(null)

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true
            })

            streamRef.current = stream

            // Initialize chunks
            chunksRef.current = []

            const mimeType = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm',
                'video/mp4'
            ].find(type => MediaRecorder.isTypeSupported(type)) || ''

            const options: MediaRecorderOptions = mimeType ? { mimeType, videoBitsPerSecond: 2500000 } : { videoBitsPerSecond: 2500000 }
            const mediaRecorder = new MediaRecorder(stream, options)

            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = () => {
                const blobType = mimeType || 'video/webm'
                const videoBlob = new Blob(chunksRef.current, { type: blobType })
                const url = URL.createObjectURL(videoBlob)

                console.log("Recorder stopped. Blob size:", videoBlob.size, "Type:", blobType)

                setPreviewUrl(url)
                setRecordedBlob(videoBlob)

                // We do NOT cleanup streams here immediately effectively, 
                // because we might want to transition smoothly? 
                // Actually we MUST cleanup the camera stream so the video element can switch to the Blob URL.
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop())
                    streamRef.current = null
                }
            }

            mediaRecorder.start(200) // Collect chunks every 200ms

            // Set state to trigger Effect
            setIsRecording(true)
            setIsPaused(false)

            // Start Timer
            const startTime = Date.now()
            timerRef.current = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
            }, 1000)

            toast.success('Recording started')
        } catch (err: any) {
            console.error("Start recording failed:", err)
            toast.error(`Recording failed: ${err.message}. Check permissions.`)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setIsPaused(false)
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause()
            setIsPaused(true)
            if (timerRef.current) clearInterval(timerRef.current)
            toast.info('Recording paused')
        }
    }

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume()
            setIsPaused(false)
            // Restart timer logic is complex to be perfect, but for simple display:
            // We just need to keep counting. 
            // Simplified: tick every second from current count
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1)
            }, 1000)
            toast.success('Recording resumed')
        }
    }

    const retake = () => {
        setPreviewUrl(null)
        setRecordedBlob(null)
        // Cleanup is already done in onstop, but ensures clean slate
        cleanupStreams()
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (access.loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!access.allowed) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-4 text-center">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-black/5">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="w-6 h-6 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        This recording link is invalid or has expired.
                    </p>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] px-4">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl shadow-black/5 border border-black/5 text-center">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Recording Received</h2>
                    <p className="text-gray-500 mb-8">
                        Your video has been securely uploaded to the portal.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full h-12 rounded-full bg-gray-900 text-white font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                    >
                        Record Another
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
            {/* Minimal Header */}
            <header className="h-16 flex items-center px-6 md:px-12 border-b border-black/5 sticky top-0 bg-white/80 backdrop-blur-sm z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                        <Video className="w-4 h-4 text-white" fill="currentColor" />
                    </div>
                    <span className="font-bold text-gray-900 tracking-tight">Portal</span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        System Online
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-4xl relative flex flex-col gap-6">

                    {/* Main Video Container */}
                    <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-4 ring-black/5 border border-black/10 group">

                        {/* SINGLE PERSISTENT VIDEO ELEMENT */}
                        <video
                            ref={videoRef}
                            playsInline
                            className={`w-full h-full object-contain bg-black transition-opacity duration-300 ${(isRecording || previewUrl) ? 'opacity-100' : 'opacity-0'
                                }`}
                        />

                        {/* Placeholder / Initial State */}
                        {!isRecording && !previewUrl && !uploading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-0">
                                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />
                            </div>
                        )}

                        {/* Idle State / Name Input Overlay */}
                        {!isRecording && !uploading && !previewUrl && (
                            <div className="absolute inset-0 bg-white/5 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-10">
                                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-gray-100 transform transition-all hover:scale-[1.01]">
                                    <div className="mb-6 text-center">
                                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
                                            <Mic className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900">Ready to Record?</h2>
                                        <p className="text-sm text-gray-400 mt-1">Please identify yourself to begin.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Your Name</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="Jane Doe"
                                                    className="w-full h-12 bg-gray-50 border-gray-200 rounded-xl pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={startRecording}
                                            className="w-full h-16 bg-primary hover:bg-primary/90 text-white text-lg font-bold uppercase tracking-wide rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                        >
                                            Start Recording
                                        </button>

                                        <div className="flex items-center justify-center gap-4 pt-2">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <Monitor className="w-3.5 h-3.5" />
                                                Face Only
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Uploading State Overlay */}
                        {uploading && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-20">
                                <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-6"></div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Uploading...</h3>
                                <p className="text-gray-500">Do not close this window.</p>
                            </div>
                        )}

                        {/* Live Recording Controls Overlay */}
                        {isRecording && (
                            <div className="absolute inset-x-0 bottom-0 p-6 flex justify-center items-end pointer-events-none fade-in z-20">
                                {/* Floating Control Bar */}
                                <div className="h-16 px-2 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl flex items-center gap-2 pointer-events-auto transform transition-all hover:scale-105">

                                    {/* TimerPill */}
                                    <div className="pl-4 pr-3 h-full flex items-center gap-2 border-r border-white/10 mr-1">
                                        <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                                        <span className="text-white font-mono font-medium text-sm tabular-nums">
                                            {formatDuration(elapsedTime)}
                                        </span>
                                    </div>

                                    {/* Controls */}
                                    <button
                                        onClick={stopRecording}
                                        className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition-colors group/stop"
                                        title="Finish Recording"
                                    >
                                        <div className="w-4 h-4 bg-red-500 rounded-sm group-hover/stop:rounded-sm transition-all shadow-sm"></div>
                                    </button>

                                    <button
                                        onClick={isPaused ? resumeRecording : pauseRecording}
                                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                                        title={isPaused ? "Resume" : "Pause"}
                                    >
                                        {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview / Review Actions */}
                    {!isRecording && previewUrl && !uploading && (
                        <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 flex flex-col md:flex-row gap-4">
                            <button
                                onClick={retake}
                                className="flex-1 h-16 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-lg uppercase tracking-wide hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3"
                            >
                                <RotateCcw className="w-5 h-5" />
                                Retake
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-[2] h-16 bg-primary text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl shadow-primary/25 hover:bg-primary/90 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Send className="w-6 h-6" />
                                Submit Recording
                            </button>
                        </div>
                    )}

                    {/* Footer / Context */}
                    {!isRecording && !uploading && !previewUrl && (
                        <div className="mt-4 text-center">
                            <p className="text-gray-400 text-sm font-medium">
                                Secured by Video Portal
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

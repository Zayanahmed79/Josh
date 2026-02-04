'use client'

import { useState, useRef, useEffect, use } from 'react'
import { uploadVideo, checkPortalAccess } from '../../actions'
import { toast } from 'sonner'
import { Video, User, Play, Pause, Mic, Monitor, X, Check, Trash2 } from 'lucide-react'

export default function RecordPortalPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [access, setAccess] = useState<{ allowed: boolean, loading: boolean }>({ allowed: false, loading: true })

    const [name, setName] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)

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

    const handleAutoUpload = async (blob: Blob) => {
        if (!blob) return

        setUploading(true)
        setUploadSuccess(false)
        try {
            const filename = `recording-${Date.now()}.webm`
            const formData = new FormData()
            formData.append('video', blob, filename)
            formData.append('name', name || 'Anonymous')
            const result = await uploadVideo(formData)
            
            if (result.error) throw new Error(result.error)
            
            setUploadSuccess(true)
            toast.success('Recording saved to cloud')
        } catch (err: any) {
            console.error('Upload error:', err)
            toast.error(err.message || 'Upload failed, please try again')
        } finally {
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
            setUploadSuccess(false)

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
                
                // Auto Upload Immediately
                handleAutoUpload(videoBlob)

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
        setUploadSuccess(false)
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



    return (
        <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
            {/* Minimal Header */}
            <header className="h-16 flex items-center px-6 md:px-12 border-b border-gray-200 sticky top-0 bg-white/80 backdrop-blur-sm z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white shadow-sm">
                        <Video className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-gray-900 tracking-tight text-sm">Video Portal</span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <div className="px-3 py-1 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1.5 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        Connected
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-4xl relative flex flex-col gap-6">

                    {/* Main Video Container */}
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200 group">

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
                                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white" />
                            </div>
                        )}

                        {/* Idle State / Name Input Overlay */}
                        {!isRecording && !uploading && !previewUrl && (
                            <div className="absolute inset-0 bg-white/30 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-10">
                                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-200">
                                    <div className="mb-8 text-center">
                                        <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                            <Mic className="w-6 h-6 text-gray-900" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-gray-900">Ready to Record?</h2>
                                        <p className="text-sm text-gray-500 mt-2">Enter your name to start the session.</p>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Name</label>
                                            <div className="relative">
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="Enter your full name"
                                                    className="w-full h-11 bg-white border border-gray-300 rounded-lg pl-10 pr-4 text-sm focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all outline-none placeholder:text-gray-400"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={startRecording}
                                            className="w-full h-12 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg shadow-lg shadow-gray-900/10 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                                        >
                                            Start Recording
                                        </button>

                                        <div className="flex items-center justify-center gap-4 pt-1">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <Monitor className="w-3.5 h-3.5" />
                                                Video & Audio
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upload Status Overlay (Non-blocking) */}
                        {(uploading || uploadSuccess) && previewUrl && (
                            <div className="absolute top-4 right-4 z-20 pointer-events-none">
                                <div className={`px-3 py-1.5 rounded-lg backdrop-blur-md border shadow-sm flex items-center gap-2 transition-all ${
                                    uploading 
                                        ? 'bg-white/90 border-blue-200 text-blue-700' 
                                        : 'bg-white/90 border-green-200 text-green-700'
                                }`}>
                                    {uploading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-xs font-semibold">Uploading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span className="text-xs font-semibold">Saved to Cloud</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Live Recording Controls Overlay */}
                        {isRecording && (
                            <div className="absolute inset-x-0 bottom-8 flex justify-center items-end pointer-events-none fade-in z-20">
                                {/* Floating Control Bar */}
                                <div className="h-14 px-5 bg-[#1C1C1E] text-white rounded-xl shadow-xl flex items-center gap-5 pointer-events-auto transition-transform hover:scale-[1.02] border border-white/10">

                                    {/* Timer */}
                                    <div className="flex items-center gap-3 pr-5 border-r border-white/10">
                                        <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                                        <span className="font-mono font-medium text-base tabular-nums tracking-wide">
                                            {formatDuration(elapsedTime)}
                                        </span>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={retake}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                            title="Discard & Restart"
                                        >
                                            <Trash2 className="w-4.5 h-4.5" />
                                        </button>

                                        <button
                                            onClick={isPaused ? resumeRecording : pauseRecording}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all text-white"
                                            title={isPaused ? "Resume" : "Pause"}
                                        >
                                            {isPaused ? <Play className="w-4.5 h-4.5 fill-white" /> : <Pause className="w-4.5 h-4.5 fill-white" />}
                                        </button>

                                        <button
                                            onClick={stopRecording}
                                            className="w-9 h-9 rounded-lg bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/20 active:scale-95 ml-2"
                                            title="Finish Recording"
                                        >
                                            <div className="w-3.5 h-3.5 bg-white rounded-[2px]"></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Post-Recording Actions */}
                    {!isRecording && previewUrl && (
                        <div className="flex justify-center mt-6 animate-in fade-in duration-500">
                             <button
                                onClick={retake}
                                className="text-gray-500 hover:text-red-600 text-sm font-medium flex items-center gap-2 px-5 py-2.5 rounded-lg hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                            >
                                <Trash2 className="w-4 h-4" />
                                Discard & Record New
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

'use client'

import { useState, useRef } from 'react'
import { uploadVideo } from '../actions'
import { toast } from 'sonner'
import { Video, StopCircle, Upload, CheckCircle, RotateCcw, User, ArrowLeft, Play, Maximize, Pause } from 'lucide-react'
import Link from 'next/link'

export default function RecordPage() {
    const [name, setName] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const previewVideoRef = useRef<HTMLVideoElement | null>(null)
    const [previewPlaying, setPreviewPlaying] = useState(false)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const mimeTypeRef = useRef<string>('video/webm')

    const startRecording = async () => {
        if (!name.trim()) {
            toast.error('Please enter your name to begin')
            return
        }

        try {
            console.log('Requesting camera stream...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            })

            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.muted = true
                await videoRef.current.play()
            }

            chunksRef.current = []

            // Simplified MIME selection - often 'video/webm' alone is most stable
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                ? 'video/webm;codecs=vp8,opus'
                : 'video/webm'

            mimeTypeRef.current = mimeType
            console.log('Selected MIME:', mimeType)

            const mediaRecorder = new MediaRecorder(stream, { mimeType })
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
                const url = URL.createObjectURL(blob)
                setPreviewUrl(url)
                setRecordedBlob(blob)

                // Cleanup camera
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop())
                    streamRef.current = null
                }
            }

            // Start with a small slice to ensure the header is captured early
            mediaRecorder.start(100)
            setIsRecording(true)
        } catch (err: any) {
            console.error("Start recording failed:", err)
            toast.error(`Recording failed: ${err.message}`)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
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
                            <div className="relative w-full h-full group/player bg-black/95">
                                <video
                                    key={previewUrl}
                                    ref={previewVideoRef}
                                    src={previewUrl}
                                    onPlay={() => setPreviewPlaying(true)}
                                    onPause={() => setPreviewPlaying(false)}
                                    onLoadedMetadata={(e) => {
                                        const v = e.currentTarget as HTMLVideoElement;
                                        if (v.duration === Infinity || isNaN(v.duration) || v.duration === 0) {
                                            v.currentTime = 999999;
                                            v.ontimeupdate = function () {
                                                const vid = this as HTMLVideoElement;
                                                vid.ontimeupdate = null;
                                                vid.currentTime = 0;
                                            }
                                        }
                                    }}
                                    className="w-full h-full object-contain"
                                    playsInline
                                    autoPlay
                                    muted
                                    onError={() => toast.error('Playback failed. Please redo.')}
                                />

                                {/* Loom-style Controls Overlay */}
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                                    <div className="p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                        <div className="flex items-center gap-4 text-white">
                                            <button
                                                onClick={() => {
                                                    if (previewVideoRef.current) {
                                                        if (previewVideoRef.current.paused) previewVideoRef.current.play();
                                                        else previewVideoRef.current.pause();
                                                    }
                                                }}
                                                className="hover:scale-110 transition-transform"
                                            >
                                                {previewPlaying ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white" />}
                                            </button>

                                            <div className="flex-1" />

                                            <button
                                                onClick={(e) => {
                                                    if (previewVideoRef.current) {
                                                        const rates = [1, 1.5, 2];
                                                        const current = previewVideoRef.current.playbackRate;
                                                        const next = rates[(rates.indexOf(current) + 1) % rates.length];
                                                        previewVideoRef.current.playbackRate = next;
                                                        e.currentTarget.innerText = `${next}x`;
                                                        toast.success(`Speed: ${next}x`);
                                                    }
                                                }}
                                                className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xs font-bold border border-white/10 transition-all min-w-[40px]"
                                            >
                                                1x
                                            </button>

                                            <button
                                                onClick={() => previewVideoRef.current?.requestFullscreen()}
                                            >
                                                <Maximize className="h-5 w-5 hover:text-primary transition-colors" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {!previewPlaying && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/player:bg-black/10 transition-all">
                                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-2xl">
                                            <Play className="h-8 w-8 text-white fill-white ml-1" />
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
                            <div className="absolute top-6 right-6 flex items-center gap-3 px-4 py-2 bg-red-500/90 backdrop-blur-sm rounded-full shadow-lg border border-red-400/50">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                <span className="text-xs font-bold text-white tracking-widest">LIVE</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                        {!isRecording && !previewUrl && (
                            <button
                                onClick={startRecording}
                                className="btn-soft-primary h-14 px-8 text-lg"
                            >
                                <Video className="mr-2 h-5 w-5" />
                                Start Recording
                            </button>
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
                                        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
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

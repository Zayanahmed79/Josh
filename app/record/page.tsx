'use client'

import { useState, useRef } from 'react'
import { getUploadUrl, saveRecording } from '../actions'
import { toast } from 'sonner'
import { Video, StopCircle, Upload, CheckCircle } from 'lucide-react'

export default function RecordPage() {
    const [name, setName] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const mimeTypeRef = useRef<string>('video/webm')

    const startRecording = async () => {
        if (!name.trim()) {
            toast.error('Please enter your name first')
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }

            // Reset chunks
            chunksRef.current = []

            // Try different MIME types in order of preference
            const mimeTypes = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=h264,opus',
                'video/webm',
                'video/mp4'
            ]

            let selectedMimeType = ''
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType
                    console.log('Using MIME type:', mimeType)
                    break
                }
            }

            if (!selectedMimeType) {
                throw new Error('No supported video format found')
            }

            // Store the MIME type for upload
            mimeTypeRef.current = selectedMimeType

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: selectedMimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            })
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data)
                    console.log('Chunk received:', e.data.size, 'bytes')
                }
            }

            mediaRecorder.onstop = () => {
                console.log('Recording stopped, total chunks:', chunksRef.current.length)

                if (chunksRef.current.length === 0) {
                    toast.error('No video data recorded')
                    return
                }

                const blob = new Blob(chunksRef.current, { type: selectedMimeType })
                console.log('Final blob size:', blob.size, 'bytes', 'type:', blob.type)

                if (blob.size === 0) {
                    toast.error('Recording failed - no data captured')
                    return
                }

                const url = URL.createObjectURL(blob)
                setPreviewUrl(url)
                setRecordedBlob(blob)

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())

                // Clear video element
                if (videoRef.current) {
                    videoRef.current.srcObject = null
                }
            }

            mediaRecorder.start(100) // Collect data every 100ms
            setIsRecording(true)
            console.log('Recording started with MIME type:', selectedMimeType)
        } catch (err) {
            console.error(err)
            toast.error('Could not access camera/microphone')
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
            // Determine file extension from MIME type
            const mimeType = mimeTypeRef.current
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
            const filename = `recording-${Date.now()}-${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`

            console.log('Step 1: Uploading with MIME type:', mimeType, 'filename:', filename, 'blob size:', recordedBlob.size)

            // Get Presigned URL
            console.log('Step 2: Getting presigned URL...')
            const uploadUrlResult = await getUploadUrl(filename, mimeType)
            console.log('Step 2 result:', uploadUrlResult)

            if (uploadUrlResult.error || !uploadUrlResult.url) {
                throw new Error(uploadUrlResult.error || 'Failed to get upload URL')
            }

            // Upload to S3
            console.log('Step 3: Uploading to S3...')
            const uploadRes = await fetch(uploadUrlResult.url, {
                method: 'PUT',
                body: recordedBlob,
                headers: {
                    'Content-Type': mimeType
                }
            })

            console.log('Step 3 result:', uploadRes.status, uploadRes.statusText)
            if (!uploadRes.ok) {
                const errorText = await uploadRes.text()
                console.error('S3 upload error:', errorText)
                throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
            }

            // Valid S3 URL (without query params)
            const videoUrl = uploadUrlResult.url.split('?')[0]
            console.log('Step 4: Video URL:', videoUrl)

            // Save to DB
            console.log('Step 5: Saving to database...')
            const saveRes = await saveRecording(name, videoUrl)
            console.log('Step 5 result:', saveRes)

            if (saveRes.error) {
                throw new Error(saveRes.error)
            }

            setSubmitted(true)
            toast.success('Video submitted successfully!')
        } catch (err: any) {
            console.error('Upload error:', err)
            toast.error(err.message || 'Something went wrong')
        } finally {
            setUploading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
                <div className="glass-panel p-8 text-center space-y-4 max-w-md w-full">
                    <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold">Thank You!</h2>
                    <p className="text-gray-400">Your video has been recorded and sent correctly.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        Record Another
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center bg-black text-white p-4 lg:p-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-black to-black">
            <div className="w-full max-w-2xl space-y-6">
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
                        Record Your Video
                    </h1>
                    <p className="text-gray-400">Please enter your name and record your message.</p>
                </div>

                <div className="glass-panel p-6 space-y-6">
                    {/* Name Input */}
                    {!isRecording && !previewUrl && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all placeholder:text-gray-600"
                                placeholder="John Doe"
                            />
                        </div>
                    )}

                    {/* Video Area */}
                    <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-white/10 shadow-2xl">
                        {!previewUrl ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`w-full h-full object-cover ${!isRecording && !streamRef.current ? 'hidden' : ''}`}
                            />
                        ) : (
                            <video
                                src={previewUrl}
                                controls
                                className="w-full h-full object-cover"
                            />
                        )}

                        {!isRecording && !previewUrl && !streamRef.current && (
                            <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 text-gray-500">
                                <Video className="w-12 h-12 opacity-50" />
                                <p>Camera is off</p>
                            </div>
                        )}

                        {isRecording && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-red-500/80 rounded-full animate-pulse">
                                <span className="w-2 h-2 bg-white rounded-full"></span>
                                <span className="text-xs font-bold text-white">RECORDING</span>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center pt-2">
                        {!isRecording && !previewUrl && (
                            <button
                                onClick={startRecording}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-full text-lg font-medium transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
                            >
                                <Video className="w-5 h-5" />
                                Start Recording
                            </button>
                        )}

                        {isRecording && (
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-8 py-3 rounded-full text-lg font-medium transition-all shadow-lg hover:shadow-red-500/25 active:scale-95"
                            >
                                <StopCircle className="w-5 h-5" />
                                Stop Recording
                            </button>
                        )}

                        {previewUrl && (
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => {
                                        setPreviewUrl(null)
                                        setRecordedBlob(null)
                                        chunksRef.current = []
                                        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-medium transition-colors"
                                    disabled={uploading}
                                >
                                    Retake
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={uploading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg font-medium transition-colors shadow-lg hover:shadow-green-500/20"
                                >
                                    {uploading ? (
                                        <>Uploading...</>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            Submit Video
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

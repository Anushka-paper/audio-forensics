import { useState, useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import './App.css'

interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
  translation?: string;
  confidence: number;
}

interface EnsembleScore {
  name: string;
  version: string;
  score: number;
  fpr: string;
}

interface AuthenticityReport {
  deepfake_probability: number;
  ensemble_scores?: EnsembleScore[];
  verdict: string;
  splice_points: any[];
  enf_consistency: string;
}

interface SpeakerVerification {
  target_speaker: string;
  match_probability: number;
  known_identity_db_id: string;
}

interface AcousticProfile {
  environment: string;
  noise_floor_db: number;
  ambient_events: string[];
  signature_hash: number;
}

interface FileData {
  id: number;
  filename: string;
  original_filename: string;
  enhanced_filename?: string;
  is_encrypted?: boolean;
  sha256_hash: string;
  status: string;
  transcript: TranscriptSegment[] | null;
  authenticity_report: AuthenticityReport | null;
  speaker_verification: SpeakerVerification | null;
  acoustic_profile: AcousticProfile | null;
  audit_logs: any[];
}

interface CaseItem {
  id: number;
  filename: string;
  original_filename: string;
  status: string;
  created_at: string;
}

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [fileId, setFileId] = useState<number | null>(null)
  const [fileData, setFileData] = useState<FileData | null>(null)
  const [recentCases, setRecentCases] = useState<CaseItem[]>([])
  const [role, setRole] = useState<string>('officer')
  const [mode, setMode] = useState<string>('cosmetic')
  const [language, setLanguage] = useState<string>('hi-IN')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [crossReferences, setCrossReferences] = useState<any[]>([])
  
  const originalWaveformRef = useRef<HTMLDivElement>(null)
  const enhancedWaveformRef = useRef<HTMLDivElement>(null)
  const originalWavesurferRef = useRef<WaveSurfer | null>(null)
  const enhancedWavesurferRef = useRef<WaveSurfer | null>(null)

  const fetchRecentCases = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/cases`)
      const data = await response.json()
      setRecentCases(data)
    } catch (e) {
      console.error('Failed to fetch cases', e)
    }
  }

  useEffect(() => {
    fetchRecentCases()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    
    setUploadStatus(`Uploading ${files.length} file(s)...`)
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('mode', mode)
    formData.append('language', language)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/batch-upload`, {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      setUploadStatus(`Success: ${data.message}`)
      
      // Select the first uploaded file automatically for viewing
      if (data.files && data.files.length > 0) {
        setFileId(data.files[0].id)
      }
      fetchRecentCases()
      setFiles([]) // clear queue
    } catch (error) {
      setUploadStatus('Error uploading files')
      console.error(error)
    }
  }

  // Poll for status
  useEffect(() => {
    if (!fileId) return;

    const interval = setInterval(async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/file/${fileId}`)
        const data = await response.json()
        setFileData(data)
        
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval)
          fetchRecentCases()
          
          if (data.status === 'completed' && data.acoustic_profile) {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            fetch(`${apiUrl}/api/cross-reference/${fileId}`)
              .then(res => res.json())
              .then(crData => setCrossReferences(crData.matches || []))
              .catch(e => console.error(e))
          }
        }
      } catch (e) {
        console.error(e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [fileId])

  // Initialize wavesurfer when audio is ready
  useEffect(() => {
    let wsOriginal: any = null;
    let wsEnhanced: any = null;

    if (fileData?.status === 'completed') {
      if (originalWaveformRef.current) {
        wsOriginal = WaveSurfer.create({
          container: originalWaveformRef.current,
          waveColor: '#64748b', // slate-500
          progressColor: '#94a3b8', // slate-400
          cursorColor: '#cbd5e1',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          url: `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/audio/${fileData.filename}`
        })
        originalWavesurferRef.current = wsOriginal
      }
      
      if (fileData.enhanced_filename && enhancedWaveformRef.current) {
        wsEnhanced = WaveSurfer.create({
          container: enhancedWaveformRef.current,
          waveColor: '#4f46e5', // indigo-600
          progressColor: '#818cf8', // indigo-400
          cursorColor: '#c7d2fe',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          url: `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/audio/${fileData.enhanced_filename}`
        })
        enhancedWavesurferRef.current = wsEnhanced
      }
    }
    
    return () => {
      if (wsOriginal) wsOriginal.destroy()
      if (wsEnhanced) wsEnhanced.destroy()
      originalWavesurferRef.current = null
      enhancedWavesurferRef.current = null
    }
  }, [fileData?.status, fileData?.filename, fileData?.enhanced_filename])

  const togglePlaybackOriginal = () => {
    if (originalWavesurferRef.current) {
      if (enhancedWavesurferRef.current) enhancedWavesurferRef.current.pause()
      originalWavesurferRef.current.playPause()
    }
  }

  const togglePlaybackEnhanced = () => {
    if (enhancedWavesurferRef.current) {
      if (originalWavesurferRef.current) originalWavesurferRef.current.pause()
      enhancedWavesurferRef.current.playPause()
    }
  }

  const exportReport = () => {
    if (!fileData) return;
    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BAFT_Report_${fileData.sha256_hash.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const loadCase = (id: number) => {
    setFileId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteCase = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent loadCase from firing
    if (!confirm('Are you sure you want to delete this case?')) return
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await fetch(`${apiUrl}/api/file/${id}`, { method: 'DELETE' })
      if (fileId === id) {
        setFileId(null)
        setFileData(null)
      }
      fetchRecentCases()
    } catch (error) {
      console.error('Failed to delete case', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-8 print:bg-white print:text-black print:p-0">
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-end print:hidden">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
            Audio-forensics
          </h1>
          <p className="text-slate-400">Offline-first audio enhancement, transcription & authenticity verification.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700">
          <label className="text-sm text-slate-400">Simulated Role:</label>
          <select 
            className="bg-slate-700 text-white text-sm rounded p-1 border border-slate-600 outline-none"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="officer">Investigating Officer</option>
            <option value="examiner">Forensic Examiner</option>
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 print:block print:w-full print:max-w-none">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-slate-800 rounded-xl p-8 shadow-xl border border-slate-700 print:hidden">
            <h2 className="text-2xl font-semibold mb-6 text-white flex items-center justify-between">
              <span>Batch Upload Evidence</span>
              {fileData?.is_encrypted && (
                <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded flex items-center gap-1 border border-emerald-700">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  AES-256 Encrypted Storage
                </span>
              )}
            </h2>
            
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Enhancement Mode</label>
                  <select value={mode} onChange={e => setMode(e.target.value)} className="w-full bg-slate-700 text-white rounded p-2 border border-slate-600">
                    <option value="cosmetic">Cosmetic (For Listening)</option>
                    <option value="forensic">Forensic (Non-Destructive)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Target Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-700 text-white rounded p-2 border border-slate-600">
                    <option value="hi-IN">Hindi (hi-IN)</option>
                    <option value="en-IN">English India (en-IN)</option>
                    <option value="ta-IN">Tamil (ta-IN)</option>
                    <option value="te-IN">Telugu (te-IN)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-700/50 hover:bg-slate-700 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Click to upload files</span> or drag and drop</p>
                    <p className="text-xs text-slate-500">WAV, MP3, M4A (Select multiple)</p>
                  </div>
                  <input id="dropzone-file" type="file" className="hidden" accept="audio/*" multiple onChange={handleFileChange} />
                </label>
              </div>
              
              {files.length > 0 && (
                <div className="bg-slate-700 p-4 rounded-lg flex flex-col space-y-2">
                  <div className="text-sm font-medium border-b border-slate-600 pb-2 mb-1">{files.length} file(s) selected:</div>
                  {files.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="truncate pr-4">{f.name}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{(f.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}
              
              <button 
                onClick={handleUpload}
                disabled={files.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Secure Batch Upload & Process
              </button>
              
              {uploadStatus && (
                <div className="mt-4 p-4 rounded-lg bg-slate-700/80 text-sm border-l-4 border-indigo-500 break-all">
                  {uploadStatus}
                </div>
              )}
            </div>
          </section>
          
          <section className={`bg-slate-800 rounded-xl p-8 shadow-xl border border-slate-700 transition-opacity ${!fileData ? 'opacity-50' : 'opacity-100'} print:shadow-none print:border-none print:p-0`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center gap-4 print:text-black">
                <span>Audio Viewer & Transcript</span>
                <span className={`text-xs font-normal px-2 py-1 rounded text-white ${fileData?.status === 'processing' ? 'bg-yellow-500' : fileData?.status === 'completed' ? 'bg-green-500' : 'bg-slate-700'} print:text-black print:border print:border-black print:bg-white`}>
                  {fileData ? fileData.status.toUpperCase() : 'Awaiting processing...'}
                </span>
              </h2>
              <div className="flex gap-2 print:hidden">
                {fileData?.status === 'completed' && (
                  <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                    Print Case Report
                  </button>
                )}
                {fileData?.status === 'completed' && (
                  <button onClick={exportReport} className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Export JSON
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-6">
              
              {/* Speaker Verification (Gated to Examiner) */}
              {fileData?.speaker_verification && role === 'examiner' && (
                <div className="bg-indigo-900/30 rounded-lg p-5 border border-indigo-500/30 flex items-center justify-between">
                  <div>
                    <h4 className="text-indigo-400 font-bold mb-1 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                      Speaker Database Match Found
                    </h4>
                    <p className="text-sm text-slate-300">
                      Primary speaker matched with known identity: <span className="font-mono text-indigo-300 bg-indigo-900/50 px-1 rounded">{fileData.speaker_verification.known_identity_db_id}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-indigo-400">{(fileData.speaker_verification.match_probability * 100).toFixed(1)}%</span>
                    <p className="text-xs text-indigo-500/70 uppercase font-bold tracking-wider">Confidence</p>
                  </div>
                </div>
              )}

              {/* Authenticity Report Banner */}
              {fileData?.authenticity_report && (
                <div className="bg-slate-900 rounded-lg p-5 border border-slate-700 print:border-black print:bg-white print:text-black">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 print:text-gray-600">Authenticity Verdict</h4>
                      <span className={`px-2 py-1 text-xs rounded-full font-bold ${fileData.authenticity_report.verdict === 'Likely Authentic' ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'} print:bg-white print:text-black print:border print:border-black`}>
                        {fileData.authenticity_report.verdict}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 print:text-gray-600">ENF Analysis</h4>
                      <span className="text-sm font-medium text-slate-300 print:text-black">{fileData.authenticity_report.enf_consistency}</span>
                    </div>
                    <div>
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 print:text-gray-600">Splice Points</h4>
                      <span className="text-sm font-medium text-slate-300 print:text-black">{fileData.authenticity_report.splice_points.length} detected</span>
                    </div>
                  </div>
                  
                  {fileData.authenticity_report.ensemble_scores && (
                    <div className="mt-4 border-t border-slate-700 pt-4 print:border-black">
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 print:text-gray-600">Multi-Model Ensemble Consensus (Deepfake Det.)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {fileData.authenticity_report.ensemble_scores.map((model, idx) => (
                          <div key={idx} className="bg-slate-800 p-2 rounded border border-slate-700 flex justify-between items-center print:bg-white print:border-black">
                            <div>
                              <div className="text-sm font-bold">{model.name} <span className="text-[10px] text-slate-500 font-normal">({model.version})</span></div>
                              <div className="text-[10px] text-slate-400">FPR: {model.fpr}</div>
                            </div>
                            <div className="text-right">
                              <span className={`font-mono font-bold ${(model.score > 0.3) ? 'text-red-400' : 'text-emerald-400'} print:text-black`}>
                                {(model.score * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Environmental Acoustics Report */}
              {fileData?.acoustic_profile && (
                <div className="bg-slate-900 rounded-lg p-5 border border-slate-700 print:border-black print:bg-white print:text-black">
                  <h3 className="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2 mb-4 print:text-black print:border-black flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Environmental Acoustics Profile
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 print:text-gray-600">Environment</h4>
                      <span className="text-sm font-medium text-blue-300 print:text-black">{fileData.acoustic_profile.environment}</span>
                    </div>
                    <div>
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 print:text-gray-600">Noise Floor</h4>
                      <span className="text-sm font-medium text-slate-300 print:text-black">{fileData.acoustic_profile.noise_floor_db} dB</span>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 print:text-gray-600">Ambient Events</h4>
                      <div className="flex flex-wrap gap-1">
                        {fileData.acoustic_profile.ambient_events.map((evt, idx) => (
                          <span key={idx} className="px-2 py-0.5 text-[10px] bg-slate-800 border border-slate-600 rounded text-slate-300 print:bg-white print:border-black print:text-black">{evt}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 print:hidden">
                {fileData?.status === 'completed' ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Original Audio</h4>
                      <div ref={originalWaveformRef} className="w-full mb-2"></div>
                      <div className="flex justify-center">
                        <button onClick={togglePlaybackOriginal} className="bg-slate-700 p-2 rounded-full hover:bg-slate-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                        </button>
                      </div>
                    </div>
                    
                    {fileData.enhanced_filename && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Enhanced Audio (Noise Removed)</h4>
                        <div ref={enhancedWaveformRef} className="w-full mb-2"></div>
                        <div className="flex justify-center">
                          <button onClick={togglePlaybackEnhanced} className="bg-indigo-600 p-2 rounded-full hover:bg-indigo-500">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center">
                    <span className="text-slate-500">Waveform visualization will appear here upon completion</span>
                  </div>
                )}
              </div>
              
              {fileData && fileData.transcript && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-300 border-b border-slate-700 pb-2 print:text-black print:border-black">Diarized Transcript & Translation</h3>
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 max-h-96 overflow-y-auto print:max-h-none print:bg-white print:border-none print:p-0">
                    {fileData.transcript.map((seg, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="flex items-baseline space-x-2 mb-1">
                          <span className={`font-bold text-sm ${seg.speaker === 'SPEAKER_01' ? 'text-blue-400' : 'text-purple-400'} print:text-black`}>{seg.speaker}</span>
                          <span className="text-xs text-slate-500">[{seg.start}s - {seg.end}s]</span>
                          <span className={`text-[10px] px-1 rounded ml-auto ${seg.confidence < 0.85 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50' : 'text-slate-500'} print:text-black print:border-none print:bg-transparent`}>
                            Conf: {(seg.confidence * 100).toFixed(0)}% {seg.confidence < 0.85 && '⚠ Review'}
                          </span>
                        </div>
                        <p className="text-slate-300 mb-1 print:text-black">{seg.text}</p>
                        {seg.translation && (
                          <p className="text-slate-400 text-sm border-l-2 border-slate-600 pl-3 italic print:text-gray-700 print:border-gray-400">
                            "{seg.translation}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {fileData && fileData.audit_logs && (
                <div className="mt-8 print:mt-12 print:break-before-page">
                   <h3 className="text-sm font-medium text-slate-400 mb-2 print:text-black font-bold border-b print:border-black pb-1">Chain of Custody Logs</h3>
                   <ul className="text-xs text-slate-500 space-y-1 bg-slate-900 p-3 rounded font-mono print:bg-white print:text-black print:p-0">
                     {fileData.audit_logs.map((log, i) => (
                       <li key={i}>[{new Date(log.timestamp).toISOString()}] {log.action.toUpperCase()}: {log.details}</li>
                     ))}
                   </ul>
                </div>
              )}
            </div>
          </section>
        </div>
        
        {/* Sidebar: Case Management / Recent Cases */}
        <div className="space-y-8 print:hidden">
          {/* Cross-Reference Panel */}
          {crossReferences.length > 0 && (
            <section className="bg-orange-900/30 rounded-xl p-6 shadow-xl border border-orange-500/50">
              <h2 className="text-lg font-bold mb-3 text-orange-400 flex items-center gap-2 border-b border-orange-500/30 pb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                Cross-File Consistency Match
              </h2>
              <p className="text-xs text-orange-200/70 mb-3">
                This file shares an identical acoustic fingerprint with {crossReferences.length} other case(s) in the database.
              </p>
              <ul className="space-y-2">
                {crossReferences.map((ref, idx) => (
                  <li key={idx} className="bg-orange-950/50 p-2 rounded border border-orange-800/50 cursor-pointer hover:bg-orange-900/50 transition-colors" onClick={() => loadCase(ref.id)}>
                    <div className="text-sm text-orange-300 font-medium truncate">{ref.original_filename}</div>
                    <div className="text-[10px] text-orange-400/70 mt-1">{ref.match_reason}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 h-full max-h-[800px] flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-white border-b border-slate-700 pb-2">Recent Cases</h2>
            
            <input 
              type="text" 
              placeholder="Search by filename or status..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 text-white border border-slate-700 rounded p-2 text-sm mb-4"
            />
            
            <div className="flex-1 overflow-y-auto">
            {recentCases.filter(c => c.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) || c.status.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No cases match search.</p>
            ) : (
              <ul className="space-y-3">
                {recentCases
                  .filter(c => c.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) || c.status.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(c => (
                  <li 
                    key={c.id} 
                    onClick={() => loadCase(c.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${fileId === c.id ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium text-slate-200 truncate pr-2" title={c.original_filename}>{c.original_filename}</p>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${c.status === 'completed' ? 'bg-green-900 text-green-400' : c.status === 'processing' ? 'bg-yellow-900 text-yellow-400' : 'bg-slate-600 text-slate-300'}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</p>
                      <button onClick={(e) => deleteCase(c.id, e)} className="text-xs text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50 px-2 py-1 rounded">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App

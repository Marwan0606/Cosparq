/**
 * Voice Manager for AI Co-Founder
 * 
 * Handles:
 * - Speech recognition (Web Speech API)
 * - Text-to-speech playback (OpenAI TTS or ElevenLabs via backend)
 * - Audio level analysis for orb visualization
 */

class VoiceManager {
  constructor(options = {}) {
    this.onTranscript = options.onTranscript || (() => {});
    this.onSpeechStart = options.onSpeechStart || (() => {});
    this.onSpeechEnd = options.onSpeechEnd || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {});
    this.onError = options.onError || console.error;
    this.onListeningChange = options.onListeningChange || (() => {});
    this.onUserSpeechDetected = options.onUserSpeechDetected || (() => {});

    // TTS Provider: 'openai' (default, faster, cheaper) or 'elevenlabs' (higher quality, more expensive)
    this.ttsProvider = options.ttsProvider || 'openai';
    this.elevenLabsVoiceId = options.elevenLabsVoiceId || null; // Use default if not specified

    // Speech recognition
    this.recognition = null;
    this.isListening = false;
    this.shouldContinueListening = false;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.userIsSpeaking = false;
    
    // Silence timeout - wait before sending transcript
    this.silenceTimeout = null;
    this.silenceDelay = 1200; // Wait 1.2 seconds of silence before considering speech done
    this.pendingTranscript = '';

    // Audio playback
    this.audioContext = null;
    this.analyser = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;

    // Audio level analysis
    this.levelCheckInterval = null;

    // Initialize
    this.initSpeechRecognition();
  }

  /**
   * Set the TTS provider
   * @param {string} provider - 'openai' or 'elevenlabs'
   */
  setTTSProvider(provider) {
    if (provider === 'openai' || provider === 'elevenlabs') {
      this.ttsProvider = provider;
      console.log(`[VoiceManager] TTS provider set to: ${provider}`);
    } else {
      console.warn(`[VoiceManager] Unknown TTS provider: ${provider}`);
    }
  }

  /**
   * Set the ElevenLabs voice ID
   * @param {string} voiceId - ElevenLabs voice ID
   */
  setElevenLabsVoice(voiceId) {
    this.elevenLabsVoiceId = voiceId;
    console.log(`[VoiceManager] ElevenLabs voice set to: ${voiceId}`);
  }

  /**
   * Get current TTS provider
   */
  getTTSProvider() {
    return this.ttsProvider;
  }

  /**
   * Initialize Web Speech API
   */
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onListeningChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onListeningChange(false);
      
      // Auto-restart if we should continue listening
      if (this.shouldContinueListening && !this.isPlaying) {
        setTimeout(() => {
          if (this.shouldContinueListening && !this.isPlaying) {
            this.startListening();
          }
        }, 100);
      }
    };

    // Detect when ANY audio starts (fires before speechstart - ultra sensitive)
    this.recognition.onaudiostart = () => {
      console.log('[VoiceManager] Audio input detected!');
    };

    // Detect when user starts making sound (speechstart event)
    this.recognition.onspeechstart = () => {
      console.log('[VoiceManager] User speech detected - interrupting immediately!');
      this.userIsSpeaking = true;
      this.onUserSpeechDetected();
    };

    this.recognition.onspeechend = () => {
      console.log('[VoiceManager] User speech ended');
      this.userIsSpeaking = false;
    };

    this.recognition.onresult = (event) => {
      this.interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        // Immediately notify when we get ANY speech (interim or final)
        // This helps interrupt the AI faster
        if (!this.userIsSpeaking && transcript.trim().length > 0) {
          this.userIsSpeaking = true;
          this.onUserSpeechDetected();
        }
        
        if (event.results[i].isFinal) {
          // Accumulate final transcripts
          this.pendingTranscript += (this.pendingTranscript ? ' ' : '') + transcript.trim();
          
          // Clear any existing timeout
          if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
          }
          
          // Set a new timeout - only send after silence
          this.silenceTimeout = setTimeout(() => {
            if (this.pendingTranscript.trim()) {
              console.log('[VoiceManager] Silence timeout - sending transcript:', this.pendingTranscript);
              this.userIsSpeaking = false;
              this.onTranscript(this.pendingTranscript.trim(), true);
              this.pendingTranscript = '';
            }
          }, this.silenceDelay);
          
          // Also show interim updates
          this.onTranscript(this.pendingTranscript.trim(), false);
        } else {
          // Show interim with any pending
          const fullInterim = this.pendingTranscript + (this.pendingTranscript ? ' ' : '') + transcript;
          this.interimTranscript = transcript;
          this.onTranscript(fullInterim.trim(), false);
        }
      }
    };

    this.recognition.onerror = (event) => {
      this.userIsSpeaking = false;
      if (event.error === 'no-speech') {
        // Ignore no-speech errors, just keep listening
        return;
      }
      if (event.error === 'aborted') {
        // Ignore aborted (happens when we stop intentionally)
        return;
      }
      console.error('Speech recognition error:', event.error);
      this.onError(event.error);
    };
  }

  /**
   * Start listening for speech
   */
  startListening() {
    if (!this.recognition) {
      this.onError('Speech recognition not available');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.shouldContinueListening = true;
      this.finalTranscript = '';
      this.interimTranscript = '';
      this.recognition.start();
      return true;
    } catch (error) {
      // Already started
      if (error.message?.includes('already started')) {
        return true;
      }
      console.error('Error starting recognition:', error);
      return false;
    }
  }

  /**
   * Stop listening for speech
   */
  stopListening() {
    this.shouldContinueListening = false;
    
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    
    this.isListening = false;
    this.onListeningChange(false);
  }

  /**
   * Pause listening (e.g., while AI is speaking)
   */
  pauseListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        // Ignore
      }
    }
  }

  /**
   * Resume listening after pause
   */
  resumeListening() {
    if (this.shouldContinueListening && !this.isPlaying) {
      this.startListening();
    }
  }

  /**
   * Initialize audio context for playback analysis
   */
  initAudioContext() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }

  /**
   * Speak text using the configured TTS provider (OpenAI or ElevenLabs)
   */
  async speak(text, sessionId = null) {
    if (!text) {
      console.log('[VoiceManager] No text to speak');
      return;
    }

    console.log(`[VoiceManager] Speaking with ${this.ttsProvider}:`, text.substring(0, 50) + '...');

    // STOP listening while AI speaks to prevent feedback loop
    // (AI hearing itself and getting stuck in a loop)
    this.pauseListening();
    
    this.initAudioContext();
    this.onSpeechStart();

    try {
      const token = localStorage.getItem('accessToken');
      
      // Choose endpoint based on provider
      const endpoint = this.ttsProvider === 'elevenlabs' 
        ? '/api/cofounder/tts-elevenlabs' 
        : '/api/cofounder/tts';
      
      const body = this.ttsProvider === 'elevenlabs' && this.elevenLabsVoiceId
        ? JSON.stringify({ text, voiceId: this.elevenLabsVoiceId })
        : JSON.stringify({ text });

      console.log(`[VoiceManager] Fetching TTS audio from ${endpoint}...`);
      
      // Fetch TTS audio from backend
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VoiceManager] TTS request failed:', response.status, errorText);
        throw new Error('TTS request failed: ' + response.status);
      }

      console.log('[VoiceManager] Got TTS response, creating audio...');
      
      // Create blob and play immediately
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('[VoiceManager] Playing audio immediately...');
      await this.playAudio(audioUrl);
      
      URL.revokeObjectURL(audioUrl);
      console.log('[VoiceManager] Audio finished playing');

    } catch (error) {
      console.error('[VoiceManager] Error with TTS:', error);
      this.onError('Failed to generate speech');
    } finally {
      this.isPlaying = false;
      this.onSpeechEnd();
      
      // Resume listening after speaking - small delay to avoid picking up echo
      setTimeout(() => {
        console.log('[VoiceManager] Resuming listening after speech');
        this.resumeListening();
      }, 400);
    }
  }

  /**
   * Play audio and analyze levels
   */
  playAudio(url) {
    return new Promise((resolve, reject) => {
      this.isPlaying = true;
      
      const audio = new Audio(url);
      audio.volume = 1.0;
      this.currentAudio = audio;

      console.log('[VoiceManager] Created audio element, attempting to play...');

      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('[VoiceManager] Audio context resumed');
        });
      }

      // Try to connect to analyser for visualization (optional, won't break playback if fails)
      if (this.audioContext && this.analyser) {
        try {
          const source = this.audioContext.createMediaElementSource(audio);
          source.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);
          this.startLevelMonitoring();
          console.log('[VoiceManager] Connected to analyser');
        } catch (error) {
          // This error is OK - just means we won't have visualization
          console.log('[VoiceManager] Analyser connection skipped:', error.message);
        }
      }

      audio.onended = () => {
        console.log('[VoiceManager] Audio ended');
        this.stopLevelMonitoring();
        this.currentAudio = null;
        this.isPlaying = false;
        resolve();
      };

      audio.onerror = (error) => {
        console.error('[VoiceManager] Audio error:', error);
        this.stopLevelMonitoring();
        this.currentAudio = null;
        this.isPlaying = false;
        reject(error);
      };

      // Actually play the audio
      audio.play()
        .then(() => {
          console.log('[VoiceManager] Audio playback started successfully');
        })
        .catch((err) => {
          console.error('[VoiceManager] Audio play failed:', err);
          this.isPlaying = false;
          reject(err);
        });
    });
  }

  /**
   * Start monitoring audio levels
   */
  startLevelMonitoring() {
    if (this.levelCheckInterval) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.levelCheckInterval = setInterval(() => {
      if (!this.analyser) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Normalize to 0-1
      const level = Math.min(average / 128, 1);
      
      this.onAudioLevel(level);
    }, 50);
  }

  /**
   * Stop monitoring audio levels
   */
  stopLevelMonitoring() {
    if (this.levelCheckInterval) {
      clearInterval(this.levelCheckInterval);
      this.levelCheckInterval = null;
    }
    this.onAudioLevel(0);
  }

  /**
   * Stop all audio playback immediately
   */
  stopPlayback() {
    console.log('[VoiceManager] Stopping playback');
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    
    // Clear any queued audio
    this.audioQueue = [];
    
    // Clear pending transcript and timeout (user interrupted)
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    this.pendingTranscript = '';
    
    // Reset state
    this.isPlaying = false;
    this.stopLevelMonitoring();
    
    // Notify that speech ended
    this.onSpeechEnd();
    
    // Start listening immediately after interrupt
    setTimeout(() => {
      this.resumeListening();
    }, 100);
  }

  /**
   * Check if speech recognition is supported
   */
  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopListening();
    this.stopPlayback();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export for use
window.VoiceManager = VoiceManager;

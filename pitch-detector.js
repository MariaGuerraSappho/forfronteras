class PitchDetector {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStreamSource = null;
    this.stream = null;
    this.isRunning = false;
    this.callbackFn = null;
    this.rafId = null;
    
    // Pitch detection parameters
    this.bufferSize = 2048;
    this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    
    // Reference frequency for A4 (used for note calculation)
    this.A4 = 440;
    
    // Add a property to track frequencies to ignore
    this.frequenciesToIgnore = [];
  }
  
  async start(deviceId) {
    if (this.isRunning) return;
    
    try {
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Get microphone stream
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect nodes
      this.mediaStreamSource.connect(this.analyser);
      
      // Start the detection loop
      this.isRunning = true;
      this.detectPitch();
    } catch (error) {
      console.error('Error starting pitch detection:', error);
      throw error;
    }
  }
  
  stop() {
    if (!this.isRunning) return;
    
    // Stop the detection loop
    cancelAnimationFrame(this.rafId);
    
    // Stop the microphone stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Disconnect nodes
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    
    this.isRunning = false;
  }
  
  onPitch(callback) {
    this.callbackFn = callback;
  }
  
  getAudioStream() {
    return this.stream;
  }
  
  detectPitch() {
    const bufferLength = this.analyser.frequencyBinCount;
    const buffer = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(buffer);
    
    // Use autocorrelation for pitch detection
    const ac = this.autoCorrelate(buffer, this.audioContext.sampleRate);
    
    if (ac !== -1) {
      const frequency = ac;
      
      // Check if this frequency is too close to any frequency we're ignoring
      const shouldIgnore = this.frequenciesToIgnore.some(ignoreFreq => {
        // Allow 10Hz tolerance to account for slight variations
        return Math.abs(frequency - ignoreFreq) < 10;
      });
      
      if (!shouldIgnore) {
        const note = this.getNote(frequency);
        const cents = this.getCents(frequency, note);
        
        if (this.callbackFn) {
          this.callbackFn(note, frequency, cents);
        }
      }
    }
    
    // Continue the detection loop
    this.rafId = requestAnimationFrame(() => this.detectPitch());
  }
  
  autoCorrelate(buffer, sampleRate) {
    // Find the root-mean-square amplitude
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    
    // Return -1 if the signal is too quiet
    if (rms < 0.01) return -1;
    
    let r1 = 0, r2 = buffer.length - 1;
    const thres = 0.2;
    
    // Find the first point where the signal crosses zero
    for (let i = 0; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[i]) < thres) {
        r1 = i;
        break;
      }
    }
    
    // Find the next point where the signal crosses zero
    for (let i = 1; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[buffer.length / 2 + i]) < thres) {
        r2 = buffer.length / 2 + i;
        break;
      }
    }
    
    // Trim the buffer to these zero crossings
    const buf2 = buffer.slice(r1, r2);
    const c = new Array(buf2.length).fill(0);
    
    // Perform autocorrelation
    for (let i = 0; i < buf2.length; i++) {
      for (let j = 0; j < buf2.length - i; j++) {
        c[i] += buf2[j] * buf2[j + i];
      }
    }
    
    // Find the peak of the autocorrelation function
    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < c.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    
    let T0 = maxpos;
    
    // Interpolate using parabolic interpolation
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    
    if (a) T0 = T0 - b / (2 * a);
    
    return sampleRate / T0;
  }
  
  getNote(frequency) {
    const noteNum = 12 * (Math.log(frequency / this.A4) / Math.log(2));
    const noteNumRounded = Math.round(noteNum) + 69; // 69 is the MIDI note number for A4
    const octave = Math.floor(noteNumRounded / 12) - 1;
    const noteIndex = noteNumRounded % 12;
    return this.noteStrings[noteIndex] + octave;
  }
  
  getCents(frequency, note) {
    if (!note || typeof note !== 'string' || note.length < 2) {
      return 0; 
    }
    
    const noteName = note.substring(0, note.length - 1);
    const octave = parseInt(note.substring(note.length - 1));
    
    const noteIndex = this.noteStrings.indexOf(noteName);
    
    if (noteIndex === -1) {
      return 0;
    }
    
    const noteNum = noteIndex + (octave + 1) * 12;
    const expectedFrequency = this.A4 * Math.pow(2, (noteNum - 69) / 12);
    
    const cents = 1200 * Math.log(frequency / expectedFrequency) / Math.log(2);
    return cents;
  }
  
  // Add method to set frequencies to ignore
  setFrequenciesToIgnore(frequencies) {
    this.frequenciesToIgnore = frequencies;
  }
}

export default PitchDetector;
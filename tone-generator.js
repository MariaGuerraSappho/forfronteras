class ToneGenerator {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.activeOscillators = new Map();
    this.activeGains = new Map();
    
    // Just intonation ratios (relative to the tonic)
    this.justRatios = {
      'C': 1,          // Perfect unison
      'C#': 16/15,     // Minor second
      'D': 9/8,        // Major second
      'D#': 6/5,       // Minor third
      'E': 5/4,        // Major third
      'F': 4/3,        // Perfect fourth
      'F#': 45/32,     // Augmented fourth
      'G': 3/2,        // Perfect fifth
      'G#': 8/5,       // Minor sixth
      'A': 5/3,        // Major sixth
      'A#': 9/5,       // Minor seventh
      'B': 15/8        // Major seventh
    };
    
    // Reference A4 frequency
    this.A4 = 440;
    
    // Add properties for fade durations and volume management
    this.fadeInDuration = 0.5; // 500ms fade in
    this.fadeOutDuration = 2.0; // 2 second fade out
    this.maxVolume = 0.3; // Lower max volume to prevent distortion
  }
  
  playNote(noteWithOctave, detectedFrequency = null) {
    // Extract the note name and octave
    const noteName = noteWithOctave.substring(0, noteWithOctave.length - 1);
    const octave = parseInt(noteWithOctave.substring(noteWithOctave.length - 1));
    
    // Calculate the frequency using just intonation
    // For simplicity, we'll use C as our tonic for the just intonation ratios
    const frequency = this.calculateJustFrequency(noteName, octave);
    
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Create gain node
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0; // Start silent
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Calculate adjusted volume based on number of active tones
    const activeTonesCount = this.activeOscillators.size;
    const adjustedVolume = this.maxVolume / (activeTonesCount + 1);
    
    // Smooth fade in
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      adjustedVolume, 
      this.audioContext.currentTime + this.fadeInDuration
    );
    
    // Start oscillator
    oscillator.start();
    
    // Store references
    this.activeOscillators.set(noteWithOctave, oscillator);
    this.activeGains.set(noteWithOctave, gainNode);
    
    // If we have other active tones, adjust their volumes to prevent distortion
    if (activeTonesCount > 0) {
      for (const [note, gain] of this.activeGains.entries()) {
        if (note !== noteWithOctave) {
          gain.gain.setValueAtTime(gain.gain.value, this.audioContext.currentTime);
          gain.gain.linearRampToValueAtTime(
            adjustedVolume, 
            this.audioContext.currentTime + this.fadeInDuration
          );
        }
      }
    }
    
    return { oscillator, gainNode };
  }
  
  stopNote(noteWithOctave) {
    if (!this.activeOscillators.has(noteWithOctave)) return;
    
    const oscillator = this.activeOscillators.get(noteWithOctave);
    const gainNode = this.activeGains.get(noteWithOctave);
    
    // Longer, smoother fade out
    gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + this.fadeOutDuration);
    
    // Stop after fade out
    setTimeout(() => {
      oscillator.stop();
      oscillator.disconnect();
      gainNode.disconnect();
      
      this.activeOscillators.delete(noteWithOctave);
      this.activeGains.delete(noteWithOctave);
      
      // Rebalance volumes of remaining tones
      this.rebalanceVolumes();
    }, this.fadeOutDuration * 1000);
  }
  
  // Add a new method to rebalance volumes when notes change
  rebalanceVolumes() {
    const activeTonesCount = this.activeOscillators.size;
    if (activeTonesCount > 0) {
      const adjustedVolume = this.maxVolume / activeTonesCount;
      for (const [note, gain] of this.activeGains.entries()) {
        gain.gain.setValueAtTime(gain.gain.value, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(
          adjustedVolume, 
          this.audioContext.currentTime + 0.3
        );
      }
    }
  }
  
  stopAll() {
    for (const note of this.activeOscillators.keys()) {
      this.stopNote(note);
    }
  }
  
  fadeOutAll(immediate = false, duration = 2) {
    for (const [note, gainNode] of this.activeGains.entries()) {
      // Fade out over specified duration (default 2 seconds, can be 10 seconds for end session)
      gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
      
      // Stop after fade out
      setTimeout(() => {
        const oscillator = this.activeOscillators.get(note);
        if (oscillator) {
          oscillator.stop();
          oscillator.disconnect();
        }
        gainNode.disconnect();
        
        this.activeOscillators.delete(note);
        this.activeGains.delete(note);
      }, immediate ? 100 : duration * 1000);
    }
  }
  
  calculateJustFrequency(noteName, octave) {
    // We'll use C4 as our reference for just intonation
    const C4 = this.A4 * Math.pow(2, -9/12); // C4 is 9 semitones below A4
    
    // Get the base frequency for the note in the 4th octave
    const baseFreq = C4 * this.justRatios[noteName];
    
    // Adjust for octave
    return baseFreq * Math.pow(2, octave - 4);
  }

  async generateAudioFile(notes) {
    // Create an offline audio context for rendering audio
    const offlineCtx = new OfflineAudioContext(2, 44100 * (notes.length * 2), 44100);
    
    // Create a sequence of tones based on the notes
    let currentTime = 0;
    const noteLength = 2; // Each note plays for 2 seconds
    
    // Process each note
    for (const noteData of notes) {
      const { note } = noteData;
      
      // Extract note and octave
      const noteName = note.substring(0, note.length - 1);
      const octave = parseInt(note.substring(note.length - 1));
      
      // Calculate frequency
      const frequency = this.calculateJustFrequency(noteName, octave);
      
      // Create oscillator
      const oscillator = offlineCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      
      // Create gain node with envelope
      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.1); // Attack
      gainNode.gain.setValueAtTime(0.3, currentTime + noteLength - 0.2); // Sustain
      gainNode.gain.linearRampToValueAtTime(0, currentTime + noteLength); // Release
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(offlineCtx.destination);
      
      // Schedule playback
      oscillator.start(currentTime);
      oscillator.stop(currentTime + noteLength);
      
      // Move time forward
      currentTime += noteLength - 0.5; // Overlap notes slightly
    }
    
    // Render audio
    const renderedBuffer = await offlineCtx.startRendering();
    
    // Convert to WAV format
    const audioBlob = this.bufferToWave(renderedBuffer);
    return audioBlob;
  }

  // Helper function to convert AudioBuffer to WAV Blob
  bufferToWave(audioBuffer) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // Write WAV header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (1 for PCM)
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChannels, true); // byte rate
    view.setUint16(32, numOfChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    const channels = [];
    for (let i = 0; i < numOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export default ToneGenerator;
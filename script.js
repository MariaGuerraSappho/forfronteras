// Modifications below marked by comments (// MODIFIED) for added features
// DOMContentLoaded wrapper remains

document.addEventListener("DOMContentLoaded", () => {
  // ... [unchanged: trebleNotes, bassNotes declarations] ...

  let activeNote = null;
  let previewNote = null;
  let rootNote = null; // MODIFIED: stores the persistent root note
  let audioCtx = null;
  let activeOscillators = [];

  const noteHead = document.getElementById("noteHead");
  const previewNoteHead = document.getElementById("previewNoteHead");
  const rootNoteHead = document.getElementById("rootNoteHead"); // MODIFIED: visual root note
  const noteLabel = document.getElementById("noteLabel");
  const clefSymbol = document.getElementById("clefSymbol");
  const playButton = document.getElementById("playButton");
  const nextButton = document.getElementById("nextButton");
  const waveformSelect = document.getElementById("waveformSelect");
  const harmonicityRange = document.getElementById("harmonicityRange");
  const harmonicityValue = document.getElementById("harmonicityValue");
  const clefRadios = document.getElementsByName("clef");
  const keepRootCheckbox = document.getElementById("keepRoot"); // MODIFIED

  harmonicityRange.addEventListener("input", (e) => {
    harmonicityValue.textContent = e.target.value;
  });

  function getCurrentClef() {
    for (const radio of clefRadios) {
      if (radio.checked) return radio.value;
    }
    return "treble";
  }

  function getRandomNote() {
    const clef = getCurrentClef();
    const noteSet = (clef === "treble") ? trebleNotes : bassNotes;
    return noteSet[Math.floor(Math.random() * noteSet.length)];
  }

  function updateNoteDisplays() {
    if (!activeNote) return;
    noteHead.setAttribute("cy", activeNote.y);
    noteLabel.textContent = `${activeNote.name}${activeNote.octave} – ${activeNote.freq.toFixed(1)} Hz`;
    clefSymbol.textContent = (getCurrentClef() === "treble") ? "𝄞" : "𝄢";
    updateCentsDifference();

    if (keepRootCheckbox.checked && rootNote) {
      rootNoteHead.setAttribute("cy", rootNote.y);
      rootNoteHead.style.display = "block";
    } else {
      rootNoteHead.style.display = "none";
    }
  }

  function getEqualTemperedFrequency(note) {
    const equalOffsets = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    const semitoneOffset = equalOffsets[note.name] + 12 * (note.octave - 4);
    return 261.63 * Math.pow(2, semitoneOffset / 12);
  }

  function getCentsDifference(note) {
    const eqFreq = getEqualTemperedFrequency(note);
    return 1200 * Math.log2(note.freq / eqFreq);
  }

  function updateCentsDifference() {
    const centsElem = document.getElementById("centsDifference");
    if (activeNote && centsElem) {
      const diff = getCentsDifference(activeNote);
      const sign = diff > 0 ? "+" : "";
      centsElem.textContent = `Tuning difference: ${sign}${diff.toFixed(2)} cents`;
    }
  }

  function fadeOutOscillators() {
    if (!audioCtx || activeOscillators.length === 0) return;
    const now = audioCtx.currentTime;
    activeOscillators.forEach(osc => {
      if (osc.gainNode) {
        osc.gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.stop(now + 0.5);
      } else {
        osc.stop(now);
      }
    });
    activeOscillators = [];
  }

  function playNote(note) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.7, now + 0.05);
    masterGain.connect(audioCtx.destination);

    const waveform = waveformSelect.value;
    const harmonicity = parseFloat(harmonicityRange.value);

    const osc1 = audioCtx.createOscillator();
    osc1.type = waveform;
    osc1.frequency.setValueAtTime(note.freq, now);
    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.7, now);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.gainNode = gain1;

    activeOscillators.push(osc1);

    if (harmonicity > 1.0) {
      const osc2 = audioCtx.createOscillator();
      osc2.type = waveform;
      osc2.frequency.setValueAtTime(note.freq * harmonicity, now);
      const gain2 = audioCtx.createGain();
      gain2.gain.setValueAtTime(0.3, now);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now);
      osc2.gainNode = gain2;
      activeOscillators.push(osc2);
    }
  }

  nextButton.addEventListener("click", () => {
    if (keepRootCheckbox.checked && !rootNote) {
      rootNote = activeNote; // store initial note as reference
    }
    fadeOutOscillators();
    activeNote = getRandomNote();
    updateNoteDisplays();
    playNote(activeNote);
  });

  playButton.addEventListener("click", () => {
    if (activeOscillators.length === 0) {
      playNote(activeNote);
      playButton.textContent = "Stop";
    } else {
      fadeOutOscillators();
      playButton.textContent = "Play";
    }
  });

  for (const radio of clefRadios) {
    radio.addEventListener("change", () => {
      activeNote = getRandomNote();
      rootNote = null;
      updateNoteDisplays();
    });
  });

  // Initialize state
  activeNote = getRandomNote();
  updateNoteDisplays();
});

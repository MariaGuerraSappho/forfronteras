class ScoreRenderer {
  constructor(containerId) {
    this.containerId = containerId;
    this.vf = null;
    this.context = null;
    this.stave = null;
    this.notes = [];

    this.width = 700;  
    this.height = 220;  // increased height from 150 to 220

    this.initRenderer();
  }

  initRenderer() {
    const container = document.getElementById(this.containerId);
    const { Renderer, Stave } = Vex.Flow;

    container.innerHTML = '';

    this.vf = new Renderer(container, Renderer.Backends.SVG);
    this.vf.resize(this.width, this.height);
    this.context = this.vf.getContext();
    this.context.setFont("Arial", 10);

    // Move stave down a bit (from y=40 to y=70)
    this.stave = new Stave(10, 70, this.width - 20);
    this.stave.addClef("treble").addTimeSignature("4/4");
    this.stave.setContext(this.context).draw();
  }

  renderNotes(notesData) {
    this.notes = notesData;
    this.context.clear();

    const minWidth = 700;
    const desiredWidth = Math.max(minWidth, this.notes.length * 80 + 50);

    if (desiredWidth > this.width) {
      this.width = desiredWidth;
      this.vf.resize(this.width, this.height);

      // Adjust stave vertical position to 70 as well
      this.stave = new Vex.Flow.Stave(10, 70, this.width - 20);
      this.stave.addClef("treble").addTimeSignature("4/4");
    }

    this.stave.setContext(this.context).draw();

    if (this.notes.length === 0) return;

    const { StaveNote, Accidental } = Vex.Flow;
    const renderedNotes = [];

    for (const noteData of this.notes) {
      const noteName = noteData.note.substring(0, noteData.note.length - 1);
      const octave = noteData.note.substring(noteData.note.length - 1);

      let vfNote = this.convertToVexFlowNote(noteName, octave);

      const staveNote = new StaveNote({
        keys: [vfNote],
        duration: "q"
      });

      if (noteName.includes('#')) {
        staveNote.addModifier(new Accidental("#"));
      } else if (noteName.includes('b')) {
        staveNote.addModifier(new Accidental("b"));
      }

      renderedNotes.push(staveNote);
    }

    const { Formatter, Voice } = Vex.Flow;

    if (renderedNotes.length === 0) {
      renderedNotes.push(new StaveNote({
        keys: ["b/4"],
        duration: "qr"
      }));
    }

    const voice = new Voice({ num_beats: this.notes.length, beat_value: 4 });
    voice.addTickables(renderedNotes);

    new Formatter().joinVoices([voice]).format([voice], this.width - 100);
    voice.draw(this.context, this.stave);
  }

  convertToVexFlowNote(noteName, octave) {
    let note = noteName.replace('#', '').toLowerCase();
    return `${note}/${octave}`;
  }

  generateMusicXML(notesData) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>For Fronterras Score</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>`;

    for (const noteData of notesData) {
      const noteName = noteData.note.substring(0, noteData.note.length - 1);
      const octave = noteData.note.substring(noteData.note.length - 1);

      let step = noteName.charAt(0);
      let alter = "0";
      if (noteName.includes('#')) alter = "1";
      else if (noteName.includes('b')) alter = "-1";

      xml += `
      <note>
        <pitch>
          <step>${step}</step>
          <alter>${alter}</alter>
          <octave>${octave}</octave>
        </pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>`;
    }

    xml += `
    </measure>
  </part>
</score-partwise>`;

    return xml;
  }
}

export default ScoreRenderer;

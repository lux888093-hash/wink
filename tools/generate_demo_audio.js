const fs = require('fs');
const path = require('path');

const sampleRate = 22050;
const outputDir = path.join(__dirname, '..', 'miniprogram', 'assets', 'audio');

const TRACKS = [
  {
    file: 'vintage-noir.wav',
    tempo: 72,
    baseGain: 0.42,
    notes: [
      ['A3', 2], ['C4', 2], ['E4', 2], ['G4', 2],
      ['A4', 4], ['G4', 2], ['E4', 2], ['C4', 2],
      ['A3', 4], ['E4', 2], ['G4', 2]
    ]
  },
  {
    file: 'relaxing-jazz.wav',
    tempo: 84,
    baseGain: 0.38,
    notes: [
      ['C4', 1], ['E4', 1], ['G4', 2], ['B4', 2],
      ['A4', 2], ['G4', 2], ['E4', 2], ['D4', 2],
      ['C4', 2], ['G3', 2], ['A3', 4]
    ]
  },
  {
    file: 'classical-piano.wav',
    tempo: 90,
    baseGain: 0.34,
    notes: [
      ['E4', 1], ['G4', 1], ['B4', 2], ['C5', 2],
      ['B4', 2], ['G4', 2], ['E4', 2], ['D4', 2],
      ['C4', 2], ['E4', 2], ['G4', 4]
    ]
  },
  {
    file: 'earthly-echoes.wav',
    tempo: 66,
    baseGain: 0.4,
    notes: [
      ['D3', 2], ['A3', 2], ['C4', 2], ['F4', 2],
      ['E4', 4], ['C4', 2], ['A3', 2], ['G3', 2],
      ['D3', 4], ['F3', 2], ['A3', 2]
    ]
  }
];

const NOTE_TO_SEMITONE = {
  C: -9,
  D: -7,
  E: -5,
  F: -4,
  G: -2,
  A: 0,
  B: 2
};

function noteToFrequency(note) {
  const [, base, octaveText] = note.match(/^([A-G])(\d)$/);
  const octave = Number(octaveText);
  const semitoneOffset = NOTE_TO_SEMITONE[base] + (octave - 4) * 12;
  return 440 * 2 ** (semitoneOffset / 12);
}

function createWavFile(floatSamples) {
  const pcmData = Buffer.alloc(floatSamples.length * 2);

  for (let index = 0; index < floatSamples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, floatSamples[index]));
    pcmData.writeInt16LE(Math.floor(sample * 32767), index * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

function renderTrack(track) {
  const beatSeconds = 60 / track.tempo;
  const totalSeconds = track.notes.reduce((sum, [, beats]) => sum + beats * beatSeconds, 0);
  const sampleCount = Math.ceil(totalSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);

  let cursor = 0;

  track.notes.forEach(([noteName, beats], noteIndex) => {
    const frequency = noteToFrequency(noteName);
    const durationSeconds = beats * beatSeconds;
    const noteSamples = Math.floor(durationSeconds * sampleRate);

    for (let offset = 0; offset < noteSamples; offset += 1) {
      const time = offset / sampleRate;
      const progress = offset / noteSamples;
      const attack = Math.min(1, progress / 0.08);
      const release = Math.min(1, (1 - progress) / 0.22);
      const envelope = Math.min(attack, release);

      const main = Math.sin(2 * Math.PI * frequency * time);
      const octave = 0.24 * Math.sin(2 * Math.PI * frequency * 2 * time);
      const fifth = 0.12 * Math.sin(2 * Math.PI * frequency * 1.5 * time);
      const shimmer = 0.04 * Math.sin(2 * Math.PI * (frequency + 0.6 * noteIndex) * time);
      const sample = (main + octave + fifth + shimmer) * track.baseGain * envelope;

      if (cursor + offset < samples.length) {
        samples[cursor + offset] += sample;
      }
    }

    cursor += noteSamples;
  });

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    const room = 0.06 * Math.sin(2 * Math.PI * 110 * time);
    samples[index] += room;
  }

  return createWavFile(samples);
}

fs.mkdirSync(outputDir, { recursive: true });

TRACKS.forEach((track) => {
  const buffer = renderTrack(track);
  fs.writeFileSync(path.join(outputDir, track.file), buffer);
  console.log(`Generated ${track.file}`);
});

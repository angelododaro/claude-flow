declare module 'recordrtc' {
  export default class RecordRTC {
    constructor(stream: MediaStream, options: any);
    startRecording(): void;
    stopRecording(callback: () => void): void;
    pauseRecording(): void;
    resumeRecording(): void;
    getBlob(): Blob;
    toURL(): string;
    destroy(): void;
  }
}
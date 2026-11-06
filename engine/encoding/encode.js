/**
 * ENCODING — In-process H.264 + AAC → MP4.
 * Path: RGBA frames → @napi-rs/webcodecs VideoEncoder (avc) →
 * Mediabunny EncodedPacket bridge → Mp4OutputFormat (fastStart in-memory).
 * Audio: f32 interleaved PCM → AudioEncoder (mp4a.40.2) → same mux.
 * No FFmpeg spawn anywhere on this path. Renderer stays PNG-capable alone.
 */
import webcodecs from '@napi-rs/webcodecs';
import { BufferTarget, EncodedAudioPacketSource, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output, } from 'mediabunny';
const { VideoEncoder, VideoFrame, AudioEncoder, AudioData } = webcodecs;
const toPacket = (chunk) => {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    return new EncodedPacket(data, chunk.type, chunk.timestamp / 1e6, (chunk.duration ?? 0) / 1e6);
};
export const defaultVideoBitrate = (width, height, fps) => Math.min(20_000_000, Math.max(1_000_000, Math.round(width * height * fps * 0.12)));
/**
 * Render all frames through the encoders and return MP4 bytes (fastStart).
 * Deterministic for identical inputs (same encoder build/settings).
 */
export const renderToMp4 = async (job) => {
    const { width, height, fps, frameCount } = job;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new Error(`Invalid dimensions ${width}x${height}`);
    }
    if (width % 2 !== 0 || height % 2 !== 0) {
        throw new Error(`H.264 requires even dimensions (got ${width}x${height})`);
    }
    if (!Number.isInteger(frameCount) || frameCount <= 0) {
        throw new Error(`Invalid frameCount ${frameCount}`);
    }
    const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: new BufferTarget(),
    });
    const video = new EncodedVideoPacketSource('avc');
    output.addVideoTrack(video, { frameRate: fps });
    const hasAudio = job.audio !== undefined && job.audio.pcm.length > 0;
    const audio = hasAudio ? new EncodedAudioPacketSource('aac') : null;
    if (audio) {
        // Track format comes from the first packet's decoderConfig meta.
        output.addAudioTrack(audio);
    }
    await output.start();
    const videoCodec = 'avc1.42001f';
    const venc = new VideoEncoder({
        output: async (chunk, meta) => {
            const desc = meta?.decoderConfig?.description;
            const cfg = meta?.decoderConfig;
            await video.add(toPacket(chunk), desc
                ? {
                    decoderConfig: {
                        codec: cfg?.codec ?? videoCodec,
                        codedWidth: width,
                        codedHeight: height,
                        description: desc,
                    },
                }
                : undefined);
        },
        error: (e) => {
            throw e instanceof Error ? e : new Error(String(e));
        },
    });
    venc.configure({
        codec: videoCodec,
        width,
        height,
        bitrate: job.videoBitrate ?? defaultVideoBitrate(width, height, fps),
        framerate: fps,
    });
    const frameDurationUs = 1e6 / fps;
    const yieldToLoop = () => new Promise((resolve) => setImmediate(resolve));
    for (let frame = 0; frame < frameCount; frame += 1) {
        const rgba = job.renderFrame(frame);
        if (rgba.length !== width * height * 4) {
            throw new Error(`renderFrame(${frame}) returned ${rgba.length} bytes, need ${width * height * 4}`);
        }
        const vf = new VideoFrame(Buffer.from(rgba), {
            timestamp: Math.round(frame * frameDurationUs),
            duration: Math.round(frameDurationUs),
            format: 'RGBA',
            codedWidth: width,
            codedHeight: height,
        });
        venc.encode(vf);
        vf.close();
        job.onProgress?.(frame, frameCount);
        // Yield between frames so the Studio can answer HTTP while a job runs.
        await yieldToLoop();
    }
    await venc.flush();
    venc.close();
    if (audio && job.audio) {
        const { pcm, sampleRate, channels } = job.audio;
        const aenc = new AudioEncoder({
            output: async (chunk, meta) => {
                const desc = meta?.decoderConfig?.description;
                const cfg = meta?.decoderConfig;
                await audio.add(toPacket(chunk), desc
                    ? {
                        decoderConfig: {
                            codec: cfg?.codec ?? 'mp4a.40.2',
                            sampleRate,
                            numberOfChannels: channels,
                            description: desc,
                        },
                    }
                    : undefined);
            },
            error: (e) => {
                throw e instanceof Error ? e : new Error(String(e));
            },
        });
        aenc.configure({
            codec: 'mp4a.40.2',
            sampleRate,
            numberOfChannels: channels,
            bitrate: job.audioBitrate ?? 128000,
        });
        // 0.5s chunks bound encoder input while keeping timestamps exact.
        const chunkFrames = Math.max(1, Math.floor(sampleRate / 2));
        const totalFrames = Math.floor(pcm.length / channels);
        for (let start = 0; start < totalFrames; start += chunkFrames) {
            const count = Math.min(chunkFrames, totalFrames - start);
            const slice = pcm.slice(start * channels, (start + count) * channels);
            const ad = new AudioData({
                timestamp: Math.round((start / sampleRate) * 1e6),
                data: slice,
                format: 'f32',
                sampleRate,
                numberOfFrames: count,
                numberOfChannels: channels,
            });
            aenc.encode(ad);
            ad.close();
        }
        await aenc.flush();
        aenc.close();
    }
    await output.finalize();
    if (!output.target.buffer) {
        throw new Error('Mux produced no output');
    }
    return Buffer.from(output.target.buffer);
};
//# sourceMappingURL=encode.js.map
/**
 * Agora-powered video room for NoorConnect classrooms.
 *
 * Two-stage flow:
 *   1. Pre-join lobby — local camera preview + device pickers + mic test
 *   2. In-call view  — speaker tile for the remote, picture-in-picture self
 *                      view, plus a control bar (mic, cam, share, leave)
 *
 * Designed for 1:1 student↔teacher sessions but degrades gracefully to N>2.
 *
 * The Agora SDK is imported dynamically so SSR builds (TanStack Start) don't
 * try to evaluate browser-only globals during server render.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Camera,
  CameraOff,
  Loader2,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  Settings,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  User,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AgoraRTC = typeof import("agora-rtc-sdk-ng").default;
type IAgoraRTCClient = import("agora-rtc-sdk-ng").IAgoraRTCClient;
type ICameraVideoTrack = import("agora-rtc-sdk-ng").ICameraVideoTrack;
type IMicrophoneAudioTrack = import("agora-rtc-sdk-ng").IMicrophoneAudioTrack;
type ILocalVideoTrack = import("agora-rtc-sdk-ng").ILocalVideoTrack;
type IRemoteVideoTrack = import("agora-rtc-sdk-ng").IRemoteVideoTrack;
type IRemoteAudioTrack = import("agora-rtc-sdk-ng").IRemoteAudioTrack;
type IAgoraRTCRemoteUser = import("agora-rtc-sdk-ng").IAgoraRTCRemoteUser;
type NetworkQuality = import("agora-rtc-sdk-ng").NetworkQuality;

export interface AgoraJoinPayload {
  app_id: string;
  channel: string;
  uid: number | string;
  token: string;
  configured?: boolean;
  display_name?: string;
  role_in_session?: "teacher" | "student";
}

export interface VideoRoomProps {
  joinPayload: AgoraJoinPayload | null;
  /** Display name for the remote participant (used until they join + send metadata). */
  remoteLabel?: string;
  /** Caller's own display name. */
  selfLabel?: string;
  /** Optional banner to show above controls (e.g. countdown). */
  banner?: React.ReactNode;
  /** Called when the user clicks Leave. Parent decides what to do (end session, route away). */
  onLeave: () => void;
  /** When true, mounting will skip the lobby and join immediately. */
  autoJoin?: boolean;
}

const QUALITY_LABELS = ["Unknown", "Excellent", "Good", "Fair", "Poor", "Very poor", "Disconnected"];

function qualityIcon(q: number, className = "h-4 w-4") {
  if (q === 0 || q >= 6) return <WifiOff className={className} />;
  if (q <= 2) return <SignalHigh className={className} />;
  if (q === 3) return <SignalMedium className={className} />;
  if (q === 4) return <SignalLow className={className} />;
  return <Signal className={className} />;
}

function qualityColor(q: number) {
  if (q === 0 || q >= 6) return "text-zinc-500";
  if (q <= 2) return "text-emerald-500";
  if (q === 3) return "text-amber-500";
  return "text-red-500";
}

export function VideoRoom({
  joinPayload,
  remoteLabel,
  selfLabel,
  banner,
  onLeave,
  autoJoin = false,
}: VideoRoomProps) {
  // ---- SDK + client refs (stable across renders) ----
  const sdkRef = useRef<AgoraRTC | null>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const localPlayerRef = useRef<HTMLDivElement | null>(null);
  const remotePlayerRef = useRef<HTMLDivElement | null>(null);
  const lobbyPreviewRef = useRef<HTMLDivElement | null>(null);

  // ---- UI state ----
  const [stage, setStage] = useState<"lobby" | "joining" | "in-call" | "error">("lobby");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [remoteHasAudio, setRemoteHasAudio] = useState(false);
  const [remoteVolume, setRemoteVolume] = useState(0);
  const [localVolume, setLocalVolume] = useState(0);
  const [uplinkQuality, setUplinkQuality] = useState(0);
  const [downlinkQuality, setDownlinkQuality] = useState(0);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [sdkReady, setSdkReady] = useState(false);
  // When true, the self video is on the main stage and the remote is in the PiP.
  // Useful for the presenter to see what they're sharing.
  const [selfOnStage, setSelfOnStage] = useState(false);

  const notConfigured = joinPayload?.configured === false;

  // ---- Load Agora SDK lazily (client-only) ----
  useEffect(() => {
    let active = true;
    if (typeof window === "undefined") return;
    import("agora-rtc-sdk-ng").then((mod) => {
      if (!active) return;
      const sdk = mod.default;
      sdk.setLogLevel(2); // warnings only
      sdkRef.current = sdk;
      setSdkReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // ---- Lobby preview: spin up local camera so the user sees themselves before joining ----
  useEffect(() => {
    if (!sdkReady || stage !== "lobby" || notConfigured) return;
    let cancelled = false;
    const sdk = sdkRef.current!;

    (async () => {
      try {
        const [mic, cam] = await sdk.createMicrophoneAndCameraTracks(
          undefined,
          { encoderConfig: "720p_1" },
        );
        if (cancelled) {
          mic.close();
          cam.close();
          return;
        }
        localAudioRef.current = mic;
        localVideoRef.current = cam;
        // Honor any toggle changes the user made while tracks were loading.
        try {
          await mic.setMuted(!micOn);
          await cam.setMuted(!camOn);
        } catch (e) {
          console.warn("[VideoRoom] initial mute sync failed", e);
        }
        if (lobbyPreviewRef.current) cam.play(lobbyPreviewRef.current);

        // Enumerate devices once permissions are granted
        const [camDevs, micDevs] = await Promise.all([
          sdk.getCameras().catch(() => []),
          sdk.getMicrophones().catch(() => []),
        ]);
        if (cancelled) return;
        setCameras(camDevs);
        setMics(micDevs);
        const camId = cam.getTrackLabel();
        const micId = mic.getTrackLabel();
        setSelectedCam(camDevs.find((d) => d.label === camId)?.deviceId ?? camDevs[0]?.deviceId ?? "");
        setSelectedMic(micDevs.find((d) => d.label === micId)?.deviceId ?? micDevs[0]?.deviceId ?? "");
      } catch (e: any) {
        if (cancelled) return;
        console.error("[VideoRoom] lobby preview failed", e);
        setErrorMsg(
          e?.message?.includes("Permission")
            ? "Camera or microphone access was blocked. Allow it in your browser, then refresh."
            : "Could not access your camera or microphone. Check that no other app is using them.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, stage, notConfigured]);

  // ---- Volume meter (lobby + in-call) ----
  useEffect(() => {
    if (!localAudioRef.current) return;
    const i = setInterval(() => {
      const v = localAudioRef.current?.getVolumeLevel?.() ?? 0;
      setLocalVolume(v);
    }, 200);
    return () => clearInterval(i);
  }, [stage]);

  // ---- Hook up Agora client events for in-call view ----
  const wireClientEvents = useCallback((client: IAgoraRTCClient) => {
    client.on("user-published", async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
      } catch (e) {
        console.error("[VideoRoom] subscribe failed", e);
        return;
      }
      setRemoteUser(user);
      if (mediaType === "video") {
        // The reactive-binding effect plays the track into the correct div
        // (main stage or PiP) based on selfOnStage; flipping the flag here
        // triggers that effect.
        setRemoteHasVideo(true);
      } else if (mediaType === "audio") {
        setRemoteHasAudio(true);
        const a = user.audioTrack as IRemoteAudioTrack | undefined;
        a?.play();
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "video") setRemoteHasVideo(false);
      if (mediaType === "audio") setRemoteHasAudio(false);
    });

    client.on("user-left", (user) => {
      setRemoteUser((current) => (current?.uid === user.uid ? null : current));
      setRemoteHasVideo(false);
      setRemoteHasAudio(false);
    });

    client.on("network-quality", (stats: NetworkQuality) => {
      setUplinkQuality(stats.uplinkNetworkQuality);
      setDownlinkQuality(stats.downlinkNetworkQuality);
    });

    client.on("volume-indicator", (results) => {
      for (const r of results) {
        if (r.uid === client.uid) setLocalVolume(r.level / 100);
        else setRemoteVolume(r.level / 100);
      }
    });
  }, []);

  // ---- Join channel ----
  const join = useCallback(async () => {
    if (!joinPayload || !sdkRef.current) return;
    if (notConfigured) {
      setErrorMsg(
        "Video calling isn't configured yet. The server is missing AGORA_APP_ID — once it's set, refresh this page.",
      );
      setStage("error");
      return;
    }
    setStage("joining");
    setErrorMsg(null);

    try {
      const sdk = sdkRef.current;
      const client = sdk.createClient({ mode: "rtc", codec: "vp8" });
      client.enableAudioVolumeIndicator();
      clientRef.current = client;
      wireClientEvents(client);

      await client.join(
        joinPayload.app_id,
        joinPayload.channel,
        joinPayload.token || null,
        Number(joinPayload.uid),
      );

      // If the lobby preview wasn't built yet (autoJoin path), build tracks now.
      if (!localAudioRef.current || !localVideoRef.current) {
        const [mic, cam] = await sdk.createMicrophoneAndCameraTracks(undefined, {
          encoderConfig: "720p_1",
        });
        localAudioRef.current = mic;
        localVideoRef.current = cam;
      }

      // Apply current toggle state before publishing.
      await localAudioRef.current.setMuted(!micOn);
      await localVideoRef.current.setMuted(!camOn);

      await client.publish([localAudioRef.current, localVideoRef.current]);

      // The reactive-binding effect handles play() once the in-call DOM mounts.
      setStage("in-call");
    } catch (e: any) {
      console.error("[VideoRoom] join failed", e);
      setErrorMsg(
        e?.message ??
          "Could not connect to the call. Check your network and try again.",
      );
      setStage("error");
    }
  }, [joinPayload, micOn, camOn, notConfigured, wireClientEvents]);

  // ---- Auto-join if requested ----
  useEffect(() => {
    if (autoJoin && sdkReady && stage === "lobby" && joinPayload) {
      join();
    }
  }, [autoJoin, sdkReady, stage, joinPayload, join]);

  // ---- Reactive player binding ----
  // Plays whichever video track belongs on the main stage vs PiP, based on
  // selfOnStage. Runs after the in-call DOM mounts (so refs are valid), and
  // re-runs whenever the remote user joins/leaves or the user swaps views.
  useEffect(() => {
    if (stage !== "in-call") return;
    const stageDiv = remotePlayerRef.current;
    const pipDiv = localPlayerRef.current;
    if (!stageDiv || !pipDiv) return;

    const selfTrack = (screenTrackRef.current ?? localVideoRef.current) as
      | ILocalVideoTrack
      | undefined;
    const remoteTrack = remoteUser?.videoTrack as IRemoteVideoTrack | undefined;

    try {
      if (selfOnStage) {
        if (selfTrack) selfTrack.play(stageDiv);
        if (remoteTrack) remoteTrack.play(pipDiv);
      } else {
        if (remoteTrack) remoteTrack.play(stageDiv);
        if (selfTrack) selfTrack.play(pipDiv);
      }
    } catch (e) {
      console.warn("[VideoRoom] re-bind tracks failed", e);
    }
  }, [stage, selfOnStage, remoteUser, remoteHasVideo, sharing, camOn]);

  // ---- Leave channel + cleanup ----
  const leave = useCallback(async () => {
    try {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.stop();
        localVideoRef.current.close();
        localVideoRef.current = null;
      }
      if (localAudioRef.current) {
        localAudioRef.current.stop();
        localAudioRef.current.close();
        localAudioRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    } catch (e) {
      console.warn("[VideoRoom] cleanup error", e);
    }
    onLeave();
  }, [onLeave]);

  // Component-unmount safety
  useEffect(() => {
    return () => {
      if (localVideoRef.current) localVideoRef.current.close();
      if (localAudioRef.current) localAudioRef.current.close();
      if (screenTrackRef.current) screenTrackRef.current.close();
      clientRef.current?.leave().catch(() => {});
    };
  }, []);

  // ---- Mic / camera toggles ----
  // We always flip UI state immediately, even if the live track hasn't been
  // created yet (lobby preview is still spinning up). The track-creation effect
  // re-applies the latest state on attach, so the state stays the source of truth.
  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    if (localAudioRef.current) {
      try {
        await localAudioRef.current.setMuted(!next);
      } catch (e) {
        console.warn("[VideoRoom] mic setMuted failed", e);
      }
    }
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    if (localVideoRef.current) {
      try {
        await localVideoRef.current.setMuted(!next);
      } catch (e) {
        console.warn("[VideoRoom] camera setMuted failed", e);
      }
    }
  }, [camOn]);

  // ---- Screen share (replaces camera publish until stopped) ----
  const toggleShare = useCallback(async () => {
    if (!sdkRef.current || !clientRef.current) return;
    const sdk = sdkRef.current;
    const client = clientRef.current;

    if (sharing && screenTrackRef.current) {
      // Stop sharing → re-publish camera (re-binding handled by the effect)
      try {
        await client.unpublish(screenTrackRef.current);
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        if (localVideoRef.current) {
          await client.publish(localVideoRef.current);
        }
        setSharing(false);
      } catch (e) {
        console.error("[VideoRoom] stop share failed", e);
      }
      return;
    }

    try {
      const screen = await sdk.createScreenVideoTrack(
        { encoderConfig: "1080p_1" },
        "disable",
      );
      // SDK can return [video, audio] if withAudio is "enable"; we keep it video-only.
      const screenTrack = Array.isArray(screen) ? screen[0] : screen;
      screenTrackRef.current = screenTrack as ILocalVideoTrack;

      // Stop publishing the camera, publish the screen instead
      if (localVideoRef.current) {
        await client.unpublish(localVideoRef.current);
      }
      await client.publish(screenTrackRef.current);
      // The reactive-binding effect re-attaches the screen track for us.

      // Auto-stop when the user clicks the browser's stop-sharing button
      screenTrackRef.current.on("track-ended", () => {
        toggleShare();
      });

      setSharing(true);
      // While presenting, default to showing your own output on the main stage.
      // The user can still flip back via the swap button.
      setSelfOnStage(true);
    } catch (e: any) {
      // User cancelling the screen-picker dialog is not an error worth showing.
      if (e?.code === "PERMISSION_DENIED" || /denied/i.test(e?.message ?? "")) return;
      console.error("[VideoRoom] start share failed", e);
    }
  }, [sharing]);

  // ---- Device switching from settings panel ----
  const changeCamera = useCallback(async (deviceId: string) => {
    setSelectedCam(deviceId);
    if (localVideoRef.current) {
      try {
        await localVideoRef.current.setDevice(deviceId);
      } catch (e) {
        console.error("[VideoRoom] setDevice camera", e);
      }
    }
  }, []);

  const changeMic = useCallback(async (deviceId: string) => {
    setSelectedMic(deviceId);
    if (localAudioRef.current) {
      try {
        await localAudioRef.current.setDevice(deviceId);
      } catch (e) {
        console.error("[VideoRoom] setDevice mic", e);
      }
    }
  }, []);

  // ---- Fullscreen helpers ----
  const rootRef = useRef<HTMLDivElement | null>(null);
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  // ---- Render ----
  const overallQuality = useMemo(
    () => Math.max(uplinkQuality, downlinkQuality),
    [uplinkQuality, downlinkQuality],
  );

  if (stage === "lobby") {
    return (
      <div
        ref={rootRef}
        className="flex h-full w-full flex-col overflow-auto bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white"
      >
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-stretch">
            <div className="relative aspect-video w-full min-w-0 rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl ring-1 ring-white/10">
              <div ref={lobbyPreviewRef} className="absolute inset-0 [&>video]:!w-full [&>video]:!h-full [&>video]:object-cover" />
              {!localVideoRef.current && !notConfigured && (
                <div className="absolute inset-0 grid place-items-center text-zinc-400">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <p className="text-sm">Warming up your camera…</p>
                  </div>
                </div>
              )}
              {notConfigured && (
                <div className="absolute inset-0 grid place-items-center text-zinc-300 px-8 text-center">
                  <div>
                    <WifiOff className="h-8 w-8 mx-auto mb-3 text-amber-400" />
                    <p className="font-semibold">Video calling isn't configured yet</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      The server is missing <code className="text-zinc-200">AGORA_APP_ID</code>.
                      <br />Set it in the backend and refresh.
                    </p>
                  </div>
                </div>
              )}
              {/* Self volume meter */}
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs backdrop-blur">
                <Mic className="h-3.5 w-3.5" />
                <div className="h-1 w-16 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-[width] duration-150"
                    style={{ width: `${Math.min(100, localVolume * 200)}%` }}
                  />
                </div>
              </div>
              <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs backdrop-blur">
                <span className="text-white/80">{selfLabel ?? "You"}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 min-w-0">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-400">Ready to join</p>
                <h1 className="mt-2 text-2xl font-semibold">
                  {remoteLabel ? `Meeting with ${remoteLabel}` : "Your classroom"}
                </h1>
                <p className="mt-3 text-sm text-zinc-400">
                  Check your camera and mic preview, then join when you're ready. You can change devices any time.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <label className="block text-xs font-medium text-zinc-300">Camera</label>
                <select
                  value={selectedCam}
                  onChange={(e) => changeCamera(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {cameras.length === 0 && <option>Default camera</option>}
                  {cameras.map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label || `Camera ${c.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-medium text-zinc-300 pt-2">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => changeMic(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {mics.length === 0 && <option>Default microphone</option>}
                  {mics.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label || `Mic ${m.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LobbyToggle
                    on={micOn}
                    onClick={toggleMic}
                    Icon={Mic}
                    OffIcon={MicOff}
                    label={micOn ? "Mic on" : "Mic off"}
                  />
                  <LobbyToggle
                    on={camOn}
                    onClick={toggleCam}
                    Icon={Camera}
                    OffIcon={CameraOff}
                    label={camOn ? "Camera on" : "Camera off"}
                  />
                </div>
                <button
                  onClick={join}
                  disabled={!sdkReady || notConfigured}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  {sdkReady ? "Join now" : <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "joining") {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
          <p className="mt-4 text-sm text-zinc-400">Connecting to the classroom…</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-white p-6">
        <div className="max-w-md text-center">
          <WifiOff className="mx-auto h-8 w-8 text-red-400" />
          <h2 className="mt-3 text-lg font-semibold">Couldn't connect</h2>
          <p className="mt-2 text-sm text-zinc-400">{errorMsg}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setErrorMsg(null);
                setStage("lobby");
              }}
              className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Back to lobby
            </button>
            <button
              onClick={onLeave}
              className="rounded-md bg-red-500 hover:bg-red-400 px-4 py-2 text-sm font-medium text-white"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- In-call view ----
  return (
    <div
      ref={rootRef}
      className="relative flex h-full flex-col bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white"
    >
      {banner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
          {banner}
        </div>
      )}

      {/* Top-right network + settings */}
      <div className="absolute top-3 right-4 z-30 flex items-center gap-2">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-xs",
            qualityColor(overallQuality),
          )}
          title={`Network: ${QUALITY_LABELS[overallQuality] ?? "Unknown"}`}
        >
          {qualityIcon(overallQuality)}
          <span>{QUALITY_LABELS[overallQuality] ?? "Unknown"}</span>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="rounded-full bg-black/50 backdrop-blur p-2 hover:bg-black/70"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Settings popover */}
      {showSettings && (
        <div className="absolute top-14 right-4 z-30 w-72 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur p-4 shadow-2xl">
          <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Devices</p>
          <label className="block text-xs text-zinc-300">Camera</label>
          <select
            value={selectedCam}
            onChange={(e) => changeCamera(e.target.value)}
            className="mt-1 mb-3 w-full rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {cameras.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera ${c.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
          <label className="block text-xs text-zinc-300">Microphone</label>
          <select
            value={selectedMic}
            onChange={(e) => changeMic(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {mics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Mic ${m.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main stage */}
      <div className="relative flex-1 flex items-center justify-center p-4 md:p-6">
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl">
          {/* Stage video target — receives whichever track is "focused" */}
          <div
            ref={remotePlayerRef}
            className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:object-contain [&>div]:!w-full [&>div]:!h-full"
          />

          {/* Stage fallback — depends on what's supposed to be on stage */}
          {selfOnStage
            ? !camOn && !sharing && (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-zinc-900 to-black">
                  <div className="text-center">
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 ring-1 ring-emerald-400/20">
                      <CameraOff className="h-12 w-12 text-emerald-200" />
                    </div>
                    <p className="mt-4 font-medium text-white/90">{selfLabel ?? "You"}</p>
                    <p className="mt-1 text-sm text-zinc-400">Your camera is off</p>
                  </div>
                </div>
              )
            : !remoteHasVideo && (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-zinc-900 to-black">
                  <div className="text-center">
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 ring-1 ring-emerald-400/20">
                      <User className="h-12 w-12 text-emerald-200" />
                    </div>
                    <p className="mt-4 font-medium text-white/90">
                      {remoteLabel ?? "Waiting for the other participant…"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {remoteUser ? "Camera is off" : "They haven't joined yet"}
                    </p>
                  </div>
                </div>
              )}

          {/* Stage label */}
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-1.5 text-xs">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                (selfOnStage ? localVolume : remoteVolume) > 0.15
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-zinc-500",
              )}
            />
            <span>
              {selfOnStage
                ? `${selfLabel ?? "You"}${sharing ? " · Sharing screen" : ""}`
                : (remoteLabel ?? "Participant")}
            </span>
            {selfOnStage ? (
              micOn ? (
                <Volume2 className="h-3 w-3 text-zinc-300" />
              ) : (
                <MicOff className="h-3 w-3 text-red-400" />
              )
            ) : remoteHasAudio ? (
              <Volume2 className="h-3 w-3 text-zinc-300" />
            ) : (
              <MicOff className="h-3 w-3 text-red-400" />
            )}
          </div>

          {/* Picture-in-picture — the non-focused participant */}
          <div className="group absolute bottom-4 right-4 w-40 sm:w-52 aspect-video rounded-xl overflow-hidden bg-zinc-800 ring-2 ring-white/15 shadow-xl">
            <div
              ref={localPlayerRef}
              className="absolute inset-0 [&>video]:!w-full [&>video]:!h-full [&>video]:object-cover [&>div]:!w-full [&>div]:!h-full"
            />

            {/* PiP fallback — depends on what's supposed to be in the PiP */}
            {selfOnStage
              ? !remoteHasVideo && (
                  <div className="absolute inset-0 grid place-items-center bg-zinc-900">
                    <User className="h-6 w-6 text-zinc-500" />
                  </div>
                )
              : !camOn && !sharing && (
                  <div className="absolute inset-0 grid place-items-center bg-zinc-900">
                    <CameraOff className="h-6 w-6 text-zinc-500" />
                  </div>
                )}

            {/* Swap button — hover to reveal, always visible on touch */}
            <button
              onClick={() => setSelfOnStage((v) => !v)}
              title={selfOnStage ? "Show their video" : "Show my video on stage"}
              className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur"
            >
              <ArrowLeftRight className="h-3 w-3" /> Swap
            </button>

            {/* PiP label */}
            <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] backdrop-blur">
              {selfOnStage ? (
                remoteHasAudio ? (
                  <Volume2 className="h-3 w-3" />
                ) : (
                  <MicOff className="h-3 w-3 text-red-400" />
                )
              ) : micOn ? (
                <Mic className="h-3 w-3" />
              ) : (
                <MicOff className="h-3 w-3 text-red-400" />
              )}
              <span>{selfOnStage ? (remoteLabel ?? "Participant") : (selfLabel ?? "You")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="px-4 pb-5 pt-2">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 rounded-full bg-zinc-900/80 backdrop-blur border border-white/10 px-3 py-2 shadow-2xl">
          <ControlButton on={micOn} onClick={toggleMic} Icon={Mic} OffIcon={MicOff} label="Mic" />
          <ControlButton on={camOn} onClick={toggleCam} Icon={Camera} OffIcon={CameraOff} label="Camera" />
          <ControlButton
            on={sharing}
            activeColor="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            onClick={toggleShare}
            Icon={MonitorUp}
            OffIcon={MonitorUp}
            label={sharing ? "Stop share" : "Share screen"}
          />
          <ControlButton
            on={selfOnStage}
            activeColor="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            onClick={() => setSelfOnStage((v) => !v)}
            Icon={ArrowLeftRight}
            OffIcon={ArrowLeftRight}
            label={selfOnStage ? "Show their video" : "Show my video on stage"}
          />
          <ControlButton
            on={!fullscreen}
            neutral
            onClick={toggleFullscreen}
            Icon={Maximize2}
            OffIcon={Minimize2}
            label="Fullscreen"
          />
          <div className="mx-2 h-6 w-px bg-white/15" />
          <button
            onClick={leave}
            className="inline-flex items-center gap-2 rounded-full bg-red-500 hover:bg-red-400 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <PhoneOff className="h-4 w-4" />
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Lobby button (used for mic/cam toggles in pre-join screen) ----
function LobbyToggle({
  on,
  onClick,
  Icon,
  OffIcon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  Icon: typeof Mic;
  OffIcon: typeof MicOff;
  label: string;
}) {
  const ActiveIcon = on ? Icon : OffIcon;
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center justify-center h-11 w-11 rounded-full transition-colors",
        on
          ? "bg-white/10 hover:bg-white/15 text-white"
          : "bg-red-500/90 hover:bg-red-500 text-white",
      )}
    >
      <ActiveIcon className="h-5 w-5" />
    </button>
  );
}

// ---- In-call control button ----
function ControlButton({
  on,
  onClick,
  Icon,
  OffIcon,
  label,
  neutral,
  activeColor,
}: {
  on: boolean;
  onClick: () => void;
  Icon: typeof Mic;
  OffIcon: typeof MicOff;
  label: string;
  neutral?: boolean;
  activeColor?: string;
}) {
  const ActiveIcon = on ? Icon : OffIcon;
  const palette = neutral
    ? "bg-white/10 hover:bg-white/15 text-white"
    : on
      ? activeColor ?? "bg-white/10 hover:bg-white/15 text-white"
      : "bg-red-500 hover:bg-red-400 text-white";
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center justify-center h-11 w-11 rounded-full transition-colors",
        palette,
      )}
    >
      <ActiveIcon className="h-5 w-5" />
    </button>
  );
}

export default VideoRoom;
